
import { NextResponse } from "next/server";
import { z } from "zod";
import { PartyPaymentType, Role } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { recordVendorPartyPayment } from "@/lib/party-payments";
import { prisma } from "@/lib/prisma";
import {
  parsePaymentRequest,
  proofErrorMessage,
  savePaymentProof,
} from "@/lib/uploads";

const schema = z.object({
  amount: z.number().positive(),
  type: z.enum(["PAY", "ADVANCE", "APPLY"]),
  paidAt: z.string().min(4),
  note: z.string().optional(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const vendor = await prisma.vendor.findUnique({
    where: { id },
    include: { payments: { orderBy: { paidAt: "desc" }, take: 20 } },
  });
  if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  if (session.role === Role.STAFF && vendor.branchId !== session.branchId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    advanceBalance: vendor.advanceBalance,
    payments: vendor.payments,
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const vendor = await prisma.vendor.findUnique({ where: { id } });
  if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  if (session.role === Role.STAFF && vendor.branchId !== session.branchId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const raw = await parsePaymentRequest(request);
    const data = schema.parse({
      amount: raw.amount,
      paidAt: raw.paidAt,
      note: raw.note,
      type: raw.type,
    });

    let proof = null;
    if (raw.proofFile) {
      try {
        proof = await savePaymentProof(raw.proofFile, `vendor-${id.slice(-6)}`);
      } catch (uploadError) {
        const code = uploadError instanceof Error ? uploadError.message : "";
        return NextResponse.json({ error: proofErrorMessage(code) }, { status: 400 });
      }
    }

    const result = await recordVendorPartyPayment({
      vendorId: id,
      amount: data.amount,
      type: data.type as PartyPaymentType,
      paidAt: new Date(data.paidAt),
      note: data.note || null,
      proof,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid payment data" }, { status: 400 });
    }
    const code = error instanceof Error ? error.message : "";
    if (code === "INVALID_AMOUNT") {
      return NextResponse.json({ error: "Enter a valid payment amount." }, { status: 400 });
    }
    if (code === "NO_ADVANCE") {
      return NextResponse.json({ error: "No advance balance available to apply." }, { status: 400 });
    }
    if (code === "NO_DUE") {
      return NextResponse.json({ error: "No unpaid invoice amount to apply advance against." }, { status: 400 });
    }
    return NextResponse.json({ error: "Could not record payment" }, { status: 400 });
  }
}
