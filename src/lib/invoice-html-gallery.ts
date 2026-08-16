import {
  InvoiceCompany,
  InvoiceDoc,
  formatINR,
  gstRateFromPercent,
  taxableFromTotal,
} from "@/lib/invoice";
import {
  escapeHtml,
  formatPdfAmount,
  logoDataUri,
} from "@/lib/invoice-pdf-assets";

export type GalleryTemplateId = "atelier" | "limeEdge" | "navyGold" | "softWave";

function money(value: number) {
  return formatPdfAmount(value);
}

function prepare(invoice: InvoiceDoc, company: InvoiceCompany) {
  const logo = logoDataUri(company.logoPath, 96);
  const rate = gstRateFromPercent(company.gstPercent);
  const tax = taxableFromTotal(invoice.totalValue, rate, company.enableGst);
  const productsSubtotal = invoice.lines.reduce((sum, line) => sum + line.amount, 0);
  const charges = invoice.charges || [];
  const chargesTotal = charges.reduce((sum, c) => sum + c.amount, 0);
  const roundOff = invoice.roundOff || 0;
  const mark = escapeHtml((company.name || "D").trim().charAt(0).toUpperCase() || "D");
  const addressLines = company.address
    .split(/\n+/)
    .map((line) => escapeHtml(line.trim()))
    .filter(Boolean)
    .join("<br />");
  const phone = escapeHtml(company.phone || "—");
  const partyAddress = escapeHtml(invoice.partyAddress || "—");
  const isSale = invoice.type === "sale";
  return {
    logo,
    rate,
    tax,
    productsSubtotal,
    charges,
    chargesTotal,
    roundOff,
    mark,
    addressLines,
    phone,
    partyAddress,
    isSale,
    title: isSale ? "Invoice" : "Purchase Bill",
    partyLabel: isSale ? "Billed to" : "Supplier",
    companyName: escapeHtml(company.name || "Company"),
  };
}

function logoBlock(logo: string | null, mark: string, className = "co-logo") {
  return logo
    ? `<img class="${className}" src="${logo}" alt="" />`
    : `<div class="${className} mark">${mark}</div>`;
}

function companyIdentity(
  d: ReturnType<typeof prepare>,
  options?: { tone?: "light" | "dark" },
) {
  const tone = options?.tone || "light";
  return `
    <div class="co-id ${tone}">
      ${logoBlock(d.logo, d.mark)}
      <div class="co-copy">
        <div class="co-name">${d.companyName}</div>
        <div class="co-addr">${d.addressLines}</div>
        <div class="co-phone">Contact: ${d.phone}</div>
      </div>
    </div>`;
}

function partyBlock(invoice: InvoiceDoc, d: ReturnType<typeof prepare>, label?: string) {
  return `
    <div class="party">
      <p class="label">${label || d.partyLabel}</p>
      <strong>${escapeHtml(invoice.partyName || "—")}</strong>
      <div class="muted">${d.partyAddress}</div>
      ${
        invoice.partyPhone
          ? `<div class="muted">Contact: ${escapeHtml(invoice.partyPhone)}</div>`
          : ""
      }
    </div>`;
}

function lineGross(line: InvoiceDoc["lines"][number]) {
  return line.gross && line.gross > 0 ? line.gross : line.quantity;
}

function lineRows(invoice: InvoiceDoc, cols: "atelier" | "standard") {
  if (cols === "atelier") {
    return invoice.lines
      .map(
        (line) => `
        <tr>
          <td>${escapeHtml(line.item)}</td>
          <td class="c">${line.quantity}</td>
          <td class="c">${lineGross(line)}</td>
          <td class="r">${money(line.unitPrice)}</td>
          <td class="r">${money(line.amount)}</td>
        </tr>`
      )
      .join("");
  }
  return invoice.lines
    .map(
      (line) => `
      <tr>
        <td>${escapeHtml(line.item)}</td>
        <td class="r">${money(line.unitPrice)}</td>
        <td class="c">${line.quantity}</td>
        <td class="c">${lineGross(line)}</td>
        <td class="r">${money(line.amount)}</td>
      </tr>`
    )
    .join("");
}

