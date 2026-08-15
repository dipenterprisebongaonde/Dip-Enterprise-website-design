import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { getSession } from "@/lib/auth";
import {
  deletePurchaseInvoicePayment,
  ledgerDeleteErrorMessage,
} from "@/lib/ledger-deletes";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; paymentId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, paymentId } = await context.params;
  const purchase = await prisma.purchase.findUnique({ where: { id } });
  if (!purchase) return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
  if (session.role === Role.STAFF && purchase.branchId !== session.branchId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await deletePurchaseInvoicePayment({ purchaseId: id, paymentId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const status = code === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ error: ledgerDeleteErrorMessage(code) }, { status });
  }
}
