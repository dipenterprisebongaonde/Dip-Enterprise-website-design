import { NextResponse } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { dueAmount, resolvePaymentStatus, roundMoney } from "@/lib/payments";
import { settlePurchaseFromAdvance } from "@/lib/party-payments";
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
  if (code === "NO_DUE") return "Bill is already fully paid.";
  if (code === "NO_VENDOR") return "This bill has no linked vendor for advance settlement.";
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
  const purchase = await prisma.purchase.findUnique({
    where: { id },
    include: {
      payments: { orderBy: { paidAt: "desc" } },
      vendor: { select: { id: true, advanceBalance: true } },
    },
  });
  if (!purchase) return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
  if (session.role === Role.STAFF && purchase.branchId !== session.branchId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    paidAmount: purchase.paidAmount,
    dueAmount: dueAmount(purchase.amount, purchase.paidAmount),
    paymentStatus: purchase.paymentStatus,
    advanceBalance: purchase.vendor?.advanceBalance || 0,
    payments: purchase.payments,
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const purchase = await prisma.purchase.findUnique({ where: { id } });
  if (!purchase) return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
  if (session.role === Role.STAFF && purchase.branchId !== session.branchId) {
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
        const result = await settlePurchaseFromAdvance({
          purchaseId: purchase.id,
          amount: data.amount,
          paidAt: new Date(data.paidAt),
          note: data.note,
        });
        return NextResponse.json(
          {
            payment: result.payment,
            purchase: result.purchase,
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

    const due = dueAmount(purchase.amount, purchase.paidAmount);
    const paymentAmount = roundMoney(data.amount);

    if (due <= 0) {
      return NextResponse.json({ error: "Bill is already fully paid." }, { status: 400 });
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
        proof = await savePaymentProof(raw.proofFile, `purchase-${purchase.id.slice(-6)}`);
      } catch (uploadError) {
        const code = uploadError instanceof Error ? uploadError.message : "";
        return NextResponse.json({ error: proofErrorMessage(code) }, { status: 400 });
      }
    }

    const nextPaid = roundMoney(purchase.paidAmount + paymentAmount);
    const paymentStatus = resolvePaymentStatus(purchase.amount, nextPaid);

    const [payment, updated] = await prisma.$transaction([
      prisma.purchasePayment.create({
        data: {
          purchaseId: purchase.id,
          amount: paymentAmount,
          note: data.note?.trim() || null,
          paidAt: new Date(data.paidAt),
          proofUrl: proof?.proofUrl || null,
          proofFileName: proof?.proofFileName || null,
          proofMimeType: proof?.proofMimeType || null,
        },
      }),
      prisma.purchase.update({
        where: { id: purchase.id },
        data: {
          paidAmount: nextPaid,
          paymentStatus,
        },
      }),
    ]);

    return NextResponse.json(
      {
        payment,
        purchase: updated,
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
