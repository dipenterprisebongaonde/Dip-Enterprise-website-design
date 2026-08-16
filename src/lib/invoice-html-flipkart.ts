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

function money(value: number) {
  return value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Modern marketplace-style tax invoice (Flipkart-type layout):
 * blue accent header, sold-by / bill-to cards, clean line table, soft totals.
 */
export function buildFlipkartInvoiceHtml(invoice: InvoiceDoc, company: InvoiceCompany) {
  const logo = logoDataUri(company.logoPath);
  const rate = gstRateFromPercent(company.gstPercent);
  const tax = taxableFromTotal(invoice.totalValue, rate, company.enableGst);
  const gstPct = Math.round(tax.taxRate * 100);
  const halfGstPct = gstPct / 2;
  const cgst = company.enableGst ? Number((tax.tax / 2).toFixed(2)) : 0;
  const sgst = company.enableGst ? Number((tax.tax - cgst).toFixed(2)) : 0;
  const isSale = invoice.type === "sale";
  const title = isSale ? "Tax Invoice" : "Purchase Bill";
  const partyTitle = isSale ? "Billing Address" : "Supplier";
  const shipTitle = isSale ? "Shipping Address" : "Vendor Address";

  const productsSubtotal = invoice.lines.reduce((sum, line) => sum + line.amount, 0);
  const charges = invoice.charges || [];
  const chargesTotal = charges.reduce((sum, c) => sum + c.amount, 0);

  const addressLines = company.address
    .split(/\n+/)
    .map((line) => escapeHtml(line.trim()))
    .filter(Boolean)
    .join("<br />");

  const rows = invoice.lines
    .map((line, index) => {
      const lineTax = taxableFromTotal(line.amount, rate, company.enableGst);
      const lineCgst = company.enableGst ? Number((lineTax.tax / 2).toFixed(2)) : 0;
      const lineSgst = company.enableGst ? Number((lineTax.tax - lineCgst).toFixed(2)) : 0;
      return `
        <tr>
          <td class="c muted">${index + 1}</td>
          <td>
            <div class="item-name">${escapeHtml(line.item)}</div>
            <div class="item-sub">Qty ${line.quantity} · Gross ${line.gross}</div>
          </td>
          <td class="c">—</td>
          <td class="r">${money(line.unitPrice)}</td>
          <td class="r">${money(lineTax.taxable)}</td>
          ${
            company.enableGst
              ? `<td class="r">${money(lineCgst)}</td>
                 <td class="r">${money(lineSgst)}</td>`
              : ""
          }
          <td class="r b">${money(line.amount)}</td>
        </tr>`;
    })
    .join("");

  const chargeRows = charges
    .map(
      (charge) => `
        <tr>
          <td class="c muted"></td>
          <td><div class="item-name">${escapeHtml(charge.label)}</div><div class="item-sub">Additional charge</div></td>
          <td class="c">—</td>
          <td class="r">—</td>
          <td class="r">—</td>
          ${company.enableGst ? `<td class="r">—</td><td class="r">—</td>` : ""}
          <td class="r b">${money(charge.amount)}</td>
        </tr>`
    )
    .join("");

  const colCount = company.enableGst ? 8 : 6;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(invoice.invoiceNo)} · ${title}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    :root {
      --fk-blue: #2874f0;
      --fk-blue-deep: #1a5dc8;
      --fk-ink: #212121;
      --fk-muted: #878787;
      --fk-line: #e0e0e0;
      --fk-soft: #f5f7fb;
      --fk-chip: #e8f0fe;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; }
    body {
      font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: var(--fk-ink);
      font-size: 10px;
      line-height: 1.45;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      width: 190mm;
      min-height: 277mm;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
    }
    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      padding-bottom: 12px;
      border-bottom: 2px solid var(--fk-blue);
    }
    .brand {
      display: flex;
      gap: 10px;
      align-items: center;
      min-width: 0;
    }
    .brand img {
      width: 44px;
      height: 44px;
      object-fit: contain;
      border-radius: 8px;
      border: 1px solid var(--fk-line);
      background: #fff;
    }
    .brand-mark {
      width: 44px;
      height: 44px;
      border-radius: 8px;
      background: var(--fk-blue);
      color: #fff;
      display: grid;
      place-items: center;
      font-weight: 800;
      font-size: 16px;
    }
    .brand h1 {
      margin: 0;
      font-size: 16px;
      font-weight: 800;
      letter-spacing: 0.01em;
      color: var(--fk-ink);
      text-transform: uppercase;
    }
    .brand .tag {
      margin: 2px 0 0;
      color: var(--fk-muted);
      font-size: 9px;
      font-weight: 600;
    }
    .doc {
      text-align: right;
    }
    .doc .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 999px;
      background: var(--fk-chip);
      color: var(--fk-blue-deep);
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .doc h2 {
      margin: 6px 0 2px;
      font-size: 20px;
      font-weight: 800;
      color: var(--fk-blue);
      letter-spacing: -0.02em;
    }
    .doc .inv {
      margin: 0;
      font-size: 11px;
      font-weight: 700;
    }
    .meta {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin: 12px 0;
      padding: 10px 12px;
      background: var(--fk-soft);
      border-radius: 10px;
      border: 1px solid var(--fk-line);
    }
    .meta .cell .lbl {
      display: block;
      color: var(--fk-muted);
      font-size: 8px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 2px;
    }
    .meta .cell .val {
      font-size: 10.5px;
      font-weight: 700;
    }
    .parties {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 10px;
      margin-bottom: 12px;
    }
    .card {
      border: 1px solid var(--fk-line);
      border-radius: 10px;
      padding: 10px 12px;
      background: #fff;
      min-height: 88px;
    }
    .card .lbl {
      margin: 0 0 6px;
      color: var(--fk-blue);
      font-size: 8.5px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .card .name {
      margin: 0 0 4px;
      font-size: 11.5px;
      font-weight: 800;
    }
    .card p {
      margin: 1px 0;
      color: #555;
      font-size: 9.5px;
    }
    table.items {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      border: 1px solid var(--fk-line);
      border-radius: 10px;
      overflow: hidden;
      margin-bottom: 12px;
    }
    table.items th {
      background: var(--fk-blue);
      color: #fff;
      font-size: 8px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 8px 6px;
      text-align: left;
    }
    table.items th.c, table.items td.c { text-align: center; }
    table.items th.r, table.items td.r { text-align: right; }
    table.items td {
      padding: 8px 6px;
      border-bottom: 1px solid var(--fk-line);
      vertical-align: top;
      font-size: 9.5px;
    }
    table.items tr:last-child td { border-bottom: 0; }
    table.items tr:nth-child(even) td { background: #fafbfd; }
    .item-name { font-weight: 700; color: var(--fk-ink); }
    .item-sub { color: var(--fk-muted); font-size: 8.5px; margin-top: 2px; }
    .muted { color: var(--fk-muted); }
    .b { font-weight: 800; }

    .bottom {
      display: grid;
      grid-template-columns: 1.2fr 0.9fr;
      gap: 12px;
      margin-top: auto;
    }
    .words, .bank, .decl {
      border: 1px solid var(--fk-line);
      border-radius: 10px;
      padding: 10px 12px;
      margin-bottom: 8px;
      background: #fff;
    }
    .words .lbl, .bank .lbl, .decl .lbl, .totals .lbl {
      margin: 0 0 4px;
      color: var(--fk-muted);
      font-size: 8px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .words strong {
      display: block;
      font-size: 11px;
      font-weight: 700;
      color: var(--fk-ink);
    }
    .bank p, .decl p {
      margin: 2px 0;
      font-size: 9.5px;
      color: #444;
    }
    .totals {
      border: 1px solid var(--fk-line);
      border-radius: 10px;
      overflow: hidden;
      background: #fff;
    }
    .t-row {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      padding: 7px 12px;
      border-bottom: 1px solid var(--fk-line);
      font-size: 10px;
    }
    .t-row:last-child { border-bottom: 0; }
    .t-row span { color: #555; }
    .t-row strong { color: var(--fk-ink); font-weight: 700; }
    .t-row.grand {
      background: var(--fk-blue);
      color: #fff;
      padding: 10px 12px;
    }
    .t-row.grand span, .t-row.grand strong {
      color: #fff;
      font-size: 12px;
      font-weight: 800;
    }
    .sign {
      margin-top: 14px;
      text-align: right;
      padding-top: 28px;
    }
    .sign .for {
      font-size: 10px;
      font-weight: 700;
      color: var(--fk-ink);
    }
    .sign .auth {
      margin-top: 28px;
      font-size: 9px;
      color: var(--fk-muted);
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .foot {
      margin-top: 10px;
      text-align: center;
      color: var(--fk-muted);
      font-size: 8px;
      padding-top: 8px;
      border-top: 1px dashed var(--fk-line);
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="topbar">
      <div class="brand">
        ${
          logo
            ? `<img src="${logo}" alt="Logo" />`
            : `<div class="brand-mark">${escapeHtml((company.name || "D").charAt(0))}</div>`
        }
        <div>
          <h1>${escapeHtml(company.name)}</h1>
          <p class="tag">${escapeHtml(company.legalName || company.name)}</p>
        </div>
      </div>
      <div class="doc">
        <span class="badge">Original for Recipient</span>
        <h2>${title}</h2>
        <p class="inv">${escapeHtml(invoice.invoiceNo)}</p>
      </div>
    </div>

    <div class="meta">
      <div class="cell">
        <span class="lbl">Invoice date</span>
        <div class="val">${escapeHtml(invoice.invoiceDate)}</div>
      </div>
      <div class="cell">
        <span class="lbl">Branch</span>
        <div class="val">${escapeHtml(invoice.branchName)}</div>
      </div>
      <div class="cell">
        <span class="lbl">Payment</span>
        <div class="val">${escapeHtml(invoice.paymentMethod || invoice.paymentStatus)}</div>
      </div>
      <div class="cell">
        <span class="lbl">Status</span>
        <div class="val">${escapeHtml(invoice.paymentStatus)}</div>
      </div>
    </div>

    <div class="parties">
      <div class="card">
        <p class="lbl">Sold by</p>
        <p class="name">${escapeHtml(company.name)}</p>
        <p>${addressLines}</p>
        <p>Ph: ${escapeHtml(company.phone)}</p>
        ${company.email ? `<p>${escapeHtml(company.email)}</p>` : ""}
        ${
          company.enableGst && company.gstin
            ? `<p><strong>GSTIN:</strong> ${escapeHtml(company.gstin)}</p>`
            : ""
        }
      </div>
      <div class="card">
        <p class="lbl">${partyTitle}</p>
        <p class="name">${escapeHtml(invoice.partyName)}</p>
        ${invoice.partyAddress ? `<p>${escapeHtml(invoice.partyAddress)}</p>` : ""}
        ${invoice.partyPhone ? `<p>Ph: ${escapeHtml(invoice.partyPhone)}</p>` : ""}
      </div>
      <div class="card">
        <p class="lbl">${shipTitle}</p>
        <p class="name">${escapeHtml(invoice.partyName)}</p>
        ${invoice.partyAddress ? `<p>${escapeHtml(invoice.partyAddress)}</p>` : `<p class="muted">Same as billing</p>`}
        ${invoice.partyPhone ? `<p>Ph: ${escapeHtml(invoice.partyPhone)}</p>` : ""}
      </div>
    </div>

    <table class="items">
      <thead>
        <tr>
          <th class="c" style="width:8mm">#</th>
          <th>Product / Description</th>
          <th class="c" style="width:14mm">HSN</th>
          <th class="r" style="width:18mm">Rate</th>
          <th class="r" style="width:20mm">Taxable</th>
          ${
            company.enableGst
              ? `<th class="r" style="width:16mm">CGST ${halfGstPct}%</th>
                 <th class="r" style="width:16mm">SGST ${halfGstPct}%</th>`
              : ""
          }
          <th class="r" style="width:20mm">Total</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        ${chargeRows}
        <tr>
          <td colspan="${colCount - 1}" class="r b">Grand total</td>
          <td class="r b">${money(invoice.totalValue)}</td>
        </tr>
      </tbody>
    </table>

    <div class="bottom">
      <div>
        <div class="words">
          <p class="lbl">Amount in words</p>
          <strong>${escapeHtml(amountInWords(invoice.totalValue))}</strong>
        </div>
        <div class="bank">
          <p class="lbl">Bank details</p>
          <p>Bank: <strong>${escapeHtml(company.bankName || "—")}</strong></p>
          <p>A/C: <strong>${escapeHtml(company.accountNo || "—")}</strong></p>
          <p>IFSC: <strong>${escapeHtml(company.ifsc || "—")}</strong> · ${escapeHtml(company.branch || "—")}</p>
          ${company.upi ? `<p>UPI: <strong>${escapeHtml(company.upi)}</strong></p>` : ""}
        </div>
        <div class="decl">
          <p class="lbl">Declaration</p>
          <p>We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.${
            invoice.notes ? ` ${escapeHtml(invoice.notes)}` : ""
          }</p>
        </div>
      </div>
      <div>
        <div class="totals">
          <div class="t-row"><span>Products</span><strong>₹${money(productsSubtotal)}</strong></div>
          ${chargesTotal ? `<div class="t-row"><span>Other charges</span><strong>₹${money(chargesTotal)}</strong></div>` : ""}
          ${
            company.enableGst
              ? `<div class="t-row"><span>Taxable value</span><strong>₹${money(tax.taxable)}</strong></div>
                 <div class="t-row"><span>CGST @ ${halfGstPct}%</span><strong>₹${money(cgst)}</strong></div>
                 <div class="t-row"><span>SGST @ ${halfGstPct}%</span><strong>₹${money(sgst)}</strong></div>`
              : ""
          }
          <div class="t-row"><span>Round off</span><strong>₹${money(invoice.roundOff || 0)}</strong></div>
          <div class="t-row grand"><span>Total</span><strong>${formatINR(invoice.totalValue)}</strong></div>
          <div class="t-row"><span>Paid</span><strong>₹${money(invoice.paidAmount)}</strong></div>
          <div class="t-row"><span>Balance due</span><strong>₹${money(invoice.dueAmount)}</strong></div>
        </div>
        <div class="sign">
          <div class="for">For ${escapeHtml(company.name)}</div>
          <div class="auth">Authorized Signatory</div>
        </div>
      </div>
    </div>

    <p class="foot">This is a computer generated invoice · ${escapeHtml(company.name)}</p>
  </div>
</body>
</html>`;
}
