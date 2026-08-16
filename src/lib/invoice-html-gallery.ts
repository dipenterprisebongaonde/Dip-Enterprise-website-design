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
  const logo = logoDataUri(company.logoPath);
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
  const addressInline = escapeHtml(
    company.address
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .join(", ") || "—"
  );
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
    addressInline,
    phone,
    partyAddress,
    isSale,
    title: isSale ? "Invoice" : "Purchase Bill",
    partyLabel: isSale ? "Billed to" : "Supplier",
    companyName: escapeHtml(company.name || "Company"),
  };
}

function logoBlock(logo: string | null, mark: string, className = "logo") {
  return logo
    ? `<img class="${className}" src="${logo}" alt="" />`
    : `<div class="${className} mark">${mark}</div>`;
}

/** Shared company identity block: logo + name + address + contact. */
function companyIdentity(
  d: ReturnType<typeof prepare>,
  options?: { tone?: "light" | "dark"; compact?: boolean },
) {
  const tone = options?.tone || "light";
  const compact = Boolean(options?.compact);
  return `
    <div class="co-id ${tone}${compact ? " compact" : ""}">
      ${logoBlock(d.logo, d.mark, "co-logo")}
      <div class="co-copy">
        <div class="co-name">${d.companyName}</div>
        <div class="co-addr">${d.addressLines}</div>
        <div class="co-phone">Contact: ${d.phone}</div>
      </div>
    </div>`;
}

const COMPANY_ID_CSS = `
.co-id {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  min-width: 0;
}
.co-id.compact .co-logo, .co-id.compact .co-logo.mark {
  width: 40px;
  height: 40px;
}
.co-logo, .co-logo.mark {
  width: 52px;
  height: 52px;
  object-fit: contain;
  border-radius: 8px;
  flex: none;
  background: #fff;
}
.co-logo.mark {
  display: grid;
  place-items: center;
  font-weight: 800;
  font-size: 18px;
  color: #111;
  border: 1px solid #ddd;
}
.co-name {
  font-size: 15px;
  font-weight: 800;
  line-height: 1.2;
  margin: 0;
}
.co-addr, .co-phone {
  margin-top: 3px;
  font-size: 10px;
  line-height: 1.35;
  opacity: 0.9;
}
.co-id.dark .co-name,
.co-id.dark .co-addr,
.co-id.dark .co-phone { color: #fff; }
.co-id.dark .co-logo.mark {
  background: rgba(255,255,255,0.12);
  border-color: rgba(255,255,255,0.28);
  color: #fff;
}
`;

