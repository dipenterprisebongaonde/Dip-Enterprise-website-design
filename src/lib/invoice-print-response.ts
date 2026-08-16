import { NextResponse } from "next/server";
import type { InvoiceDoc } from "@/lib/invoice";
import { getCompanyProfile } from "@/lib/company";
import {
  buildInvoiceDocumentHtml,
  isA4PrintFormat,
  parseInvoicePrintFormat,
  renderInvoicePdf,
} from "@/lib/render-invoice-pdf";

export async function invoicePrintResponse(request: Request, invoice: InvoiceDoc) {
  const url = new URL(request.url);
  const profile = await getCompanyProfile();
  const format = parseInvoicePrintFormat(
    url.searchParams.get("format"),
    invoice.type === "purchase" ? profile.purchasePdfTemplate : profile.invoicePdfTemplate,
  );
  const view = url.searchParams.get("view");
  const download = url.searchParams.get("download") === "1";
  const safeName = invoice.invoiceNo.replace(/[^\w.-]+/g, "_");

  if (view === "print" || view === "html") {
    const html = await buildInvoiceDocumentHtml(invoice, format, {
      interactive: true,
      autoprint: view === "print" && !isA4PrintFormat(format),
    });
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  const buffer = await renderInvoicePdf(invoice, format);
  const suffix =
    format === "thermal58"
      ? "-thermal-58mm"
      : format === "thermal80"
        ? "-thermal-80mm"
        : format === "flipkart"
          ? "-flipkart"
          : format === "tally"
            ? "-tally"
            : "";
  const filename = `${safeName}${suffix}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
