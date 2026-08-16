import {
  InvoiceCompany,
  InvoiceDoc,
  amountWordsPlain,
  formatINR,
  gstRateFromPercent,
  taxableFromTotal,
} from "@/lib/invoice";
import {
  escapeHtml,
  formatPdfAmount,
  logoDataUri,
} from "@/lib/invoice-pdf-assets";

/** Tally-style amount: 1,23,456.00 (no currency glyph in grid cells). */
function tallyAmt(value: number) {
  return formatPdfAmount(value);
}

function docTitle(type: InvoiceDoc["type"]) {
  return type === "sale" ? "TAX INVOICE" : "PURCHASE BILL";
}

function partyHeading(type: InvoiceDoc["type"]) {
  return type === "sale" ? "Buyer (Bill to)" : "Supplier (Bill from)";
}

export function buildInvoiceHtml(invoice: InvoiceDoc, company: InvoiceCompany) {
  const logo = logoDataUri(company.logoPath);
  const rate = gstRateFromPercent(company.gstPercent);
  const tax = taxableFromTotal(invoice.totalValue, rate, company.enableGst);
  const gstPct = Math.round(tax.taxRate * 100);
  const halfGstPct = gstPct / 2;
  const cgst = company.enableGst ? Number((tax.tax / 2).toFixed(2)) : 0;
  const sgst = company.enableGst ? Number((tax.tax - cgst).toFixed(2)) : 0;

  const productsSubtotal = invoice.lines.reduce((sum, line) => sum + line.amount, 0);
  const charges = invoice.charges || [];
  const chargesTotal = charges.reduce((sum, c) => sum + c.amount, 0);

  const colCount = company.enableGst ? 9 : 7;

  const rows = invoice.lines
    .map((line, index) => {
      const lineTax = taxableFromTotal(line.amount, rate, company.enableGst);
      const lineCgst = company.enableGst ? Number((lineTax.tax / 2).toFixed(2)) : 0;
      const lineSgst = company.enableGst ? Number((lineTax.tax - lineCgst).toFixed(2)) : 0;
      return `
        <tr>
          <td class="c">${index + 1}</td>
          <td class="l">${escapeHtml(line.item)}</td>
          <td class="r">${line.quantity}</td>
          <td class="c">Nos</td>
          <td class="r">${tallyAmt(line.unitPrice)}</td>
          <td class="r">${tallyAmt(lineTax.taxable)}</td>
          ${
            company.enableGst
              ? `<td class="r">${tallyAmt(lineCgst)}</td>
                 <td class="r">${tallyAmt(lineSgst)}</td>`
              : ""
          }
          <td class="r">${tallyAmt(line.amount)}</td>
        </tr>`;
    })
    .join("");

  const chargeRows = charges
    .map(
      (charge) => `
        <tr>
          <td class="c"></td>
          <td class="l"><em>${escapeHtml(charge.label)}</em></td>
          <td class="r"></td>
          <td class="c"></td>
          <td class="r"></td>
          <td class="r"></td>
          ${company.enableGst ? `<td class="r"></td><td class="r"></td>` : ""}
          <td class="r">${tallyAmt(charge.amount)}</td>
        </tr>`
    )
    .join("");

  // Light padding so short invoices still look like a Tally voucher (not sparse).
  const filled = invoice.lines.length + charges.length;
  const blankCount = Math.max(0, 4 - filled);
  const blankRows = Array.from({ length: blankCount })
    .map(
      () => `
        <tr class="blank">
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          ${company.enableGst ? `<td>&nbsp;</td><td>&nbsp;</td>` : ""}
          <td>&nbsp;</td>
        </tr>`
    )
    .join("");

  const addressLines = company.address
    .split(/\n+/)
    .map((line) => escapeHtml(line.trim()))
    .filter(Boolean)
    .join("<br />");

  const roundOff = invoice.roundOff || 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(invoice.invoiceNo)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 6mm;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
    }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #000;
      font-size: 10px;
      line-height: 1.35;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .voucher {
      width: 198mm;
      min-height: 280mm;
      margin: 0 auto;
      border: 1.5px solid #000;
      display: flex;
      flex-direction: column;
    }
    table { border-collapse: collapse; width: 100%; }
    td, th {
      border: 1px solid #000;
      padding: 3px 5px;
      vertical-align: top;
    }
    .nb { border: 0 !important; }
    .c { text-align: center; }
    .r { text-align: right; }
    .l { text-align: left; }
    .b { font-weight: 700; }
    .small { font-size: 9px; }
    .muted { color: #222; }

    .hdr {
      display: grid;
      grid-template-columns: 56px 1fr;
      gap: 8px;
      align-items: flex-start;
      padding: 8px 10px 6px;
      border-bottom: 1px solid #000;
    }
    .hdr img {
      width: 52px;
      height: 52px;
      object-fit: contain;
    }
    .hdr-mark {
      width: 52px;
      height: 52px;
      border: 1px solid #000;
      display: grid;
      place-items: center;
      font-size: 18px;
      font-weight: 700;
    }
    .co-name {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.02em;
      line-height: 1.15;
    }
    .co-legal {
      margin: 1px 0 0;
      font-size: 9px;
    }
    .co-addr {
      margin: 4px 0 0;
      font-size: 9.5px;
      line-height: 1.35;
    }
    .co-gst {
      margin: 4px 0 0;
      font-size: 10px;
      font-weight: 700;
    }

    .title-bar {
      text-align: center;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.18em;
      padding: 5px 8px;
      border-bottom: 1px solid #000;
      text-transform: uppercase;
    }

    .meta-grid {
      display: grid;
      grid-template-columns: 1.15fr 0.85fr;
    }
    .meta-grid > div {
      border-right: 1px solid #000;
      border-bottom: 1px solid #000;
      padding: 6px 8px;
      min-height: 78px;
    }
    .meta-grid > div:last-child { border-right: 0; }
    .lbl {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      margin: 0 0 3px;
    }
    .party-name {
      margin: 0 0 2px;
      font-size: 12px;
      font-weight: 700;
    }
    .kv {
      display: grid;
      grid-template-columns: 78px 1fr;
      gap: 2px 6px;
      font-size: 10px;
    }
    .kv span { font-weight: 700; }

    .items th {
      background: #e8e8e8;
      font-size: 9px;
      font-weight: 700;
      text-align: center;
      padding: 4px 3px;
      vertical-align: middle;
    }
    .items td {
      font-size: 10px;
      height: 18px;
    }
    .items tr.blank td {
      height: 17px;
      border-top: 0;
      border-bottom: 1px solid #000;
    }
    .items tbody tr:first-child td { border-top: 0; }

    .foot-grid {
      display: grid;
      grid-template-columns: 1.2fr 0.8fr;
      border-top: 0;
      flex: 1;
    }
    .foot-left {
      border-right: 1px solid #000;
      display: flex;
      flex-direction: column;
    }
    .foot-block {
      padding: 6px 8px;
      border-bottom: 1px solid #000;
    }
    .foot-block:last-child { border-bottom: 0; flex: 1; }
    .foot-right { display: flex; flex-direction: column; }
    .tot-row {
      display: grid;
      grid-template-columns: 1fr 88px;
      border-bottom: 1px solid #000;
      font-size: 10px;
    }
    .tot-row > div {
      padding: 4px 8px;
    }
    .tot-row > div:last-child {
      border-left: 1px solid #000;
      text-align: right;
      font-weight: 700;
    }
    .tot-row.grand {
      font-size: 11px;
      font-weight: 700;
      background: #efefef;
    }
    .sign {
      margin-top: auto;
      padding: 8px;
      text-align: right;
      min-height: 78px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      border-top: 1px solid #000;
    }
    .sign .for {
      font-size: 10px;
      font-weight: 700;
    }
    .sign .auth {
      font-size: 9px;
      margin-top: 42px;
    }
    .words {
      font-size: 10px;
    }
    .words strong { font-size: 10.5px; }
    .decl {
      font-size: 9px;
      line-height: 1.35;
    }
    .bank p {
      margin: 1px 0;
      font-size: 9.5px;
    }
    .endnote {
      text-align: center;
      font-size: 8.5px;
      padding: 4px 6px;
      border-top: 1px solid #000;
    }
  </style>
</head>
<body>
  <div class="voucher">
    <div class="hdr">
      ${
        logo
          ? `<img src="${logo}" alt="Logo" />`
          : `<div class="hdr-mark">${escapeHtml(company.name.charAt(0) || "D")}</div>`
      }
      <div>
        <p class="co-name">${escapeHtml(company.name)}</p>
        ${company.legalName && company.legalName !== company.name
          ? `<p class="co-legal">${escapeHtml(company.legalName)}</p>`
          : ""}
        <div class="co-addr">
          ${addressLines}<br />
          Ph: ${escapeHtml(company.phone)}${company.email ? ` &nbsp;|&nbsp; E-Mail: ${escapeHtml(company.email)}` : ""}
        </div>
        ${
          company.enableGst && company.gstin
            ? `<p class="co-gst">GSTIN/UIN: ${escapeHtml(company.gstin)}</p>`
            : ""
        }
      </div>
    </div>

    <div class="title-bar">${docTitle(invoice.type)}</div>

    <div class="meta-grid">
      <div>
        <p class="lbl">${partyHeading(invoice.type)}</p>
        <p class="party-name">${escapeHtml(invoice.partyName)}</p>
        ${invoice.partyAddress ? `<p class="small muted">${escapeHtml(invoice.partyAddress)}</p>` : ""}
        ${invoice.partyPhone ? `<p class="small muted">Ph: ${escapeHtml(invoice.partyPhone)}</p>` : ""}
      </div>
      <div>
        <div class="kv">
          <span>Invoice No.</span><div class="b">${escapeHtml(invoice.invoiceNo)}</div>
          <span>Dated</span><div class="b">${escapeHtml(invoice.invoiceDate)}</div>
          <span>Branch</span><div>${escapeHtml(invoice.branchName)} (${escapeHtml(invoice.branchRegion)})</div>
          <span>Mode/Terms</span><div>${escapeHtml(invoice.paymentMethod || invoice.paymentStatus)}</div>
          ${invoice.dueDate ? `<span>Due Date</span><div>${escapeHtml(invoice.dueDate)}</div>` : ""}
        </div>
      </div>
    </div>

    <table class="items">
      <thead>
        <tr>
          <th style="width:8mm">Sl<br />No.</th>
          <th>Description of Goods</th>
          <th style="width:14mm">Quantity</th>
          <th style="width:10mm">per</th>
          <th style="width:20mm">Rate</th>
          <th style="width:22mm">Taxable<br />Value</th>
          ${
            company.enableGst
              ? `<th style="width:18mm">CGST<br />${halfGstPct}%</th>
                 <th style="width:18mm">SGST<br />${halfGstPct}%</th>`
              : ""
          }
          <th style="width:24mm">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        ${chargeRows}
        ${blankRows}
        <tr>
          <td colspan="${colCount - 1}" class="r b">Total</td>
          <td class="r b">${tallyAmt(invoice.totalValue)}</td>
        </tr>
      </tbody>
    </table>

    <div class="foot-grid">
      <div class="foot-left">
        <div class="foot-block words">
          <div class="lbl">Amount Chargeable (in words)</div>
          <strong>Indian Rupees ${escapeHtml(amountWordsPlain(invoice.totalValue))} Only</strong>
        </div>
        ${
          company.enableGst
            ? `<div class="foot-block words">
          <div class="lbl">Tax Amount (in words)</div>
          <strong>Indian Rupees ${escapeHtml(amountWordsPlain(tax.tax))} Only</strong>
        </div>`
            : ""
        }
        <div class="foot-block bank">
          <div class="lbl">Company's Bank Details</div>
          <p>Bank Name : <b>${escapeHtml(company.bankName || "—")}</b></p>
          <p>A/c No. : <b>${escapeHtml(company.accountNo || "—")}</b></p>
          <p>Branch &amp; IFS Code : <b>${escapeHtml(company.branch || "—")}</b> &nbsp; <b>${escapeHtml(company.ifsc || "—")}</b></p>
          ${company.upi ? `<p>UPI : <b>${escapeHtml(company.upi)}</b></p>` : ""}
        </div>
        <div class="foot-block decl">
          <div class="lbl">Declaration</div>
          <p>We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.${
            invoice.notes ? ` ${escapeHtml(invoice.notes)}` : ""
          }</p>
        </div>
      </div>
      <div class="foot-right">
        <div class="tot-row"><div>Products total</div><div>${tallyAmt(productsSubtotal)}</div></div>
        ${
          chargesTotal
            ? `<div class="tot-row"><div>Other charges</div><div>${tallyAmt(chargesTotal)}</div></div>`
            : ""
        }
        ${
          company.enableGst
            ? `<div class="tot-row"><div>Taxable value</div><div>${tallyAmt(tax.taxable)}</div></div>
               <div class="tot-row"><div>CGST @ ${halfGstPct}%</div><div>${tallyAmt(cgst)}</div></div>
               <div class="tot-row"><div>SGST @ ${halfGstPct}%</div><div>${tallyAmt(sgst)}</div></div>`
            : ""
        }
        <div class="tot-row"><div>Round Off</div><div>${
          roundOff
            ? `${roundOff >= 0 ? "" : "-"}${tallyAmt(Math.abs(roundOff))}`
            : tallyAmt(0)
        }</div></div>
        <div class="tot-row grand"><div>Grand Total</div><div>${formatINR(invoice.totalValue)}</div></div>
        <div class="tot-row"><div>Received</div><div>${tallyAmt(invoice.paidAmount)}</div></div>
        <div class="tot-row"><div>Balance Due</div><div>${tallyAmt(invoice.dueAmount)}</div></div>
        <div class="sign">
          <div class="for">for ${escapeHtml(company.name)}</div>
          <div class="auth">Authorised Signatory</div>
        </div>
      </div>
    </div>

    <div class="endnote">This is a Computer Generated Invoice</div>
  </div>
</body>
</html>`;
}
