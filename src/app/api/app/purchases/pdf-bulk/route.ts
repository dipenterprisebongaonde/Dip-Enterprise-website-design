
import { NextResponse } from "next/server";
import { z } from "zod";
import { canBulkDownloadInvoices } from "@/lib/access";
import { getSession } from "@/lib/auth";
import { BULK_PDF_MAX, buildPurchasesPdfZip } from "@/lib/bulk-invoice-pdf";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const bodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(BULK_PDF_MAX),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canBulkDownloadInvoices(session)) {
    return NextResponse.json(
      { error: "Only super admin can download multiple invoices." },
      { status: 403 }
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: `Select between 1 and ${BULK_PDF_MAX} purchase invoices.` },
      { status: 400 }
    );
  }

  const uniqueIds = [...new Set(parsed.data.ids)];
  const purchases = await prisma.purchase.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true },
  });
  const allowed = new Set(purchases.map((purchase) => purchase.id));
  const ids = uniqueIds.filter((id) => allowed.has(id));
  if (ids.length === 0) {
    return NextResponse.json({ error: "No matching purchase invoices found." }, { status: 404 });
  }

  try {
    const zip = await buildPurchasesPdfZip(ids);
    if (!zip) {
      return NextResponse.json({ error: "Could not build PDF zip." }, { status: 400 });
    }

    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(new Uint8Array(zip.buffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="purchase-invoices-${stamp}.zip"`,
        "Cache-Control": "no-store",
        "X-Invoice-Count": String(zip.count),
      },
    });
  } catch (error) {
    console.error("purchases pdf-bulk", error);
    return NextResponse.json({ error: "Could not generate invoice PDFs." }, { status: 500 });
  }
}
