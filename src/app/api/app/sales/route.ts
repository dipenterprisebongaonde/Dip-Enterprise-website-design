
import { NextResponse } from "next/server";
import { z } from "zod";
import { getBranchScope, resolveCreateBranchId } from "@/lib/active-branch";
import { getSession } from "@/lib/auth";
import {
  invoiceChargeSchema,
  invoiceLineSchema,
  normalizeInvoiceCharges,
  normalizeInvoiceLines,
} from "@/lib/invoice-lines";
import {
  invoiceNoTakenMessage,
  parseDateInput,
  resolveInvoiceNumber,
} from "@/lib/invoice-number";
import {
  normalizeInitialPaidAmount,
  resolveInvoiceRoundOff,
  resolvePaymentStatus,
  roundMoney,
} from "@/lib/payments";
import { consumePartyAdvance, readPartyAdvance } from "@/lib/party-payments";
import { normalizePaymentMethod } from "@/lib/payment-methods";
import { prisma } from "@/lib/prisma";
import { applySaleToStock } from "@/lib/stock";
import {
  parseInvoiceRequest,
  proofErrorMessage,
  savePaymentProof,
} from "@/lib/uploads";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { where } = await getBranchScope(session);
  const sales = await prisma.sale.findMany({
    where,
    include: { customer: true, branch: true, lines: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ sales });
}

