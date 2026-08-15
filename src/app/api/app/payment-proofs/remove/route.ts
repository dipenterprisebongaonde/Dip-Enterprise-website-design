import { NextResponse } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deletePaymentProofFile } from "@/lib/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  source: z.enum(["sale", "purchase", "customer", "vendor"]),
  paymentId: z.string().min(1),
});

const CLEAR = {
  proofUrl: null,
  proofFileName: null,
  proofMimeType: null,
};

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { source, paymentId } = body;

  if (source === "sale") {
    const payment = await prisma.salePayment.findUnique({
      where: { id: paymentId },
      include: { sale: true },
    });
    if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    if (session.role === Role.STAFF && payment.sale.branchId !== session.branchId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!payment.proofUrl) return NextResponse.json({ ok: true });
    await deletePaymentProofFile(payment.proofUrl);
    await prisma.salePayment.update({ where: { id: paymentId }, data: CLEAR });
    return NextResponse.json({ ok: true });
  }

  if (source === "purchase") {
    const payment = await prisma.purchasePayment.findUnique({
      where: { id: paymentId },
      include: { purchase: true },
    });
    if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    if (session.role === Role.STAFF && payment.purchase.branchId !== session.branchId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!payment.proofUrl) return NextResponse.json({ ok: true });
    await deletePaymentProofFile(payment.proofUrl);
    await prisma.purchasePayment.update({ where: { id: paymentId }, data: CLEAR });
    return NextResponse.json({ ok: true });
  }

  if (source === "customer") {
    const payment = await prisma.customerPayment.findUnique({
      where: { id: paymentId },
      include: { customer: true },
    });
    if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    if (session.role === Role.STAFF && payment.customer.branchId !== session.branchId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!payment.proofUrl) return NextResponse.json({ ok: true });
    await deletePaymentProofFile(payment.proofUrl);
    await prisma.customerPayment.update({ where: { id: paymentId }, data: CLEAR });
    return NextResponse.json({ ok: true });
  }

  const payment = await prisma.vendorPayment.findUnique({
    where: { id: paymentId },
    include: { vendor: true },
  });
  if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  if (session.role === Role.STAFF && payment.vendor.branchId !== session.branchId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!payment.proofUrl) return NextResponse.json({ ok: true });
  await deletePaymentProofFile(payment.proofUrl);
  await prisma.vendorPayment.update({ where: { id: paymentId }, data: CLEAR });
  return NextResponse.json({ ok: true });
}
