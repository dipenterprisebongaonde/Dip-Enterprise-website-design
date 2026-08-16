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

  const lineRows = invoice.lines
    .map(
      (line, index) => `
      <div class="item">
        <div class="item-top">
          <span>${index + 1}. ${escapeHtml(line.item)}</span>
        </div>
        <div class="item-meta">
          <span>${line.quantity} x ${money(line.unitPrice)}</span>
          <span>G:${line.gross}</span>
          <strong>${money(line.amount)}</strong>
        </div>
      </div>`
    )
    .join("");

  const chargeRows = charges
    .map(
      (charge) => `
      <div class="row">
        <span>${escapeHtml(charge.label)}</span>
        <strong>${money(charge.amount)}</strong>
      </div>`
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
      .join(", ")
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
      margin: 2mm;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #111;
      font-family: "Courier New", Courier, monospace;
      font-size: ${paperMm === 58 ? "10px" : "12px"};
      line-height: 1.35;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .receipt {
      width: ${paperMm}mm;
      max-width: 100%;
      margin: 0 auto;
      padding: ${paperMm === 58 ? "1.5mm" : "2mm"};
    }
    .center { text-align: center; }
    .muted { color: #444; }
    .co-logo, .co-logo.mark {
      width: ${paperMm === 58 ? "28px" : "36px"};
      height: ${paperMm === 58 ? "28px" : "36px"};
      object-fit: contain;
      margin: 0 auto 4px;
      display: block;
    }
    .co-logo.mark {
      border: 1px solid #111;
      display: grid;
      place-items: center;
      font-weight: 800;
      font-size: ${paperMm === 58 ? "12px" : "14px"};
    }
    .brand {
      font-weight: 800;
      font-size: ${paperMm === 58 ? "12px" : "14px"};
      text-transform: uppercase;
    }
    .title {
      margin: 6px 0 2px;
      font-weight: 800;
      letter-spacing: 0.04em;
    }
    .divider {
      border-top: 1px dashed #222;
      margin: 6px 0;
    }
    .row, .item-meta {
      display: flex;
      justify-content: space-between;
      gap: 6px;
    }
    .item { margin-bottom: 5px; }
    .item-top { font-weight: 700; }
    .item-meta { margin-top: 1px; font-size: 0.95em; }
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
      .receipt { width: ${paperMm}mm; }
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

    <div class="divider"></div>

    <div class="row"><span>Bill No</span><strong>${escapeHtml(invoice.invoiceNo)}</strong></div>
    <div class="row"><span>Date</span><strong>${escapeHtml(invoice.invoiceDate)}</strong></div>
    <div class="row"><span>${partyLabel}</span><strong>${escapeHtml(invoice.partyName)}</strong></div>
    <div class="row"><span>Branch</span><strong>${escapeHtml(invoice.branchName)}</strong></div>

    <div class="divider"></div>
    ${lineRows}
    <div class="divider"></div>

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
        ? `<div class="divider"></div><div class="muted">Notes: ${escapeHtml(invoice.notes)}</div>`
        : ""
    }

    <div class="divider"></div>
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