const schema = z.object({
  invoiceNo: z.string().min(2),
  invoiceDate: z.string().min(4),
  lines: z.array(invoiceLineSchema).min(1).optional(),
  charges: z.array(invoiceChargeSchema).optional(),
  roundOff: z.number().optional().nullable(),
  applyRoundOff: z.boolean().optional(),
  item: z.string().min(1).optional(),
  quantity: z.number().int().positive().optional(),
  unitPrice: z.number().nonnegative().optional(),
  amount: z.number().nonnegative().optional(),
  paymentStatus: z.enum(["PAID", "UNPAID", "PARTIAL"]),
  paidAmount: z.number().nonnegative().optional(),
  paidAt: z.string().optional(),
  paymentMethod: z.string().optional().nullable(),
  settleFromAdvance: z.boolean().optional(),
  notes: z.string().optional(),
  customerId: z.string().min(1, "Customer is required"),
  branchId: z.string().optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const parsed = await parseInvoiceRequest(request);
    const data = schema.parse(parsed.data);
    const branchId = await resolveCreateBranchId(session, data.branchId);

    if (!branchId) {
      return NextResponse.json({ error: "Branch is required" }, { status: 400 });
    }

    let summary;
    try {
      summary = normalizeInvoiceLines(
        data.lines?.length
          ? data.lines
          : [
              {
                item: data.item || "",
                quantity: data.quantity || 0,
                unitPrice: data.unitPrice || 0,
                amount: data.amount,
              },
            ]
      );
    } catch {
      return NextResponse.json({ error: "Add at least one product." }, { status: 400 });
    }

    const { charges, chargesTotal } = normalizeInvoiceCharges(data.charges);
    const subtotal = roundMoney(summary.amount + chargesTotal);
    const roundOff = resolveInvoiceRoundOff({
      subtotal,
      enabled: data.applyRoundOff,
      roundOff: data.roundOff,
    });
    const amount = roundMoney(subtotal + roundOff);

    let paidAmount: number;
    try {
      paidAmount = normalizeInitialPaidAmount({
        amount,
        paymentStatus: data.paymentStatus,
        paidAmount: data.paidAmount,
      });
    } catch (paymentError) {
      const code = paymentError instanceof Error ? paymentError.message : "";
      if (code === "PARTIAL_REQUIRES_PAID_AMOUNT") {
        return NextResponse.json(
          { error: "Enter the amount already paid for a partial payment." },
          { status: 400 }
        );
      }
      if (code === "PARTIAL_MUST_BE_LESS_THAN_TOTAL") {
        return NextResponse.json(
          { error: "Partial paid amount must be less than the invoice total." },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: "Invalid paid amount" }, { status: 400 });
    }

    const paymentStatus = resolvePaymentStatus(amount, paidAmount);
    const settleFromAdvance = Boolean(data.settleFromAdvance) && paidAmount > 0;
    const paymentMethod = settleFromAdvance
      ? "Advance"
      : normalizePaymentMethod(data.paymentMethod);

    if (settleFromAdvance) {
      try {
        const advance = await readPartyAdvance("customer", data.customerId);
        if (advance + 0.001 < paidAmount) {
          return NextResponse.json(
            { error: "Settlement amount exceeds available advance balance." },
            { status: 400 }
          );
        }
      } catch (advanceError) {
        const code = advanceError instanceof Error ? advanceError.message : "";
        if (code === "CUSTOMER_NOT_FOUND") {
          return NextResponse.json({ error: "Customer not found." }, { status: 400 });
        }
        throw advanceError;
      }
    }

    let proof = null;
    if (parsed.proofFile) {
      if (paidAmount <= 0) {
        return NextResponse.json(
          { error: "Payment proof can only be attached when an amount is paid." },
          { status: 400 }
        );
      }
      try {
        proof = await savePaymentProof(parsed.proofFile, "sale");
      } catch (uploadError) {
        const code = uploadError instanceof Error ? uploadError.message : "";
        return NextResponse.json({ error: proofErrorMessage(code) }, { status: 400 });
      }
    }

    for (const line of summary.lines) {
      try {
        await applySaleToStock({
          branchId,
          productName: line.item,
          quantity: line.quantity,
          note: `Sale invoice stock out`,
        });
      } catch (stockError) {
        const code = stockError instanceof Error ? stockError.message : "";
        if (code === "PRODUCT_NOT_FOUND") {
          return NextResponse.json(
            { error: `Product not found in inventory: ${line.item}` },
            { status: 400 }
          );
        }
        if (code === "INSUFFICIENT_STOCK") {
          return NextResponse.json(
            { error: `Not enough stock for ${line.item}.` },
            { status: 400 }
          );
        }
        throw stockError;
      }
    }

    let invoiceNo: string;
    try {
      invoiceNo = await resolveInvoiceNumber("sale", data.invoiceNo, {
        date: parseDateInput(data.invoiceDate),
      });
    } catch (error) {
      if (error instanceof Error && error.message === "INVOICE_NO_TAKEN") {
        return NextResponse.json(
          { error: invoiceNoTakenMessage("sale", data.invoiceNo.trim()) },
          { status: 409 }
        );
      }
      throw error;
    }

    const sale = await prisma.sale.create({
      data: {
        invoiceNo,
        invoiceDate: new Date(data.invoiceDate),
        item: summary.item,
        quantity: summary.quantity,
        unitPrice: summary.unitPrice,
        amount,
        roundOff,
        paidAmount,
        paymentStatus,
        notes: data.notes || null,
        customerId: data.customerId,
        branchId,
        createdById: session.id,
        lines: {
          create: summary.lines,
        },
        charges: charges.length
          ? {
              create: charges,
            }
          : undefined,
        ...(paidAmount > 0
          ? {
              payments: {
                create: {
                  amount: paidAmount,
                  note: settleFromAdvance ? "Settled from advance" : "Initial payment",
                  paymentMethod,
                  paidAt: new Date(data.paidAt || data.invoiceDate),
                  proofUrl: proof?.proofUrl || null,
                  proofFileName: proof?.proofFileName || null,
                  proofMimeType: proof?.proofMimeType || null,
                },
              },
            }
          : {}),
      },
      include: { lines: true, charges: true, payments: true },
    });

    if (settleFromAdvance) {
      try {
        await consumePartyAdvance({
          kind: "customer",
          partyId: data.customerId,
          amount: paidAmount,
          paidAt: new Date(data.paidAt || data.invoiceDate),
          note: `Settled on ${sale.invoiceNo}`,
        });
      } catch (advanceError) {
        const code = advanceError instanceof Error ? advanceError.message : "";
        if (code === "INSUFFICIENT_ADVANCE") {
          return NextResponse.json(
            { error: "Settlement amount exceeds available advance balance." },
            { status: 400 }
          );
        }
        throw advanceError;
      }
    }

    return NextResponse.json({ sale }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid sales invoice data" }, { status: 400 });
    }
    const prismaCode =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: string }).code || "")
        : "";
    if (prismaCode === "P2002") {
      return NextResponse.json(
        { error: "Sale invoice number already exists. Use a different number." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Invalid sales invoice data" }, { status: 400 });
  }
}
