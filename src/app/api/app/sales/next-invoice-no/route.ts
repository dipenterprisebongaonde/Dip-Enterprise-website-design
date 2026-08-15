
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { nextInvoiceNumber, parseDateInput } from "@/lib/invoice-number";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const date = parseDateInput(searchParams.get("date"));
  const excludeId = searchParams.get("excludeId");
  const invoiceNo = await nextInvoiceNumber("sale", {
    date,
    excludeId: excludeId || null,
  });
  return NextResponse.json({
    invoiceNo,
    date: searchParams.get("date") || date.toISOString().slice(0, 10),
  });
}
