import { NextResponse } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { dueAmount, resolvePaymentStatus, roundMoney } from "@/lib/payments";
import { settleSaleFromAdvance } from "@/lib/party-payments";
import { prisma } from "@/lib/prisma";
import {
  parsePaymentRequest,
  proofErrorMessage,
  savePaymentProof,
} from "@/lib/uploads";

const schema = z.object({
  amount: z.number().positive(),
  note: z.string().optional(),
  paidAt: z.string().min(4),
});

function settleErrorMessage(code: string) {
  if (code === "NO_ADVANCE") return "No advance balance available for settlement.";
  if (code === "NO_DUE") return "Invoice is already fully paid.";
  if (code === "NO_CUSTOMER") return "This invoice has no linked customer for advance settlement.";
  if (code === "INVALID_AMOUNT") return "Enter a valid settlement amount.";
  return "Could not settle from advance.";
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const sale = await prisma.sale.findUnique({
    where: { id },
    include: {
      payments: { orderBy: { paidAt: "desc" } },
      customer: { select: { id: true, advanceBalance: true } },
    },
  });
  if (!sale) return NextResponse.json({ error: "Sale not found" }, { status: 404 });
  if (session.role === Role.STAFF && sale.branchId !== session.branchId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    paidAmount: sale.paidAmount,
    dueAmount: dueAmount(sale.amount, sale.paidAmount),
    paymentStatus: sale.paymentStatus,
    advanceBalance: sale.customer?.advanceBalance || 0,
    payments: sale.payments,
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const sale = await prisma.sale.findUnique({ where: { id } });
  if (!sale) return NextResponse.json({ error: "Sale not found" }, { status: 404 });
  if (session.role === Role.STAFF && sale.branchId !== session.branchId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const raw = await parsePaymentRequest(request);
    const data = schema.parse({
      amount: raw.amount,
      paidAt: raw.paidAt,
      note: raw.note,
    });

    if (raw.settleFromAdvance) {
      try {
        const result = await settleSaleFromAdvance({
          saleId: sale.id,
          amount: data.amount,
          paidAt: new Date(data.paidAt),
          note: data.note,
        });
        return NextResponse.json(
          {
            payment: result.payment,
            sale: result.sale,
            dueAmount: result.dueAmount,
            advanceBalance: result.advanceBalance,
            settledFromAdvance: true,
          },
          { status: 201 }
        );
      } catch (settleError) {
        const code = settleError instanceof Error ? settleError.message : "";
        return NextResponse.json({ error: settleErrorMessage(code) }, { status: 400 });
      }
    }

    const due = dueAmount(sale.amount, sale.paidAmount);
    const paymentAmount = roundMoney(data.amount);

    if (due <= 0) {
      return NextResponse.json({ error: "Invoice is already fully paid." }, { status: 400 });
    }
    if (paymentAmount > due + 0.001) {
      return NextResponse.json(
        { error: `Payment cannot exceed due amount (₹${due.toLocaleString()}).` },
        { status: 400 }
      );
    }

    let proof = null;
    if (raw.proofFile) {
      try {
        proof = await savePaymentProof(raw.proofFile, `sale-${sale.id.slice(-6)}`);
      } catch (uploadError) {
        const code = uploadError instanceof Error ? uploadError.message : "";
        return NextResponse.json({ error: proofErrorMessage(code) }, { status: 400 });
      }
    }

    const nextPaid = roundMoney(sale.paidAmount + paymentAmount);
    const paymentStatus = resolvePaymentStatus(sale.amount, nextPaid);

    const [payment, updated] = await prisma.$transaction([
      prisma.salePayment.create({
        data: {
          saleId: sale.id,
          amount: paymentAmount,
          note: data.note?.trim() || null,
          paidAt: new Date(data.paidAt),
          proofUrl: proof?.proofUrl || null,
          proofFileName: proof?.proofFileName || null,
          proofMimeType: proof?.proofMimeType || null,
        },
      }),
      prisma.sale.update({
        where: { id: sale.id },
        data: {
          paidAmount: nextPaid,
          paymentStatus,
        },
      }),
    ]);

    return NextResponse.json(
      {
        payment,
        sale: updated,
        dueAmount: dueAmount(updated.amount, updated.paidAmount),
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid payment amount" }, { status: 400 });
    }
    return NextResponse.json({ error: "Could not add payment" }, { status: 400 });
  }
}
