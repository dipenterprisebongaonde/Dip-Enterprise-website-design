import { invoicePrintResponse } from "@/lib/invoice-print-response";
import { getSaleInvoiceDoc } from "@/lib/invoice-data";
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
  const sale = await prisma.sale.findUnique({ where: { id } });
  if (!sale) return NextResponse.json({ error: "Sale not found" }, { status: 404 });
  if (session.role === Role.STAFF && sale.branchId !== session.branchId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const invoice = await getSaleInvoiceDoc(id);
  if (!invoice) return NextResponse.json({ error: "Sale not found" }, { status: 404 });

  return invoicePrintResponse(request, invoice);
}
