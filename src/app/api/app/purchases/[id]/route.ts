
import { NextResponse } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { canDeleteInvoices } from "@/lib/access";
import { getSession } from "@/lib/auth";
import {
  invoiceChargeSchema,
  invoiceLineSchema,
  linesFromLegacy,
  normalizeInvoiceCharges,
  normalizeInvoiceLines,
} from "@/lib/invoice-lines";
import {
  assertInvoiceNoAvailable,
  invoiceNoTakenMessage,
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
import { applyPurchaseToStock, reversePurchaseFromStock } from "@/lib/stock";
import {
  parseInvoiceRequest,
  proofErrorMessage,
  savePaymentProof,
} from "@/lib/uploads";

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
  vendorId: z.string().min(1, "Vendor is required"),
  branchId: z.string().optional(),
});

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const existing = await prisma.purchase.findUnique({
    where: { id },
    include: { lines: true },
  });
  if (!existing) return NextResponse.json({ error: "Purchase not found" }, { status: 404 });

  if (session.role === Role.STAFF && existing.branchId !== session.branchId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const parsed = await parseInvoiceRequest(request);
    const data = schema.parse(parsed.data);
    const branchId =
      session.role === Role.STAFF
        ? session.branchId!
        : data.branchId || existing.branchId;

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
        paidAmount:
          data.paidAmount !== undefined ? data.paidAmount : existing.paidAmount,
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
          { error: "Partial paid amount must be less than the bill total." },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: "Invalid paid amount" }, { status: 400 });
    }

    paidAmount = roundMoney(Math.min(paidAmount, amount));
    const paymentStatus = resolvePaymentStatus(amount, paidAmount);
    const previousPaid = roundMoney(existing.paidAmount);
    const settleDelta = roundMoney(Math.max(0, paidAmount - previousPaid));
    const settleFromAdvance = Boolean(data.settleFromAdvance) && settleDelta > 0;
    const paymentMethod = settleFromAdvance
      ? "Advance"
      : normalizePaymentMethod(data.paymentMethod);

    if (settleFromAdvance) {
      try {
        const advance = await readPartyAdvance("vendor", data.vendorId);
        if (advance + 0.001 < settleDelta) {
          return NextResponse.json(
            { error: "Settlement amount exceeds available advance balance." },
            { status: 400 }
          );
        }
      } catch (advanceError) {
        const code = advanceError instanceof Error ? advanceError.message : "";
        if (code === "VENDOR_NOT_FOUND") {
          return NextResponse.json({ error: "Vendor not found." }, { status: 400 });
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
        proof = await savePaymentProof(parsed.proofFile, `purchase-${id.slice(-6)}`);
      } catch (uploadError) {
        const code = uploadError instanceof Error ? uploadError.message : "";
        return NextResponse.json({ error: proofErrorMessage(code) }, { status: 400 });
      }
    }

    const previousLines =
      existing.lines.length > 0
        ? existing.lines.map((line) => ({
            item: line.item,
            quantity: line.quantity,
          }))
        : linesFromLegacy(existing).map((line) => ({
            item: line.item,
            quantity: line.quantity,
          }));

    try {
      for (const line of previousLines) {
        await reversePurchaseFromStock({
          branchId: existing.branchId,
          productName: line.item,
          quantity: line.quantity,
          note: `Purchase edit reverse ${existing.invoiceNo}`,
        });
      }
      for (const line of summary.lines) {
        await applyPurchaseToStock({
          branchId,
          productName: line.item,
          quantity: line.quantity,
          note: `Purchase edit apply ${data.invoiceNo}`,
        });
      }
    } catch (stockError) {
      try {
        for (const line of previousLines) {
          await applyPurchaseToStock({
            branchId: existing.branchId,
            productName: line.item,
            quantity: line.quantity,
            note: `Purchase edit rollback ${existing.invoiceNo}`,
          });
        }
      } catch {
        // ignore rollback failure
      }

      const code = stockError instanceof Error ? stockError.message : "";
      if (code === "PRODUCT_NOT_FOUND" || code === "INSUFFICIENT_STOCK") {
        return NextResponse.json(
          {
            error:
              code === "INSUFFICIENT_STOCK"
                ? "Not enough stock to reverse the previous purchase quantity."
                : "Product not found in inventory for stock adjustment.",
          },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: "Stock update failed" }, { status: 400 });
    }

    try {
      await assertInvoiceNoAvailable("purchase", data.invoiceNo, { excludeId: id });
    } catch (error) {
      if (error instanceof Error && error.message === "INVOICE_NO_TAKEN") {
        return NextResponse.json(
          { error: invoiceNoTakenMessage("purchase", data.invoiceNo.trim()) },
          { status: 409 }
        );
      }
      throw error;
    }

    const purchase = await prisma.$transaction(async (tx) => {
      await tx.purchaseLine.deleteMany({ where: { purchaseId: id } });
      await tx.purchaseCharge.deleteMany({ where: { purchaseId: id } });
      return tx.purchase.update({
        where: { id },
        data: {
          invoiceNo: data.invoiceNo.trim(),
          invoiceDate: new Date(data.invoiceDate),
          item: summary.item,
          quantity: summary.quantity,
          unitPrice: summary.unitPrice,
          amount,
          roundOff,
          paidAmount,
          paymentStatus,
          notes: data.notes || null,
          vendorId: data.vendorId,
          branchId,
          lines: {
            create: summary.lines,
          },
          charges: charges.length
            ? {
                create: charges,
              }
            : undefined,
        },
        include: { lines: true, charges: true },
      });
    });

    if (paidAmount > 0 && data.paidAt) {
      const latest = await prisma.purchasePayment.findFirst({
        where: { purchaseId: id },
        orderBy: { paidAt: "desc" },
      });
      if (latest && !settleFromAdvance) {
        await prisma.purchasePayment.update({
          where: { id: latest.id },
          data: {
            paidAt: new Date(data.paidAt),
            amount: paidAmount,
            paymentMethod: paymentMethod || latest.paymentMethod,
            ...(proof
              ? {
                  proofUrl: proof.proofUrl,
                  proofFileName: proof.proofFileName,
                  proofMimeType: proof.proofMimeType,
                }
              : {}),
          },
        });
      } else if (settleFromAdvance && settleDelta > 0) {
        await prisma.purchasePayment.create({
          data: {
            purchaseId: id,
            amount: settleDelta,
            note: "Settled from advance",
            paymentMethod: "Advance",
            paidAt: new Date(data.paidAt),
            proofUrl: proof?.proofUrl || null,
            proofFileName: proof?.proofFileName || null,
            proofMimeType: proof?.proofMimeType || null,
          },
        });
        await consumePartyAdvance({
          kind: "vendor",
          partyId: data.vendorId,
          amount: settleDelta,
          paidAt: new Date(data.paidAt),
          note: `Settled on ${data.invoiceNo.trim()}`,
        });
      } else {
        await prisma.purchasePayment.create({
          data: {
            purchaseId: id,
            amount: paidAmount,
            note: "Payment date update",
            paymentMethod,
            paidAt: new Date(data.paidAt),
            proofUrl: proof?.proofUrl || null,
            proofFileName: proof?.proofFileName || null,
            proofMimeType: proof?.proofMimeType || null,
          },
        });
      }
    }

    return NextResponse.json({ purchase });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid purchase invoice data" }, { status: 400 });
    }
    const prismaCode =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: string }).code || "")
        : "";
    if (prismaCode === "P2002") {
      return NextResponse.json(
        { error: "Purchase invoice number already exists. Use a different number." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Could not update purchase invoice" }, { status: 400 });
  }
}
