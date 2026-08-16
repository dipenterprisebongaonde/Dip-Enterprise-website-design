import {
  InvoiceCompany,
  InvoiceDoc,
  amountInWords,
  formatINR,
} from "@/lib/invoice";
import { escapeHtml, logoDataUri } from "@/lib/invoice-pdf-assets";

export type ThermalWidth = 58 | 80;

function money(value: number) {
  return formatINR(value).replace(/^₹\s?/, "Rs ");
}

/**
 * 80mm (or 58mm) thermal receipt.
 * Content uses full page width with ≥3mm inner side padding — do not set
 * `.receipt` to paperMm while also applying @page margins (that overflows).
 */
export function buildThermalInvoiceHtml(
  invoice: InvoiceDoc,
  company: InvoiceCompany,
  width: ThermalWidth = 80,
  options?: { interactive?: boolean; autoprint?: boolean },
) {
  const interactive = options?.interactive !== false;
  const autoprint = Boolean(options?.autoprint);
  const paperMm = width;
  const productsSubtotal = invoice.lines.reduce((sum, line) => sum + line.amount, 0);
  const charges = invoice.charges || [];
  const title = invoice.type === "sale" ? "TAX INVOICE" : "PURCHASE BILL";
  const partyLabel = invoice.type === "sale" ? "Customer" : "Vendor";
  const compact = paperMm === 58;

  const lineRows = invoice.lines
    .map(
      (line, index) => `
      <tr>
        <td class="item-name">${index + 1}. ${escapeHtml(line.item)}</td>
        <td class="num">${line.quantity}</td>
        <td class="num">${money(line.unitPrice)}</td>
        <td class="num">${money(line.amount)}</td>
      </tr>`,
    )
    .join("");

  const chargeRows = charges
    .map(
      (charge) => `
      <div class="row">
        <span>${escapeHtml(charge.label)}</span>
        <strong>${money(charge.amount)}</strong>
      </div>`,
    )
    .join("");

  const roundOff = invoice.roundOff || 0;
  const logo = logoDataUri(company.logoPath, 72);
  const mark = escapeHtml((company.name || "D").trim().charAt(0).toUpperCase() || "D");
  const addressInline = escapeHtml(
    (company.address || "")
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .join(", "),
  );
  const phone = escapeHtml(company.phone || "—");
  const companyName = escapeHtml(company.name || "DIP Enterprise");
  const logoHtml = logo
    ? `<img class="co-logo" src="${logo}" alt="" />`
    : `<div class="co-logo mark">${mark}</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(invoice.invoiceNo)} · Thermal ${paperMm}mm</title>
  <style>
    @page {
      size: ${paperMm}mm auto;
      margin: 0;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #111;
      font-family: "Courier New", Courier, monospace;
      font-size: ${compact ? "10px" : "11px"};
      line-height: 1.35;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .receipt {
      width: 100%;
      max-width: 100%;
      margin: 0 auto;
      padding: ${compact ? "2.5mm 3mm" : "3mm 3.5mm"};
    }
    .center { text-align: center; }
    .muted { color: #444; word-break: break-word; }
    .co-logo, .co-logo.mark {
      width: ${compact ? "28px" : "36px"};
      height: ${compact ? "28px" : "36px"};
      object-fit: contain;
      margin: 0 auto 4px;
      display: block;
    }
    .co-logo.mark {
      border: 1px solid #111;
      display: grid;
      place-items: center;
      font-weight: 800;
      font-size: ${compact ? "12px" : "14px"};
    }
    .brand {
      font-weight: 800;
      font-size: ${compact ? "12px" : "13px"};
      text-transform: uppercase;
      letter-spacing: 0.02em;
      word-break: break-word;
    }
    .title {
      margin: 6px 0 2px;
      font-weight: 800;
      letter-spacing: 0.04em;
      font-size: ${compact ? "11px" : "12px"};
    }
    .divider {
      border: none;
      border-top: 1px dashed #222;
      margin: 6px 0;
    }
    .row {
      display: flex;
      justify-content: space-between;
      gap: 6px;
      margin: 2px 0;
    }
    .row span:last-child,
    .row strong:last-child {
      text-align: right;
      word-break: break-word;
      max-width: 62%;
    }
    table.items {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      margin: 2px 0;
    }
    table.items th,
    table.items td {
      padding: 3px 1px;
      vertical-align: top;
      word-break: break-word;
    }
    table.items th {
      font-size: 0.85em;
      text-transform: uppercase;
      border-bottom: 1px solid #222;
      text-align: left;
      font-weight: 800;
    }
    table.items th.num,
    table.items td.num {
      text-align: right;
      white-space: nowrap;
    }
    .item-name { width: 40%; }
    table.items th:nth-child(2),
    table.items td:nth-child(2) { width: 12%; }
    table.items th:nth-child(3),
    table.items td:nth-child(3) { width: 22%; }
    table.items th:nth-child(4),
    table.items td:nth-child(4) { width: 26%; }
    .totals .row { margin: 2px 0; }
    .grand {
      margin-top: 4px;
      padding-top: 4px;
      border-top: 1px solid #111;
      font-size: 1.05em;
      font-weight: 800;
    }
    .words {
      margin-top: 6px;
      font-size: 0.9em;
      word-break: break-word;
    }
    .foot {
      margin-top: 8px;
      text-align: center;
      font-size: 0.9em;
    }
    .no-print {
      margin: 12px auto;
      width: min(420px, 92vw);
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: center;
    }
    .no-print a, .no-print button {
      appearance: none;
      border: 1px solid #111;
      background: #111;
      color: #fff;
      border-radius: 999px;
      padding: 8px 14px;
      font: inherit;
      font-weight: 700;
      text-decoration: none;
      cursor: pointer;
    }
    .no-print a.ghost, .no-print button.ghost {
      background: #fff;
      color: #111;
    }
    @media print {
      .no-print { display: none !important; }
      body { background: #fff; }
    }
  </style>
</head>
<body>
  ${
    interactive
      ? `<div class="no-print">
    <button type="button" onclick="window.print()">Print thermal</button>
    <a class="ghost" href="?format=thermal80&download=1">Download PDF</a>
  </div>`
      : ""
  }
  <div class="receipt">
    <div class="center">
      ${logoHtml}
      <div class="brand">${companyName}</div>
      <div class="muted">${addressInline || "—"}</div>
      <div class="muted">Contact: ${phone}</div>
      ${company.enableGst && company.gstin ? `<div class="muted">GSTIN: ${escapeHtml(company.gstin)}</div>` : ""}
      <div class="title">${title}</div>
    </div>

    <hr class="divider" />

    <div class="row"><span>Bill No</span><strong>${escapeHtml(invoice.invoiceNo)}</strong></div>
    <div class="row"><span>Date</span><strong>${escapeHtml(invoice.invoiceDate)}</strong></div>
    <div class="row"><span>${partyLabel}</span><strong>${escapeHtml(invoice.partyName)}</strong></div>
    <div class="row"><span>Branch</span><strong>${escapeHtml(invoice.branchName)}</strong></div>

    <hr class="divider" />

    <table class="items">
      <thead>
        <tr>
          <th class="item-name">Item</th>
          <th class="num">Qty</th>
          <th class="num">Rate</th>
          <th class="num">Amt</th>
        </tr>
      </thead>
      <tbody>${lineRows}</tbody>
    </table>

    <hr class="divider" />

    <div class="totals">
      <div class="row"><span>Products</span><strong>${money(productsSubtotal)}</strong></div>
      ${chargeRows}
      <div class="row"><span>Round off</span><strong>${
        roundOff ? `${roundOff >= 0 ? "+" : "-"}${money(Math.abs(roundOff))}` : money(0)
      }</strong></div>
      <div class="row grand"><span>TOTAL</span><strong>${money(invoice.totalValue)}</strong></div>
      <div class="row"><span>Paid</span><strong>${money(invoice.paidAmount)}</strong></div>
      <div class="row"><span>Due</span><strong>${money(invoice.dueAmount)}</strong></div>
      ${
        invoice.paymentMethod
          ? `<div class="row"><span>Pay mode</span><strong>${escapeHtml(invoice.paymentMethod)}</strong></div>`
          : ""
      }
    </div>

    <div class="words">
      <div class="muted">In words</div>
      <div>${escapeHtml(amountInWords(invoice.totalValue).replace(/^INR\s*/i, ""))}</div>
    </div>

    ${
      invoice.notes
        ? `<hr class="divider" /><div class="muted">Notes: ${escapeHtml(invoice.notes)}</div>`
        : ""
    }

    <hr class="divider" />
    <div class="foot">
      Thank you
      <div class="muted">${paperMm}mm thermal receipt</div>
    </div>
  </div>
  ${
    autoprint
      ? `<script>
    window.addEventListener("load", function () {
      setTimeout(function () { window.print(); }, 250);
    });
  </script>`
      : ""
  }
</body>
</html>`;
}
