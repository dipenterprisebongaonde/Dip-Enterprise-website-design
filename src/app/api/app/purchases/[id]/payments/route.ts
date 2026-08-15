
import { NextResponse } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { dueAmount, resolvePaymentStatus, roundMoney } from "@/lib/payments";
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

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const purchase = await prisma.purchase.findUnique({
    where: { id },
    include: { payments: { orderBy: { paidAt: "desc" } } },
  });
  if (!purchase) return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
  if (session.role === Role.STAFF && purchase.branchId !== session.branchId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    paidAmount: purchase.paidAmount,
    dueAmount: dueAmount(purchase.amount, purchase.paidAmount),
    paymentStatus: purchase.paymentStatus,
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