/** 1) Black/white atelier — serif title, black total bar, script thank you */
function buildAtelier(invoice: InvoiceDoc, company: InvoiceCompany) {
  const d = prepare(invoice, company);
  const rows = invoice.lines
    .map(
      (line) => `
      <tr>
        <td>${escapeHtml(line.item)}</td>
        <td class="c">${line.quantity}</td>
        <td class="c">${money(line.unitPrice)}</td>
        <td class="r">${money(line.amount)}</td>
      </tr>`
    )
    .join("");
  const chargeRows = d.charges
    .map(
      (c) => `
      <tr>
        <td>${escapeHtml(c.label)}</td>
        <td class="c">—</td>
        <td class="c">—</td>
        <td class="r">${money(c.amount)}</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" />
<title>${escapeHtml(invoice.invoiceNo)}</title>
<style>
@page { size: A4; margin: 14mm; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; }
body {
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  color: #111;
  font-size: 11px;
  line-height: 1.45;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.page { width: 182mm; min-height: 269mm; margin: 0 auto; position: relative; }
.top { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; }
${COMPANY_ID_CSS}
h1.title {
  margin: 0; font-family: Georgia, "Times New Roman", serif;
  font-size: 42px; font-weight: 500; letter-spacing: -0.02em;
}
.meta-grid {
  display: grid; grid-template-columns: 1.2fr 1fr; gap: 24px;
  margin-top: 28px;
}
.label { font-weight: 700; margin: 0 0 6px; }
.party, .meta { color: #333; }
.meta .row { display: flex; justify-content: space-between; gap: 12px; margin-top: 4px; }
.meta .row span { color: #777; }
table { width: 100%; border-collapse: collapse; margin-top: 28px; }
th {
  text-align: left; font-size: 11px; padding: 10px 0;
  border-bottom: 1px solid #ddd; color: #111;
}
th.c, td.c { text-align: center; }
th.r, td.r { text-align: right; }
td { padding: 12px 0; border-bottom: 1px solid #eee; vertical-align: top; }
.summary {
  width: 240px; margin-left: auto; margin-top: 18px;
}
.summary .line {
  display: flex; justify-content: space-between; padding: 5px 0; color: #444;
}
.grand {
  margin-top: 8px; background: #111; color: #fff;
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 14px; font-weight: 700; font-size: 16px;
}
.foot {
  display: grid; grid-template-columns: 1.1fr 1fr; gap: 20px;
  margin-top: 42px; align-items: end;
}
.thanks {
  font-family: "Segoe Script", "Brush Script MT", cursive;
  font-size: 42px; color: #222; transform: rotate(-6deg);
  display: inline-block; margin: 8px 0 18px;
}
.pay h4, .sender { margin: 0 0 6px; font-size: 12px; }
.sender { text-align: right; color: #444; }
.muted { color: #777; font-size: 10px; }
</style></head><body><div class="page">
  <div class="top">
    ${companyIdentity(d)}
    <h1 class="title">${d.title}</h1>
  </div>
  <div class="meta-grid">
    <div class="party">
      <p class="label">${d.partyLabel}:</p>
      <strong>${escapeHtml(invoice.partyName || "—")}</strong>
      <div class="muted">${d.partyAddress}</div>
      ${invoice.partyPhone ? `<div class="muted">${escapeHtml(invoice.partyPhone)}</div>` : ""}
    </div>
    <div class="meta">
      <div class="row"><span>Invoice No.</span><strong>${escapeHtml(invoice.invoiceNo)}</strong></div>
      <div class="row"><span>Date</span><strong>${escapeHtml(invoice.invoiceDate)}</strong></div>
      <div class="row"><span>Status</span><strong>${escapeHtml(invoice.paymentStatus)}</strong></div>
    </div>
  </div>
  <table>
    <thead><tr><th>Item</th><th class="c">Quantity</th><th class="c">Unit Price</th><th class="r">Total</th></tr></thead>
    <tbody>${rows}${chargeRows}</tbody>
  </table>
  <div class="summary">
    <div class="line"><span>Subtotal</span><span>${money(d.productsSubtotal + d.chargesTotal)}</span></div>
    ${
      company.enableGst
        ? `<div class="line"><span>Tax (${Math.round(d.tax.taxRate * 100)}%)</span><span>${money(d.tax.tax)}</span></div>`
        : d.roundOff
          ? `<div class="line"><span>Round off</span><span>${d.roundOff >= 0 ? "" : "-"}${money(Math.abs(d.roundOff))}</span></div>`
          : ""
    }
    <div class="grand"><span>Total</span><span>${formatINR(invoice.totalValue)}</span></div>
  </div>
  <div class="foot">
    <div>
      <div class="thanks">Thank You!</div>
      <div class="pay">
        <h4>Payment information</h4>
        <div>${escapeHtml(company.bankName)}</div>
        <div class="muted">Account Name: ${escapeHtml(company.name)}</div>
        <div class="muted">Account No: ${escapeHtml(company.accountNo)}</div>
        <div class="muted">IFSC: ${escapeHtml(company.ifsc)} · UPI: ${escapeHtml(company.upi)}</div>
      </div>
    </div>
    <div class="sender">
      <strong>${escapeHtml(company.name)}</strong>
      <div class="muted">${d.addressLines}</div>
      <div class="muted">${escapeHtml(company.phone)}</div>
    </div>
  </div>
</div></body></html>`;
}

/** 2) Lime geometric edge — dark slash header + green footer */
function buildLimeEdge(invoice: InvoiceDoc, company: InvoiceCompany) {
  const d = prepare(invoice, company);
  const rows = invoice.lines
    .map(
      (line) => `
      <tr>
        <td>${escapeHtml(line.item)}</td>
        <td class="r">${money(line.unitPrice)}</td>
        <td class="c">${line.quantity}</td>
        <td class="r">${money(line.amount)}</td>
      </tr>`
    )
    .join("");
  const chargeRows = d.charges
    .map(
      (c) => `
      <tr>
        <td>${escapeHtml(c.label)}</td>
        <td class="r">—</td>
        <td class="c">—</td>
        <td class="r">${money(c.amount)}</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" />
<title>${escapeHtml(invoice.invoiceNo)}</title>
<style>
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; }
body {
  font-family: Arial, Helvetica, sans-serif;
  color: #231f20;
  font-size: 10.5px;
  line-height: 1.45;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.page {
  width: 210mm; min-height: 297mm; margin: 0 auto;
  padding: 0 14mm 18mm; position: relative; overflow: hidden;
}
.hero {
  margin: 0 -14mm 18px; height: 42px; display: flex; align-items: stretch;
}
.hero-dark {
  background: #231f20; color: #fff; flex: 0 0 48%;
  clip-path: polygon(0 0, 100% 0, 88% 100%, 0 100%);
  display: flex; align-items: center; padding: 0 18px;
  font-size: 22px; font-weight: 800; font-style: italic; letter-spacing: 0.08em;
}
.hero-lime {
  background: #8cc63f; flex: 0 0 28%;
  margin-left: -18px;
  clip-path: polygon(18% 0, 100% 0, 82% 100%, 0 100%);
}
.hero-gray {
  background: #e6e7e8; flex: 1;
  margin-left: -14px;
  clip-path: polygon(22% 0, 100% 0, 100% 100%, 0 100%);
}
.head {
  display: grid; grid-template-columns: 1.2fr 1fr; gap: 18px; margin-bottom: 18px;
}
${COMPANY_ID_CSS}
.muted { color: #666; }
.meta .row { display: flex; justify-content: space-between; margin-top: 4px; }
.meta .row span { color: #777; }
table { width: 100%; border-collapse: collapse; }
th {
  background: #e6e7e8; color: #231f20; text-transform: uppercase;
  letter-spacing: 0.06em; font-size: 10px; padding: 10px 12px; text-align: left;
}
th.c, td.c { text-align: center; }
th.r, td.r { text-align: right; }
td { padding: 14px 12px; color: #666; border-bottom: 0; }
.bottom {
  display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 20px; margin-top: 28px;
}
.pay h4, .terms h4 { margin: 0 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
.totals .line { display: flex; justify-content: space-between; padding: 4px 0; }
.totals .due { margin-top: 8px; font-size: 15px; font-weight: 800; }
.sign { margin-top: 36px; text-align: right; }
.sign .line { border-top: 1px solid #231f20; display: inline-block; min-width: 140px; padding-top: 4px; color: #666; }
.footer {
  position: absolute; left: 0; right: 0; bottom: 0; height: 34px;
  background: #8cc63f; color: #fff; display: flex; align-items: center; justify-content: center;
  font-weight: 800; letter-spacing: 0.12em; font-size: 11px;
}
.footer::after {
  content: ""; position: absolute; right: 0; top: 0; bottom: 0; width: 54px;
  background: #231f20; clip-path: polygon(40% 0, 100% 0, 100% 100%, 0 100%);
}
</style></head><body><div class="page">
  <div class="hero">
    <div class="hero-dark">INVOICE</div>
    <div class="hero-lime"></div>
    <div class="hero-gray"></div>
  </div>
  <div class="head">
    ${companyIdentity(d)}
    <div class="meta">
      <div class="row"><span>Invoice No</span><strong>${escapeHtml(invoice.invoiceNo)}</strong></div>
      <div class="row"><span>Invoice Date</span><strong>${escapeHtml(invoice.invoiceDate)}</strong></div>
      <div class="row"><span>Due Date</span><strong>${escapeHtml(invoice.dueDate || invoice.invoiceDate)}</strong></div>
    </div>
  </div>
  <table>
    <thead><tr><th>Product</th><th class="r">Price</th><th class="c">Qty</th><th class="r">Total</th></tr></thead>
    <tbody>${rows}${chargeRows}</tbody>
  </table>
  <div class="bottom">
    <div>
      <div class="pay">
        <h4>Payment Info</h4>
        <div>${escapeHtml(company.bankName)}</div>
        <div class="muted">A/c ${escapeHtml(company.accountNo)} · IFSC ${escapeHtml(company.ifsc)}</div>
        <div class="muted">UPI ${escapeHtml(company.upi)}</div>
      </div>
      <div class="terms" style="margin-top:14px">
        <h4>Terms & Condition</h4>
        <div class="muted">${escapeHtml(invoice.notes || "Payment due as per agreed terms. Goods once sold are subject to company policy.")}</div>
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
  <div class="footer">THANK YOU FOR YOUR BUSINESS</div>
</div></body></html>`;
}

/** 3) Navy + mustard gold banner */
function buildNavyGold(invoice: InvoiceDoc, company: InvoiceCompany) {
  const d = prepare(invoice, company);
  const rows = invoice.lines
    .map(
      (line) => `
      <tr>
        <td>${escapeHtml(line.item)}</td>
        <td class="r">${money(line.unitPrice)}</td>
        <td class="c">${line.quantity}</td>
        <td class="r">${money(line.amount)}</td>
      </tr>`
    )
    .join("");
  const chargeRows = d.charges
    .map(
      (c) => `
      <tr>
        <td>${escapeHtml(c.label)}</td>
        <td class="r">—</td>
        <td class="c">—</td>
        <td class="r">${money(c.amount)}</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" />
<title>${escapeHtml(invoice.invoiceNo)}</title>
<style>
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; }
body {
  font-family: "Segoe UI", Helvetica, Arial, sans-serif;
  color: #1b2a4a;
  font-size: 10.5px;
  line-height: 1.45;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.page { width: 210mm; min-height: 297mm; margin: 0 auto; position: relative; overflow: hidden; }
.header {
  background: #1b2a4a; color: #fff; padding: 18mm 16mm 22mm;
  position: relative;
}
${COMPANY_ID_CSS}
.co-id.dark .co-logo { background: rgba(255,255,255,0.08); }
.banner {
  position: absolute; right: 0; top: 34px;
  background: #e2b93b; color: #1b2a4a;
  padding: 14px 28px 14px 36px; border-radius: 10px 0 0 10px;
  font-size: 28px; font-weight: 900; letter-spacing: 0.04em;
}
.banner-meta {
  position: absolute; right: 16mm; top: 98px; color: #fff; text-align: right;
  font-size: 10px;
}
.banner-meta strong { display: block; font-size: 12px; }
.body { padding: 16mm 16mm 40mm; }
.billto { margin-bottom: 16px; }
.billto h3 { margin: 0 0 4px; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: #6b7280; }
table { width: 100%; border-collapse: collapse; }
th {
  background: #e2b93b; color: #1b2a4a; text-align: left;
  padding: 10px 12px; font-size: 11px; text-transform: uppercase;
}
th.c, td.c { text-align: center; }
th.r, td.r { text-align: right; }
td { padding: 11px 12px; border-bottom: 1px solid #e5e7eb; }
.summary { width: 230px; margin: 16px 0 0 auto; }
.summary .line { display: flex; justify-content: space-between; padding: 4px 0; }
.total-box {
  margin-top: 8px; background: #e2b93b; color: #1b2a4a;
  padding: 10px 12px; border-radius: 6px; display: flex;
  justify-content: space-between; font-weight: 800; font-size: 14px;
}
.sign { text-align: right; margin-top: 28px; color: #6b7280; }
.sign .line { border-top: 1px solid #1b2a4a; display: inline-block; min-width: 130px; padding-top: 4px; }
.footer {
  position: absolute; left: 0; right: 0; bottom: 0; min-height: 78px;
  background: #1b2a4a; color: #fff; padding: 28px 16mm 14px;
}
.footer::before {
  content: ""; position: absolute; left: 0; right: 0; top: -22px; height: 28px;
  background: #1b2a4a;
  border-radius: 0 80px 0 0;
}
.footer p { margin: 0; font-size: 11px; position: relative; }
.footer .accent {
  position: absolute; right: 0; bottom: 0; width: 48px; height: 18px; background: #e2b93b;
}
</style></head><body><div class="page">
  <div class="header">
    ${companyIdentity(d, { tone: "dark" })}
    <div class="banner">INVOICE</div>
    <div class="banner-meta">
      <div>DATE<strong>${escapeHtml(invoice.invoiceDate)}</strong></div>
      <div style="margin-top:6px">INVOICE NO.<strong>${escapeHtml(invoice.invoiceNo)}</strong></div>
    </div>
  </div>
  <div class="body">
    <div class="billto">
      <h3>Invoice to</h3>
      <strong>${escapeHtml(invoice.partyName || "—")}</strong>
      <div style="color:#6b7280">${d.partyAddress}</div>
    </div>
    <table>
      <thead><tr><th>Description</th><th class="r">Rate</th><th class="c">Quantity</th><th class="r">Total</th></tr></thead>
      <tbody>${rows}${chargeRows}</tbody>
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
    <p style="opacity:.8;margin-top:4px">${escapeHtml(company.bankName)} · A/c ${escapeHtml(company.accountNo)} · ${escapeHtml(company.ifsc)}</p>
    <div class="accent"></div>
  </div>
</div></body></html>`;
}

/** 4) Soft wave minimal */
function buildSoftWave(invoice: InvoiceDoc, company: InvoiceCompany) {
  const d = prepare(invoice, company);
  const rows = invoice.lines
    .map(
      (line) => `
      <tr>
        <td>${escapeHtml(line.item)}</td>
        <td class="c">${line.quantity}</td>
        <td class="r">${money(line.unitPrice)}</td>
        <td class="r">${money(line.amount)}</td>
      </tr>`
    )
    .join("");
  const chargeRows = d.charges
    .map(
      (c) => `
      <tr>
        <td>${escapeHtml(c.label)}</td>
        <td class="c">—</td>
        <td class="r">—</td>
        <td class="r">${money(c.amount)}</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" />
<title>${escapeHtml(invoice.invoiceNo)}</title>
<style>
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; }
body {
  font-family: Arial, Helvetica, sans-serif;
  color: #111;
  font-size: 11px;
  line-height: 1.45;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.page {
  width: 210mm; min-height: 297mm; margin: 0 auto;
  padding: 16mm 16mm 48mm; position: relative; overflow: hidden;
}
.toprow { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
${COMPANY_ID_CSS}
.no { color: #555; flex: none; padding-top: 4px; }
h1 { margin: 18px 0 4px; font-size: 34px; letter-spacing: 0.04em; }
.date { color: #666; margin-bottom: 22px; }
.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 22px; }
.cols h3 { margin: 0 0 6px; font-size: 11px; }
.cols .muted { color: #666; }
table { width: 100%; border-collapse: collapse; }
th {
  background: #e5e5e5; text-align: left; padding: 10px 12px; font-size: 11px;
}
th.c, td.c { text-align: center; }
th.r, td.r { text-align: right; }
td { padding: 12px; border-bottom: 1px solid #eee; }
.total-row td { border-bottom: 0; font-weight: 800; padding-top: 14px; }
.notes { margin-top: 18px; color: #444; }
.waves {
  position: absolute; left: 0; right: 0; bottom: 0; height: 90px; overflow: hidden;
}
.waves svg { position: absolute; left: 0; bottom: 0; width: 100%; height: 110px; }
</style></head><body><div class="page">
  <div class="toprow">
    ${companyIdentity(d)}
    <div class="no">NO. ${escapeHtml(invoice.invoiceNo)}</div>
  </div>
  <h1>INVOICE</h1>
  <div class="date">Date: ${escapeHtml(invoice.invoiceDate)}</div>
  <div class="cols">
    <div>
      <h3>Billed to</h3>
      <strong>${escapeHtml(invoice.partyName || "—")}</strong>
      <div class="muted">${d.partyAddress}</div>
      ${invoice.partyPhone ? `<div class="muted">${escapeHtml(invoice.partyPhone)}</div>` : ""}
    </div>
    <div>
      <h3>From</h3>
      <strong>${d.companyName}</strong>
      <div class="muted">${d.addressLines}</div>
      <div class="muted">Contact: ${d.phone}</div>
    </div>
  </div>
  <table>
    <thead><tr><th>Item</th><th class="c">Quantity</th><th class="r">Price</th><th class="r">Amount</th></tr></thead>
    <tbody>
      ${rows}${chargeRows}
      <tr class="total-row">
        <td colspan="3" class="r">Total</td>
        <td class="r">${formatINR(invoice.totalValue)}</td>
      </tr>
    </tbody>
  </table>
  <div class="notes">
    <div><strong>Payment method:</strong> ${escapeHtml(invoice.paymentMethod || "—")}</div>
    <div style="margin-top:6px"><strong>Note:</strong> ${escapeHtml(invoice.notes || "Thank you for choosing us!")}</div>
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
