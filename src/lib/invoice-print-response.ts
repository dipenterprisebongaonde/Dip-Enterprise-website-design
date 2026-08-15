
import { NextResponse } from "next/server";
import type { InvoiceDoc } from "@/lib/invoice";
import {
  buildInvoiceDocumentHtml,
  parseInvoicePrintFormat,
  renderInvoicePdf,
} from "@/lib/render-invoice-pdf";

export async function invoicePrintResponse(request: Request, invoice: InvoiceDoc) {
  const url = new URL(request.url);
  const format = parseInvoicePrintFormat(url.searchParams.get("format"));
  const view = url.searchParams.get("view");
  const download = url.searchParams.get("download") === "1";
  const safeName = invoice.invoiceNo.replace(/[^\w.-]+/g, "_");

  if (view === "print" || view === "html") {
    const html = await buildInvoiceDocumentHtml(invoice, format, {
      interactive: true,
      autoprint: view === "print" && format !== "a4",
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
    format === "thermal58" ? "-thermal-58mm" : format === "thermal80" ? "-thermal-80mm" : "";
  const filename = `${safeName}${suffix}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