function chargeRows(
  charges: Array<{ label: string; amount: number }>,
  cols: "atelier" | "standard",
) {
  if (cols === "atelier") {
    return charges
      .map(
        (c) => `
        <tr>
          <td>${escapeHtml(c.label)}</td>
          <td class="c">—</td>
          <td class="c">—</td>
          <td class="r">—</td>
          <td class="r">${money(c.amount)}</td>
        </tr>`
      )
      .join("");
  }
  return charges
    .map(
      (c) => `
      <tr>
        <td>${escapeHtml(c.label)}</td>
        <td class="r">—</td>
        <td class="c">—</td>
        <td class="c">—</td>
        <td class="r">${money(c.amount)}</td>
      </tr>`
    )
    .join("");
}

function taxLines(company: InvoiceCompany, d: ReturnType<typeof prepare>) {
  if (company.enableGst) {
    return `<div class="line"><span>Tax (${Math.round(d.tax.taxRate * 100)}%)</span><span>${money(d.tax.tax)}</span></div>`;
  }
  if (d.roundOff) {
    return `<div class="line"><span>Round off</span><span>${d.roundOff >= 0 ? "" : "-"}${money(Math.abs(d.roundOff))}</span></div>`;
  }
  return "";
}

const SHARED_CSS = `
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; }
.co-id { display: flex; gap: 10px; align-items: flex-start; min-width: 0; max-width: 58%; }
.co-logo, .co-logo.mark {
  width: 52px; height: 52px; object-fit: contain; border-radius: 50%;
  flex: none; background: transparent;
}
.co-logo.mark {
  display: grid; place-items: center; font-weight: 800; font-size: 18px;
  color: #111; border: 1px solid #ddd; background: #f7f7f7;
}
.co-name { font-size: 15px; font-weight: 800; line-height: 1.2; margin: 0; }
.co-addr, .co-phone { margin-top: 3px; font-size: 10px; line-height: 1.35; color: #555; }
.co-id.dark .co-name, .co-id.dark .co-addr, .co-id.dark .co-phone { color: #fff; }
.co-id.dark .co-logo.mark {
  background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.3); color: #fff;
}
.co-id.dark .co-logo { background: rgba(255,255,255,0.08); }
.label { font-weight: 700; margin: 0 0 6px; font-size: 11px; color: #555; text-transform: none; }
.party strong { font-size: 13px; }
.muted { color: #555; font-size: 10px; line-height: 1.4; }
.c { text-align: center; }
.r { text-align: right; }
.meta { min-width: 170px; max-width: 220px; }
.meta .row {
  display: grid; grid-template-columns: auto 1fr; gap: 10px;
  margin-top: 4px; align-items: baseline;
}
.meta .row span { color: #666; }
.meta .row strong { text-align: right; }
`;

