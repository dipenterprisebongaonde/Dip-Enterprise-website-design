import { NextResponse } from "next/server";
import type { InvoiceDoc } from "@/lib/invoice";
import { getCompanyProfile } from "@/lib/company";
import {
  buildInvoiceDocumentHtml,
  isA4PrintFormat,
  parseInvoicePrintFormat,
  renderInvoicePdf,
} from "@/lib/render-invoice-pdf";

function isValidPdf(buffer: Buffer) {
  if (buffer.length < 200) return false;
  const head = buffer.subarray(0, 5).toString("utf8");
  return head === "%PDF-";
}

export async function invoicePrintResponse(request: Request, invoice: InvoiceDoc) {
  const url = new URL(request.url);
  const profile = await getCompanyProfile();
  const format = parseInvoicePrintFormat(
    url.searchParams.get("format"),
    invoice.type === "purchase" ? profile.purchasePdfTemplate : profile.invoicePdfTemplate,
  );
  const view = url.searchParams.get("view");
  // Default to attachment so browsers download instead of showing a blank inline PDF tab.
  const inline = url.searchParams.get("inline") === "1";
  const download = !inline || url.searchParams.get("download") === "1";
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

  try {
    const buffer = await renderInvoicePdf(invoice, format);
    if (!isValidPdf(buffer)) {
      console.error("invoice pdf invalid buffer", {
        format,
        invoiceNo: invoice.invoiceNo,
        bytes: buffer.length,
      });
      return NextResponse.json(
        { error: "PDF renderer returned an empty document. Please try again." },
        { status: 502 },
      );
    }

    const filename = `${safeName}-${format === "a4" ? "atelier" : format}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("invoice pdf render failed", error);
    return NextResponse.json(
      { error: "Could not generate PDF. Please try again." },
      { status: 500 },
    );
  }
}
