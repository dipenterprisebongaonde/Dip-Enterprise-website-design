
import JSZip from "jszip";
import { getPurchaseInvoiceDoc, getSaleInvoiceDoc } from "@/lib/invoice-data";
import { renderInvoicePdf } from "@/lib/render-invoice-pdf";

export const BULK_PDF_MAX = 40;

function safePdfName(invoiceNo: string, used: Set<string>) {
  const base = invoiceNo.replace(/[\/\\?%*:|"<>]/g, "-").replace(/\s+/g, " ").trim() || "invoice";
  let name = `${base}.pdf`;
  let i = 2;
  while (used.has(name.toLowerCase())) {
    name = `${base}-${i}.pdf`;
    i += 1;
  }
  used.add(name.toLowerCase());
  return name;
}

export async function buildSalesPdfZip(ids: string[]) {
  const zip = new JSZip();
  const used = new Set<string>();
  let count = 0;

  for (const id of ids) {
    const invoice = await getSaleInvoiceDoc(id);
    if (!invoice) continue;
    const buffer = await renderInvoicePdf(invoice);
    zip.file(safePdfName(invoice.invoiceNo, used), buffer);
    count += 1;
  }

  if (count === 0) return null;
  const data = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return { buffer: data, count };
}

export async function buildPurchasesPdfZip(ids: string[]) {
  const zip = new JSZip();
  const used = new Set<string>();
  let count = 0;

  for (const id of ids) {
    const invoice = await getPurchaseInvoiceDoc(id);
    if (!invoice) continue;
    const buffer = await renderInvoicePdf(invoice);
    zip.file(safePdfName(invoice.invoiceNo, used), buffer);
    count += 1;
  }

  if (count === 0) return null;
  const data = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return { buffer: data, count };
}
