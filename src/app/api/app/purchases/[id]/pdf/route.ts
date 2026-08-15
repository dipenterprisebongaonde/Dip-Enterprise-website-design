import { invoicePrintResponse } from "@/lib/invoice-print-response";
import { getPurchaseInvoiceDoc } from "@/lib/invoice-data";
import { getSession } from "@/lib/auth";
import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
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

  const invoice = await getPurchaseInvoiceDoc(id);
  if (!invoice) return NextResponse.json({ error: "Purchase not found" }, { status: 404 });

  return invoicePrintResponse(request, invoice);
}
