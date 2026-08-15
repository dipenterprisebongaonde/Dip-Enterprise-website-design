
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
  return type === "sale" ? "TAX INVOICE" : "PURCHASE BILL";
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
          <td>${escapeHtml(line.item)}</td>
          <td class="right">${line.quantity}</td>
          <td class="right">${line.gross}</td>
          <td class="right">${formatINR(line.unitPrice)}</td>
          <td class="right">${formatINR(lineTax.taxable)}</td>
          ${
            company.enableGst
              ? `<td class="right">${formatINR(lineTax.tax)}</td>`
              : ""
          }
          <td class="right">${formatINR(line.amount)}</td>
        </tr>`;
    })
    .join("");

  const chargeDetailRows = charges
    .map(
      (charge) => `
          <div class="row charge-row"><span>${escapeHtml(charge.label)}</span><strong>${formatINR(charge.amount)}</strong></div>`
    )
    .join("");

  // Pad a few blank rows so short invoices still fill the table area on A4.
  const minRows = 8;
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

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(invoice.invoiceNo)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: 210mm;
      background: #fff;
    }
    body {
      font-family: "Segoe UI", Arial, Helvetica, sans-serif;
      color: #1a1d26;
      font-size: 10.5pt;
      line-height: 1.4;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sheet {
      width: 186mm; /* 210mm - 12mm*2 */
      min-height: 273mm; /* 297mm - 12mm*2 */
      margin: 0 auto;
      display: flex;
      flex-direction: column;
    }
    .sheet-main {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
    }
    .sheet-foot {
      margin-top: auto;
      padding-top: 10mm;
    }

    .top {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      border-bottom: 2px solid #1f2a44;
      padding-bottom: 10px;
      margin-bottom: 12px;
    }
    .brand {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      min-width: 0;
      flex: 1;
    }
    .brand img {
      width: 52px;
      height: 52px;
      object-fit: contain;
      border: 1px solid #e6e8ef;
      border-radius: 6px;
      padding: 3px;
      background: #fff;
      flex-shrink: 0;
    }
    .brand h1 {
      margin: 0 0 2px;
      font-size: 16pt;
      letter-spacing: 0.02em;
      color: #121826;
      line-height: 1.15;
    }
    .brand .legal {
      margin: 0;
      color: #5b6475;
      font-size: 9pt;
    }
    .brand .meta {
      margin: 5px 0 0;
      color: #3d4658;
      font-size: 8.5pt;
      white-space: pre-line;
    }
    .doc-box {
      text-align: right;
      min-width: 58mm;
      flex-shrink: 0;
    }
    .doc-box .badge {
      display: inline-block;
      padding: 4px 9px;
      border-radius: 999px;
      background: ${isSale ? "#eef2ff" : "#f3f4f6"};
      color: ${isSale ? "#3730a3" : "#374151"};
      font-weight: 700;
      font-size: 8pt;
      letter-spacing: 0.06em;
    }
    .doc-box h2 {
      margin: 6px 0 3px;
      font-size: 13pt;
      color: #111827;
      word-break: break-word;
    }
    .doc-box p { margin: 1px 0; color: #4b5563; font-size: 8.5pt; }
    .doc-box strong { color: #111827; }

    .grid {
      display: grid;
      grid-template-columns: 1.15fr 1fr;
      gap: 10px;
      margin-bottom: 12px;
    }
    .card {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 9px 11px;
      background: #fafbfc;
    }
    .card h3 {
      margin: 0 0 6px;
      font-size: 8pt;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #6b7280;
    }
    .card .name {
      margin: 0 0 3px;
      font-size: 11pt;
      font-weight: 700;
      color: #111827;
    }
    .card p { margin: 1px 0; color: #374151; font-size: 9pt; }

    table.items {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
      table-layout: fixed;
    }
    table.items th {
      background: #111827;
      color: #fff;
      font-size: 8pt;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      padding: 7px 6px;
      text-align: left;
    }
    table.items th.right, table.items td.right { text-align: right; }
    table.items th.center, table.items td.center { text-align: center; }
    table.items td {
      padding: 7px 6px;
      border-bottom: 1px solid #e5e7eb;
      vertical-align: top;
      font-size: 9pt;
      height: 8.2mm;
    }
    table.items tr:nth-child(even) td { background: #f9fafb; }
    table.items tr.blank td {
      color: transparent;
      border-bottom: 1px solid #eef0f4;
    }

    .bottom {
      display: grid;
      grid-template-columns: 1.2fr 0.9fr;
      gap: 10px;
      align-items: start;
      margin-bottom: 10px;
    }
    .words {
      border: 1px dashed #d1d5db;
      border-radius: 8px;
      padding: 10px 12px;
      background: #fff;
    }
    .words p { margin: 0 0 4px; color: #6b7280; font-size: 8pt; }
    .words strong { color: #111827; font-size: 10pt; }
    .notes { margin-top: 8px; color: #4b5563; font-size: 8.5pt; }
    .totals {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      overflow: hidden;
    }
    .totals .row {
      display: flex;
      justify-content: space-between;
      padding: 7px 10px;
      border-bottom: 1px solid #eef0f4;
      font-size: 9pt;
    }
    .totals .row:last-child { border-bottom: 0; }
    .totals .row span { color: #4b5563; }
    .totals .row strong { color: #111827; }
    .totals .charge-row span { color: #374151; padding-left: 6px; }
    .totals .section-label {
      background: #f8fafc;
      font-weight: 700;
      font-size: 8pt;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      color: #6b7280;
    }
    .totals .section-label span { color: #6b7280; font-weight: 700; }
    .totals .section-label strong { color: #6b7280; font-weight: 700; }
    .totals .grand {
      background: #111827;
      color: #fff;
    }
    .totals .grand span, .totals .grand strong { color: #fff; }

    .bank {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 10px 12px;
      margin-bottom: 4mm;
    }
    .bank h3 {
      margin: 0 0 6px;
      font-size: 8pt;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #6b7280;
    }
    .bank-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px 14px;
    }
    .bank-grid p { margin: 0; color: #374151; font-size: 8.5pt; }
    .bank-grid strong { color: #111827; }

    .sign {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      margin-top: 14mm;
    }
    .sign .box {
      width: 42%;
      text-align: center;
      border-top: 1px solid #d1d5db;
      padding-top: 6px;
      color: #6b7280;
      font-size: 8.5pt;
    }
    .footer {
      margin: 8px 0 0;
      text-align: center;
      color: #9ca3af;
      font-size: 7.5pt;
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="sheet-main">
      <div class="top">
        <div class="brand">
          ${logo ? `<img src="${logo}" alt="Logo" />` : ""}
          <div>
            <h1>${escapeHtml(company.name)}</h1>
            <p class="legal">${escapeHtml(company.legalName)}</p>
            <p class="meta">${escapeHtml(company.address)}
${escapeHtml(company.phone)}${company.email ? ` · ${escapeHtml(company.email)}` : ""}
${company.enableGst && company.gstin ? `GSTIN: ${escapeHtml(company.gstin)}` : ""}</p>
          </div>
        </div>
        <div class="doc-box">
          <span class="badge">${docTitle(invoice.type)}</span>
          <h2>${escapeHtml(invoice.invoiceNo)}</h2>
          <p>Date: <strong>${escapeHtml(invoice.invoiceDate)}</strong></p>
          <p>Branch: <strong>${escapeHtml(invoice.branchName)}</strong> (${escapeHtml(invoice.branchRegion)})</p>
          <p>Status: <strong>${escapeHtml(invoice.paymentStatus)}</strong></p>
        </div>
      </div>

      <div class="grid">
        <div class="card">
          <h3>${partyLabel(invoice.type)}</h3>
          <p class="name">${escapeHtml(invoice.partyName)}</p>
          ${invoice.partyPhone ? `<p>Phone: ${escapeHtml(invoice.partyPhone)}</p>` : ""}
          ${invoice.partyAddress ? `<p>${escapeHtml(invoice.partyAddress)}</p>` : ""}
        </div>
        <div class="card">
          <h3>Payment</h3>
          <p>Paid: <strong>${formatINR(invoice.paidAmount)}</strong></p>
          <p>Due: <strong>${formatINR(invoice.dueAmount)}</strong></p>
          ${invoice.paymentMethod ? `<p>Method: <strong>${escapeHtml(invoice.paymentMethod)}</strong></p>` : ""}
          ${invoice.paidAt ? `<p>Last paid: <strong>${escapeHtml(invoice.paidAt)}</strong></p>` : ""}
        </div>
      </div>

      <table class="items">
        <thead>
          <tr>
            <th class="center" style="width:9mm">#</th>
            <th>Description</th>
            <th class="right" style="width:14mm">Qty</th>
            <th class="right" style="width:14mm">Gross</th>
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

      <div class="bottom">
        <div class="words">
          <p>Amount in words</p>
          <strong>${escapeHtml(amountInWords(invoice.totalValue))}</strong>
          ${
            invoice.notes
              ? `<p class="notes"><strong>Notes:</strong> ${escapeHtml(invoice.notes)}</p>`
              : ""
          }
        </div>
        <div class="totals">
          <div class="row"><span>Products total</span><strong>${formatINR(productsSubtotal)}</strong></div>
          ${charges.length ? chargeDetailRows : ""}
          ${
            company.enableGst
              ? `<div class="row"><span>Taxable value</span><strong>${formatINR(tax.taxable)}</strong></div>
                 <div class="row"><span>GST (${gstPct}%)</span><strong>${formatINR(tax.tax)}</strong></div>`
              : ""
          }
          <div class="row"><span>Round off</span><strong>${
            invoice.roundOff
              ? `${invoice.roundOff >= 0 ? "+" : "−"}${formatINR(Math.abs(invoice.roundOff))}`
              : formatINR(0)
          }</strong></div>
          <div class="row grand"><span>Grand total</span><strong>${formatINR(invoice.totalValue)}</strong></div>
          <div class="row"><span>Amount paid</span><strong>${formatINR(invoice.paidAmount)}</strong></div>
          <div class="row"><span>Balance due</span><strong>${formatINR(invoice.dueAmount)}</strong></div>
        </div>
      </div>

      <div class="bank">
        <h3>Bank details</h3>
        <div class="bank-grid">
          <p>Bank: <strong>${escapeHtml(company.bankName || "—")}</strong></p>
          <p>A/C: <strong>${escapeHtml(company.accountNo || "—")}</strong></p>
          <p>IFSC: <strong>${escapeHtml(company.ifsc || "—")}</strong></p>
          <p>Branch: <strong>${escapeHtml(company.branch || "—")}</strong></p>
          <p>UPI: <strong>${escapeHtml(company.upi || "—")}</strong></p>
        </div>
      </div>
    </div>

    <div class="sheet-foot">
      <div class="sign">
        <div class="box">Received by</div>
        <div class="box">For ${escapeHtml(company.name)}</div>
      </div>
      <p class="footer">Computer-generated invoice · ${escapeHtml(company.name)}</p>
    </div>
  </div>
</body>
</html>`;
}
