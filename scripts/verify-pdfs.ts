import fs from "node:fs";
import { amountInWords, amountWordsPlain } from "../src/lib/invoice";
import { logoDataUri } from "../src/lib/invoice-pdf-assets";
import { getPurchaseInvoiceDoc, getSaleInvoiceDoc } from "../src/lib/invoice-data";
import { renderInvoicePdf, type InvoicePrintFormat } from "../src/lib/render-invoice-pdf";

async function main() {
  console.log("words", amountInWords(84000), "|", amountWordsPlain(84000));
  console.log("paise", amountInWords(1234.56), "|", amountWordsPlain(1234.56));

  const logo = logoDataUri("public/uploads/company-logo.png", 96);
  console.log("logoUriBytes", logo ? logo.length : 0);

  const sale = await getSaleInvoiceDoc("cmsunv54h000djsevkndhmy2k");
  const purchase = await getPurchaseInvoiceDoc("cmsunv54d000ajsev5y685qda");
  console.log("sale", sale?.invoiceNo, sale?.totalValue, "lines", sale?.lines?.length);
  console.log("purchase", purchase?.invoiceNo, purchase?.totalValue);

  fs.mkdirSync("/tmp/pdf-verify", { recursive: true });
  const formats: InvoicePrintFormat[] = ["thermal80"];
  for (const format of formats) {
    if (!sale) continue;
    const buf = await renderInvoicePdf(sale, format);
    const out = `/tmp/pdf-verify/sale-${format}.pdf`;
    fs.writeFileSync(out, buf);
    console.log(format, buf.length, "bytes ->", out);
  }
  if (purchase) {
    const buf = await renderInvoicePdf(purchase, "thermal80");
    fs.writeFileSync("/tmp/pdf-verify/purchase-thermal80.pdf", buf);
    console.log("purchase-thermal80", buf.length);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
