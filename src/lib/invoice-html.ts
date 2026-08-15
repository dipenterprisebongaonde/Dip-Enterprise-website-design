import fs from "node:fs";
import {
  InvoiceCompany,
  InvoiceDoc,
  amountInWords,
  formatINR,
  gstRateFromPercent,
  taxableFromTotal,
} from "@/lib/invoice";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function logoDataUri(logoPath?: string) {
  if (!logoPath || !fs.existsSync(logoPath)) return null;
  try {
    const buffer = fs.readFileSync(logoPath);
    const ext = logoPath.toLowerCase().split(".").pop() || "png";
    const mime =
      ext === "jpg" || ext === "jpeg"
        ? "image/jpeg"
        : ext === "webp"
          ? "image/webp"
          : ext === "svg"
            ? "image/svg+xml"
            : "image/png";
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

function partyLabel(type: InvoiceDoc["type"]) {
  return type === "sale" ? "Bill To" : "Vendor";
}

function docTitle(type: InvoiceDoc["type"]) {
  return type === "sale" ? "Tax Invoice" : "Purchase Bill";
}

export function buildInvoiceHtml(invoice: InvoiceDoc, company: InvoiceCompany) {
  const logo = logoDataUri(company.logoPath);
  const rate = gstRateFromPercent(company.gstPercent);
  const tax = taxableFromTotal(invoice.totalValue, rate, company.enableGst);
  const gstPct = Math.round(tax.taxRate * 100);
  const isSale = invoice.type === "sale";

  const productsSubtotal = invoice.lines.reduce((sum, line) => sum + line.amount, 0);
  const charges = invoice.charges || [];

  const rows = invoice.lines
    .map((line, index) => {
      const lineTax = taxableFromTotal(line.amount, rate, company.enableGst);
      return `
        <tr>
          <td class="center">${index + 1}</td>
          <td class="desc">${escapeHtml(line.item)}</td>
          <td class="right">${line.quantity}</td>
          <td class="right">${line.gross}</td>
          <td class="right">${formatINR(line.unitPrice)}</td>
          <td class="right">${formatINR(lineTax.taxable)}</td>
          ${
            company.enableGst
              ? `<td class="right">${formatINR(lineTax.tax)}</td>`
              : ""
          }
          <td class="right amount">${formatINR(line.amount)}</td>
        </tr>`;
    })
    .join("");

  const chargeDetailRows = charges
    .map(
      (charge) => `
          <div class="t-row"><span>${escapeHtml(charge.label)}</span><strong>${formatINR(charge.amount)}</strong></div>`
    )
    .join("");

  const minRows = 6;
  const blankCount = Math.max(0, minRows - invoice.lines.length);
  const blankRows = Array.from({ length: blankCount })
    .map(
      () => `
        <tr class="blank">
          <td class="center">&nbsp;</td>
          <td>&nbsp;</td>
          <td class="right">&nbsp;</td>
          <td class="right">&nbsp;</td>
          <td class="right">&nbsp;</td>
          <td class="right">&nbsp;</td>
          ${company.enableGst ? `<td class="right">&nbsp;</td>` : ""}
          <td class="right">&nbsp;</td>
        </tr>`
    )
    .join("");

  const addressLines = company.address
    .split(/\n+/)
    .map((line) => escapeHtml(line.trim()))
    .filter(Boolean)
    .join("<br />");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(invoice.invoiceNo)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Source+Sans+3:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    @page {
      size: A4 portrait;
      margin: 14mm 14mm 16mm;
    }
    :root {
      --ink: #152033;
      --ink-soft: #3a4558;
      --muted: #6b7383;
      --line: #d8dce4;
      --line-strong: #1b2a44;
      --paper: #fbfaf7;
      --band: #f3f0e8;
      --accent: #8a7348;
      --navy: #1b2a44;
      --navy-deep: #0f1a2c;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
    }
    body {
      font-family: "Source Sans 3", "Segoe UI", Helvetica, Arial, sans-serif;
      color: var(--ink);
      font-size: 10pt;
      line-height: 1.45;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sheet {
      width: 182mm;
      min-height: 267mm;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      background: var(--paper);
      padding: 2mm 0 0;
    }
    .sheet-main { flex: 1 1 auto; }
    .sheet-foot { margin-top: auto; padding-top: 8mm; }

    .masthead {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      padding-bottom: 10px;
    }
    .brand {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      min-width: 0;
      flex: 1;
    }
    .brand img {
      width: 48px;
      height: 48px;
      object-fit: contain;
      flex-shrink: 0;
    }
    .brand-mark {
      width: 48px;
      height: 48px;
      border: 1.5px solid var(--navy);
      display: grid;
      place-items: center;
      color: var(--navy);
      font-family: "Cormorant Garamond", Georgia, serif;
      font-weight: 700;
      font-size: 16pt;
      letter-spacing: 0.04em;
      flex-shrink: 0;
    }
    .brand h1 {
      margin: 0;
      font-family: "Cormorant Garamond", Georgia, "Times New Roman", serif;
      font-size: 22pt;
      font-weight: 700;
      letter-spacing: 0.04em;
      color: var(--navy-deep);
      line-height: 1.05;
      text-transform: uppercase;
    }
    .brand .legal {
      margin: 2px 0 0;
      color: var(--muted);
      font-size: 8.5pt;
      font-weight: 500;
      letter-spacing: 0.02em;
    }
    .brand .meta {
      margin: 7px 0 0;
      color: var(--ink-soft);
      font-size: 8.5pt;
      line-height: 1.4;
    }
    .doc-side {
      text-align: right;
      min-width: 52mm;
      flex-shrink: 0;
      padding-top: 2px;
    }
    .doc-side .kicker {
      margin: 0;
      font-size: 8pt;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: var(--accent);
      font-weight: 600;
    }
    .doc-side h2 {
      margin: 4px 0 8px;
      font-family: "Cormorant Garamond", Georgia, serif;
      font-size: 18pt;
      font-weight: 600;
      color: var(--navy-deep);
      line-height: 1.1;
    }
    .doc-side .meta-line {
      margin: 0;
      font-size: 8.5pt;
      color: var(--ink-soft);
    }
    .doc-side .meta-line strong {
      color: var(--ink);
      font-weight: 600;
    }
    .doc-side .inv-no {
      margin: 0 0 6px;
      font-size: 10.5pt;
      font-weight: 700;
      color: var(--navy);
      letter-spacing: 0.02em;
    }

    .rule {
      height: 0;
      border: 0;
      border-top: 1.5px solid var(--line-strong);
      margin: 0 0 2px;
    }
    .rule-thin {
      height: 0;
      border: 0;
      border-top: 0.5px solid var(--accent);
      margin: 0 0 12px;
      opacity: 0.85;
    }

    .parties {
      display: grid;
      grid-template-columns: 1.15fr 0.95fr;
      gap: 14px;
      margin-bottom: 14px;
    }
    .party h3,
    .pay h3 {
      margin: 0 0 5px;
      font-size: 7.5pt;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--accent);
      font-weight: 700;
    }
    .party .name {
      margin: 0 0 3px;
      font-family: "Cormorant Garamond", Georgia, serif;
      font-size: 13pt;
      font-weight: 600;
      color: var(--navy-deep);
    }
    .party p,
    .pay p {
      margin: 1px 0;
      color: var(--ink-soft);
      font-size: 9pt;
    }
    .pay strong { color: var(--ink); font-weight: 600; }

    table.items {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
      table-layout: fixed;
    }
    table.items thead th {
      background: var(--navy);
      color: #f7f4ec;
      font-size: 7.5pt;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding: 8px 7px;
      text-align: left;
      border: 0;
    }
    table.items th.right,
    table.items td.right { text-align: right; }
    table.items th.center,
    table.items td.center { text-align: center; }
    table.items td {
      padding: 7px;
      border-bottom: 0.5px solid var(--line);
      vertical-align: top;
      font-size: 9pt;
      color: var(--ink);
      height: 7.5mm;
    }
    table.items td.desc { font-weight: 500; }
    table.items td.amount { font-weight: 600; }
    table.items tbody tr:nth-child(even) td { background: rgba(243, 240, 232, 0.45); }
    table.items tr.blank td {
      color: transparent;
      border-bottom: 0.5px solid #ece8df;
      background: transparent;
    }

    .summary {
      display: grid;
      grid-template-columns: 1.2fr 0.9fr;
      gap: 16px;
      align-items: start;
      margin-bottom: 12px;
    }
    .words {
      padding: 10px 0 0;
      border-top: 0.5px solid var(--line);
    }
    .words .label {
      margin: 0 0 4px;
      font-size: 7.5pt;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--accent);
      font-weight: 700;
    }
    .words strong {
      display: block;
      font-family: "Cormorant Garamond", Georgia, serif;
      font-size: 12pt;
      font-weight: 600;
      color: var(--navy-deep);
      line-height: 1.3;
    }
    .notes {
      margin-top: 8px;
      color: var(--ink-soft);
      font-size: 8.5pt;
    }
    .totals {
      border-top: 1.5px solid var(--navy);
      border-bottom: 1.5px solid var(--navy);
      padding: 2px 0;
    }
    .t-row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 5px 2px;
      font-size: 9pt;
      border-bottom: 0.5px solid #ebe6db;
    }
    .t-row:last-child { border-bottom: 0; }
    .t-row span { color: var(--ink-soft); }
    .t-row strong { color: var(--ink); font-weight: 600; }
    .t-row.grand {
      background: var(--band);
      margin: 2px -2px;
      padding: 8px 8px;
      border-bottom: 0;
    }
    .t-row.grand span,
    .t-row.grand strong {
      color: var(--navy-deep);
      font-family: "Cormorant Garamond", Georgia, serif;
      font-size: 12pt;
      font-weight: 700;
      letter-spacing: 0.02em;
    }

    .bank {
      margin-top: 4px;
      padding: 10px 0 0;
      border-top: 0.5px solid var(--line);
    }
    .bank h3 {
      margin: 0 0 6px;
      font-size: 7.5pt;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--accent);
      font-weight: 700;
    }
    .bank-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 3px 18px;
    }
    .bank-grid p {
      margin: 0;
      color: var(--ink-soft);
      font-size: 8.5pt;
    }
    .bank-grid strong { color: var(--ink); font-weight: 600; }

    .sign {
      display: flex;
      justify-content: space-between;
      gap: 20px;
      margin-top: 16mm;
    }
    .sign .box {
      width: 40%;
      text-align: center;
      border-top: 1px solid var(--navy);
      padding-top: 6px;
      color: var(--muted);
      font-size: 8pt;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .footer {
      margin: 10px 0 0;
      text-align: center;
      color: var(--muted);
      font-size: 7.5pt;
      letter-spacing: 0.04em;
    }
    .footer em {
      font-style: normal;
      color: var(--accent);
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="sheet-main">
      <div class="masthead">
        <div class="brand">
          ${
            logo
              ? `<img src="${logo}" alt="Logo" />`
              : `<div class="brand-mark">D</div>`
          }
          <div>
            <h1>${escapeHtml(company.name)}</h1>
            <p class="legal">${escapeHtml(company.legalName)}</p>
            <div class="meta">
              ${addressLines}<br />
              ${escapeHtml(company.phone)}${company.email ? ` · ${escapeHtml(company.email)}` : ""}
              ${company.enableGst && company.gstin ? `<br />GSTIN ${escapeHtml(company.gstin)}` : ""}
            </div>
          </div>
        </div>
        <div class="doc-side">
          <p class="kicker">${isSale ? "Commercial document" : "Accounts payable"}</p>
          <h2>${docTitle(invoice.type)}</h2>
          <p class="inv-no">${escapeHtml(invoice.invoiceNo)}</p>
          <p class="meta-line">Date <strong>${escapeHtml(invoice.invoiceDate)}</strong></p>
          <p class="meta-line">Branch <strong>${escapeHtml(invoice.branchName)}</strong></p>
          <p class="meta-line">Status <strong>${escapeHtml(invoice.paymentStatus)}</strong></p>
        </div>
      </div>

      <hr class="rule" />
      <hr class="rule-thin" />

      <div class="parties">
        <div class="party">
          <h3>${partyLabel(invoice.type)}</h3>
          <p class="name">${escapeHtml(invoice.partyName)}</p>
          ${invoice.partyPhone ? `<p>${escapeHtml(invoice.partyPhone)}</p>` : ""}
          ${invoice.partyAddress ? `<p>${escapeHtml(invoice.partyAddress)}</p>` : ""}
        </div>
        <div class="pay">
          <h3>Payment</h3>
          <p>Paid <strong>${formatINR(invoice.paidAmount)}</strong></p>
          <p>Due <strong>${formatINR(invoice.dueAmount)}</strong></p>
          ${invoice.paymentMethod ? `<p>Method <strong>${escapeHtml(invoice.paymentMethod)}</strong></p>` : ""}
          ${invoice.paidAt ? `<p>Last paid <strong>${escapeHtml(invoice.paidAt)}</strong></p>` : ""}
        </div>
      </div>

      <table class="items">
        <thead>
          <tr>
            <th class="center" style="width:9mm">#</th>
            <th>Description</th>
            <th class="right" style="width:13mm">Qty</th>
            <th class="right" style="width:13mm">Gross</th>
            <th class="right" style="width:22mm">Rate</th>
            <th class="right" style="width:24mm">Taxable</th>
            ${company.enableGst ? `<th class="right" style="width:20mm">GST ${gstPct}%</th>` : ""}
            <th class="right" style="width:24mm">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          ${blankRows}
        </tbody>
      </table>

      <div class="summary">
        <div class="words">
          <p class="label">Amount in words</p>
          <strong>${escapeHtml(amountInWords(invoice.totalValue))}</strong>
          ${
            invoice.notes
              ? `<p class="notes"><strong>Notes</strong> — ${escapeHtml(invoice.notes)}</p>`
              : ""
          }
        </div>
        <div class="totals">
          <div class="t-row"><span>Products total</span><strong>${formatINR(productsSubtotal)}</strong></div>
          ${charges.length ? chargeDetailRows : ""}
          ${
            company.enableGst
              ? `<div class="t-row"><span>Taxable value</span><strong>${formatINR(tax.taxable)}</strong></div>
                 <div class="t-row"><span>GST (${gstPct}%)</span><strong>${formatINR(tax.tax)}</strong></div>`
              : ""
          }
          <div class="t-row"><span>Round off</span><strong>${
            invoice.roundOff
              ? `${invoice.roundOff >= 0 ? "+" : "−"}${formatINR(Math.abs(invoice.roundOff))}`
              : formatINR(0)
          }</strong></div>
          <div class="t-row grand"><span>Grand total</span><strong>${formatINR(invoice.totalValue)}</strong></div>
          <div class="t-row"><span>Amount paid</span><strong>${formatINR(invoice.paidAmount)}</strong></div>
          <div class="t-row"><span>Balance due</span><strong>${formatINR(invoice.dueAmount)}</strong></div>
        </div>
      </div>

      <div class="bank">
        <h3>Bank details</h3>
        <div class="bank-grid">
          <p>Bank <strong>${escapeHtml(company.bankName || "—")}</strong></p>
          <p>A/C <strong>${escapeHtml(company.accountNo || "—")}</strong></p>
          <p>IFSC <strong>${escapeHtml(company.ifsc || "—")}</strong></p>
          <p>Branch <strong>${escapeHtml(company.branch || "—")}</strong></p>
          <p>UPI <strong>${escapeHtml(company.upi || "—")}</strong></p>
        </div>
      </div>
    </div>

    <div class="sheet-foot">
      <div class="sign">
        <div class="box">Received by</div>
        <div class="box">For ${escapeHtml(company.name)}</div>
      </div>
      <p class="footer">Computer-generated document · <em>${escapeHtml(company.name)}</em></p>
    </div>
  </div>
</body>
</html>`;
}