/** 1) Black/white atelier */
function buildAtelier(invoice: InvoiceDoc, company: InvoiceCompany) {
  const d = prepare(invoice, company);
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" />
<title>${escapeHtml(invoice.invoiceNo)}</title>
<style>
@page { size: A4; margin: 12mm; }
${SHARED_CSS}
body {
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  color: #111; font-size: 11px; line-height: 1.45;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.page {
  width: 186mm; min-height: 273mm; margin: 0 auto;
  display: flex; flex-direction: column;
}
.top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
h1.title {
  margin: 0; font-family: Georgia, "Times New Roman", serif;
  font-size: 40px; font-weight: 500; letter-spacing: -0.02em;
}
.meta-grid {
  display: grid; grid-template-columns: 1.2fr auto; gap: 24px;
  margin-top: 24px;
}
table { width: 100%; border-collapse: collapse; margin-top: 22px; }
th {
  text-align: left; font-size: 11px; padding: 10px 0;
  border-bottom: 1px solid #ddd;
}
th.c, td.c { text-align: center; }
th.r, td.r { text-align: right; }
td { padding: 11px 0; border-bottom: 1px solid #eee; vertical-align: top; }
.summary { width: 240px; margin-left: auto; margin-top: 16px; }
.summary .line { display: flex; justify-content: space-between; padding: 5px 0; color: #444; }
.grand {
  margin-top: 8px; background: #111; color: #fff;
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 14px; font-weight: 700; font-size: 16px;
}
.foot {
  display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 20px;
  margin-top: auto; padding-top: 28px; align-items: end;
}
.thanks {
  font-family: Georgia, "Times New Roman", serif;
  font-size: 34px; font-style: italic; color: #222;
  margin: 0 0 14px; display: inline-block;
}
.pay h4, .sender { margin: 0 0 6px; font-size: 12px; }
.sender { text-align: right; color: #444; }
</style></head><body><div class="page">
  <div class="top">
    ${companyIdentity(d)}
    <h1 class="title">${d.title}</h1>
  </div>
  <div class="meta-grid">
    ${partyBlock(invoice, d)}
    <div class="meta">
      <div class="row"><span>Invoice No.</span><strong>${escapeHtml(invoice.invoiceNo)}</strong></div>
      <div class="row"><span>Date</span><strong>${escapeHtml(invoice.invoiceDate)}</strong></div>
      <div class="row"><span>Status</span><strong>${escapeHtml(invoice.paymentStatus)}</strong></div>
    </div>
  </div>
  <table>
    <thead><tr><th>Item</th><th class="c">Qty</th><th class="c">Gross</th><th class="r">Unit Price</th><th class="r">Total</th></tr></thead>
    <tbody>${lineRows(invoice, "atelier")}${chargeRows(d.charges, "atelier")}</tbody>
  </table>
  <div class="summary">
    <div class="line"><span>Subtotal</span><span>${money(d.productsSubtotal + d.chargesTotal)}</span></div>
    ${taxLines(company, d)}
    <div class="grand"><span>Total</span><span>${formatINR(invoice.totalValue)}</span></div>
  </div>
  <div class="foot">
    <div>
      <div class="thanks">Thank You!</div>
      <div class="pay">
        <h4>Payment information</h4>
        <div>${escapeHtml(company.bankName)}</div>
        <div class="muted">Account Name: ${d.companyName}</div>
        <div class="muted">Account No: ${escapeHtml(company.accountNo)}</div>
        <div class="muted">IFSC: ${escapeHtml(company.ifsc)} · UPI: ${escapeHtml(company.upi)}</div>
      </div>
    </div>
    <div class="sender">
      <strong>${d.companyName}</strong>
      <div class="muted">${d.addressLines}</div>
      <div class="muted">Contact: ${d.phone}</div>
    </div>
  </div>
</div></body></html>`;
}

/** 2) Lime geometric edge */
function buildLimeEdge(invoice: InvoiceDoc, company: InvoiceCompany) {
  const d = prepare(invoice, company);
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" />
<title>${escapeHtml(invoice.invoiceNo)}</title>
<style>
@page { size: A4; margin: 0; }
${SHARED_CSS}
body {
  font-family: Arial, Helvetica, sans-serif;
  color: #231f20; font-size: 10.5px; line-height: 1.45;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.page {
  width: 210mm; min-height: 297mm; margin: 0 auto;
  padding: 0 14mm 42px; position: relative;
  display: flex; flex-direction: column;
}
.hero {
  margin: 0 -14mm 16px; height: 40px; display: flex;
  background: linear-gradient(90deg, #231f20 0 46%, #8cc63f 46% 72%, #e6e7e8 72% 100%);
  color: #fff; align-items: center; padding: 0 18px;
  font-size: 20px; font-weight: 800; font-style: italic; letter-spacing: 0.08em;
}
.head {
  display: grid; grid-template-columns: 1.2fr auto; gap: 18px; margin-bottom: 14px;
}
.party-row {
  display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 14px;
}
table { width: 100%; border-collapse: collapse; }
th {
  background: #e6e7e8; color: #231f20; text-transform: uppercase;
  letter-spacing: 0.06em; font-size: 10px; padding: 10px 12px; text-align: left;
}
td { padding: 12px; color: #444; }
.bottom {
  display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 20px;
  margin-top: auto; padding-top: 18px; padding-bottom: 8px;
}
.pay h4, .terms h4 {
  margin: 0 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;
}
.totals .line { display: flex; justify-content: space-between; padding: 4px 0; }
.totals .due { margin-top: 8px; font-size: 15px; font-weight: 800; }
.sign { margin-top: 28px; text-align: right; }
.sign .line {
  border-top: 1px solid #231f20; display: inline-block; min-width: 140px;
  padding-top: 4px; color: #555;
}
.footer {
  position: absolute; left: 0; right: 0; bottom: 0; height: 34px;
  background: #8cc63f; color: #fff; display: flex; align-items: center;
  justify-content: center; font-weight: 800; letter-spacing: 0.1em; font-size: 11px;
}
.footer-mark {
  position: absolute; right: 0; top: 0; bottom: 0; width: 42px; background: #231f20;
}
</style></head><body><div class="page">
  <div class="hero">INVOICE</div>
  <div class="head">
    ${companyIdentity(d)}
    <div class="meta">
      <div class="row"><span>Invoice No</span><strong>${escapeHtml(invoice.invoiceNo)}</strong></div>
      <div class="row"><span>Invoice Date</span><strong>${escapeHtml(invoice.invoiceDate)}</strong></div>
      <div class="row"><span>Due Date</span><strong>${escapeHtml(invoice.dueDate || invoice.invoiceDate)}</strong></div>
    </div>
  </div>
  <div class="party-row">
    ${partyBlock(invoice, d)}
    <div class="party">
      <p class="label">Branch</p>
      <strong>${escapeHtml(invoice.branchName || "—")}</strong>
      <div class="muted">${escapeHtml(invoice.branchRegion || "")}</div>
    </div>
  </div>
  <table>
    <thead><tr><th>Product</th><th class="r">Price</th><th class="c">Qty</th><th class="c">Gross</th><th class="r">Total</th></tr></thead>
    <tbody>${lineRows(invoice, "standard")}${chargeRows(d.charges, "standard")}</tbody>
  </table>
  <div class="bottom">
    <div>
      <div class="pay">
        <h4>Payment Info</h4>
        <div>${escapeHtml(company.bankName)}</div>
        <div class="muted">A/c ${escapeHtml(company.accountNo)} · IFSC ${escapeHtml(company.ifsc)}</div>
        <div class="muted">UPI ${escapeHtml(company.upi)}</div>
      </div>
      <div class="terms" style="margin-top:12px">
        <h4>Terms & Conditions</h4>
        <div class="muted">${escapeHtml(invoice.notes || "Payment due as per agreed terms.")}</div>
      </div>
    </div>
    <div>
      <div class="totals">
        <div class="line"><span>Sub Total</span><span>${money(d.productsSubtotal + d.chargesTotal)}</span></div>
        <div class="line"><span>Tax</span><span>${company.enableGst ? money(d.tax.tax) : money(0)}</span></div>
        <div class="line due"><span>TOTAL DUE</span><span>${formatINR(invoice.totalValue)}</span></div>
      </div>
      <div class="sign"><div class="line">Authorized Sign</div></div>
    </div>
  </div>
  <div class="footer">THANK YOU FOR YOUR BUSINESS<span class="footer-mark" aria-hidden="true"></span></div>
</div></body></html>`;
}

/** 3) Navy + mustard gold */
function buildNavyGold(invoice: InvoiceDoc, company: InvoiceCompany) {
  const d = prepare(invoice, company);
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" />
<title>${escapeHtml(invoice.invoiceNo)}</title>
<style>
@page { size: A4; margin: 0; }
${SHARED_CSS}
body {
  font-family: "Segoe UI", Helvetica, Arial, sans-serif;
  color: #1b2a4a; font-size: 10.5px; line-height: 1.45;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.page {
  width: 210mm; min-height: 297mm; margin: 0 auto; position: relative;
  display: flex; flex-direction: column;
}
.header {
  background: #1b2a4a; color: #fff; padding: 14mm 16mm 16mm;
  display: grid; grid-template-columns: 1.2fr auto; gap: 18px; align-items: start;
}
.right-meta { text-align: right; min-width: 180px; }
.banner {
  display: inline-block; background: #e2b93b; color: #1b2a4a;
  padding: 10px 22px; border-radius: 8px 0 0 8px; margin: 0 -16mm 10px 0;
  font-size: 24px; font-weight: 900; letter-spacing: 0.04em;
}
.right-meta .row { color: #fff; margin-top: 4px; }
.right-meta .row span { opacity: 0.8; margin-right: 8px; }
.body {
  padding: 14mm 16mm 52px; flex: 1; display: flex; flex-direction: column;
}
.billto { margin-bottom: 14px; }
table { width: 100%; border-collapse: collapse; }
th {
  background: #e2b93b; color: #1b2a4a; text-align: left;
  padding: 10px 12px; font-size: 11px; text-transform: uppercase;
}
td { padding: 11px 12px; border-bottom: 1px solid #e5e7eb; }
.summary { width: 230px; margin: 16px 0 0 auto; }
.summary .line { display: flex; justify-content: space-between; padding: 4px 0; }
.total-box {
  margin-top: 8px; background: #e2b93b; color: #1b2a4a;
  padding: 10px 12px; border-radius: 6px; display: flex;
  justify-content: space-between; font-weight: 800; font-size: 14px;
}
.sign { text-align: right; margin-top: auto; padding-top: 24px; color: #6b7280; }
.sign .line {
  border-top: 1px solid #1b2a4a; display: inline-block; min-width: 130px; padding-top: 4px;
}
.footer {
  background: #1b2a4a; color: #fff; padding: 16px 16mm 14px; position: relative;
}
.footer p { margin: 0; font-size: 11px; }
.footer .accent {
  position: absolute; right: 10mm; bottom: 8px; width: 42px; height: 14px; background: #e2b93b;
}
</style></head><body><div class="page">
  <div class="header">
    ${companyIdentity(d, { tone: "dark" })}
    <div class="right-meta">
      <div class="banner">INVOICE</div>
      <div class="row"><span>DATE</span><strong>${escapeHtml(invoice.invoiceDate)}</strong></div>
      <div class="row"><span>INVOICE NO.</span><strong>${escapeHtml(invoice.invoiceNo)}</strong></div>
    </div>
  </div>
  <div class="body">
    <div class="billto">${partyBlock(invoice, d, "Invoice to")}</div>
    <table>
      <thead><tr><th>Description</th><th class="r">Rate</th><th class="c">Qty</th><th class="c">Gross</th><th class="r">Total</th></tr></thead>
      <tbody>${lineRows(invoice, "standard")}${chargeRows(d.charges, "standard")}</tbody>
    </table>
    <div class="summary">
      <div class="line"><span>Sub Total</span><span>${money(d.productsSubtotal + d.chargesTotal)}</span></div>
      <div class="line"><span>Tax</span><span>${company.enableGst ? money(d.tax.tax) : money(0)}</span></div>
      <div class="total-box"><span>Total Amount</span><span>${formatINR(invoice.totalValue)}</span></div>
    </div>
    <div class="sign"><div class="line">Signature</div></div>
  </div>
  <div class="footer">
    <p>Thank you for your business</p>
    <p style="opacity:.85;margin-top:4px">${escapeHtml(company.bankName)} · A/c ${escapeHtml(company.accountNo)} · ${escapeHtml(company.ifsc)}</p>
    <div class="accent"></div>
  </div>
</div></body></html>`;
}

/** 4) Soft wave minimal */
function buildSoftWave(invoice: InvoiceDoc, company: InvoiceCompany) {
  const d = prepare(invoice, company);
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" />
<title>${escapeHtml(invoice.invoiceNo)}</title>
<style>
@page { size: A4; margin: 0; }
${SHARED_CSS}
body {
  font-family: Arial, Helvetica, sans-serif;
  color: #111; font-size: 11px; line-height: 1.45;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.page {
  width: 210mm; min-height: 297mm; margin: 0 auto;
  padding: 14mm 16mm 0; position: relative;
  display: flex; flex-direction: column;
}
.content { flex: 1; padding-bottom: 18px; }
.toprow {
  display: flex; justify-content: space-between; align-items: center; gap: 16px;
}
.no { color: #555; flex: none; }
h1 { margin: 16px 0 4px; font-size: 32px; letter-spacing: 0.04em; }
.date { color: #555; margin-bottom: 18px; }
.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 18px; }
.cols h3 { margin: 0 0 6px; font-size: 11px; }
table { width: 100%; border-collapse: collapse; }
th { background: #e5e5e5; text-align: left; padding: 10px 12px; font-size: 11px; }
td { padding: 11px 12px; border-bottom: 1px solid #eee; }
.total-row td { border-bottom: 0; font-weight: 800; padding-top: 14px; }
.notes { margin-top: 16px; color: #444; }
.pay {
  margin-top: 12px; padding: 10px 12px; background: #f7f7f7; border-radius: 6px;
}
.waves { height: 78px; margin: 18px -16mm 0; overflow: hidden; }
.waves svg { display: block; width: 100%; height: 90px; }
</style></head><body><div class="page">
  <div class="content">
    <div class="toprow">
      ${companyIdentity(d)}
      <div class="no">NO. ${escapeHtml(invoice.invoiceNo)}</div>
    </div>
    <h1>INVOICE</h1>
    <div class="date">Date: ${escapeHtml(invoice.invoiceDate)}</div>
    <div class="cols">
      ${partyBlock(invoice, d)}
      <div class="party">
        <p class="label">From</p>
        <strong>${d.companyName}</strong>
        <div class="muted">${d.addressLines}</div>
        <div class="muted">Contact: ${d.phone}</div>
      </div>
    </div>
    <table>
      <thead><tr><th>Item</th><th class="c">Qty</th><th class="c">Gross</th><th class="r">Price</th><th class="r">Amount</th></tr></thead>
      <tbody>
        ${lineRows(invoice, "atelier")}${chargeRows(d.charges, "atelier")}
        <tr class="total-row">
          <td colspan="4" class="r">Total</td>
          <td class="r">${formatINR(invoice.totalValue)}</td>
        </tr>
      </tbody>
    </table>
    <div class="notes">
      <div><strong>Payment method:</strong> ${escapeHtml(invoice.paymentMethod || "—")}</div>
      <div style="margin-top:6px"><strong>Note:</strong> ${escapeHtml(invoice.notes || "Thank you for choosing us!")}</div>
    </div>
    <div class="pay">
      <strong>Payment information</strong>
      <div class="muted" style="margin-top:4px">${escapeHtml(company.bankName)} · A/c ${escapeHtml(company.accountNo)}</div>
      <div class="muted">IFSC ${escapeHtml(company.ifsc)} · UPI ${escapeHtml(company.upi)}</div>
    </div>
  </div>
  <div class="waves" aria-hidden="true">
    <svg viewBox="0 0 210 90" preserveAspectRatio="none">
      <path d="M0,40 C40,10 80,70 120,45 C160,20 190,55 210,35 L210,90 L0,90 Z" fill="#cfcfcf"/>
      <path d="M0,62 C50,40 90,85 140,60 C170,45 195,70 210,58 L210,90 L0,90 Z" fill="#333"/>
    </svg>
  </div>
</div></body></html>`;
}

export function isGalleryTemplate(value: string): value is GalleryTemplateId {
  return value === "atelier" || value === "limeEdge" || value === "navyGold" || value === "softWave";
}

export function buildGalleryInvoiceHtml(
  invoice: InvoiceDoc,
  company: InvoiceCompany,
  template: GalleryTemplateId,
) {
  if (template === "limeEdge") return buildLimeEdge(invoice, company);
  if (template === "navyGold") return buildNavyGold(invoice, company);
  if (template === "softWave") return buildSoftWave(invoice, company);
  return buildAtelier(invoice, company);
}
