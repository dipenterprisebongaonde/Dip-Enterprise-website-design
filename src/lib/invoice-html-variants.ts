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

/** Legacy A4 theme variants (kept for reference; app prints Thermal 80mm only). */
export type A4VariantTemplate =
  | "modern"
  | "classic"
  | "compact"
  | "bold"
  | "minimal"
  | "gst";

type Theme = {
  accent: string;
  accentSoft: string;
  ink: string;
  muted: string;
  line: string;
  soft: string;
  font: string;
  titleSize: string;
  radius: string;
  headerStyle: "bar" | "band" | "plain" | "boxed" | "rule";
  tableHead: string;
  tableHeadText: string;
};

const THEMES: Record<A4VariantTemplate, Theme> = {
  modern: {
    accent: "#0f766e",
    accentSoft: "#ccfbf1",
    ink: "#134e4a",
    muted: "#5b716e",
    line: "#d1e7e3",
    soft: "#f0fdfa",
    font: '"Segoe UI", Helvetica, Arial, sans-serif',
    titleSize: "18px",
    radius: "10px",
    headerStyle: "bar",
    tableHead: "#0f766e",
    tableHeadText: "#fff",
  },
  classic: {
    accent: "#1f2937",
    accentSoft: "#f3f4f6",
    ink: "#111827",
    muted: "#4b5563",
    line: "#9ca3af",
    soft: "#f9fafb",
    font: 'Georgia, "Times New Roman", serif',
    titleSize: "20px",
    radius: "0",
    headerStyle: "rule",
    tableHead: "#111827",
    tableHeadText: "#fff",
  },
  compact: {
    accent: "#334155",
    accentSoft: "#e2e8f0",
    ink: "#0f172a",
    muted: "#64748b",
    line: "#cbd5e1",
    soft: "#f8fafc",
    font: "Arial, Helvetica, sans-serif",
    titleSize: "14px",
    radius: "4px",
    headerStyle: "plain",
    tableHead: "#e2e8f0",
    tableHeadText: "#0f172a",
  },
  bold: {
    accent: "#b45309",
    accentSoft: "#ffedd5",
    ink: "#1c1917",
    muted: "#78716c",
    line: "#e7e5e4",
    soft: "#fff7ed",
    font: '"Trebuchet MS", Helvetica, Arial, sans-serif',
    titleSize: "22px",
    radius: "0",
    headerStyle: "band",
    tableHead: "#b45309",
    tableHeadText: "#fff",
  },
  minimal: {
    accent: "#18181b",
    accentSoft: "#f4f4f5",
    ink: "#18181b",
    muted: "#71717a",
    line: "#e4e4e7",
    soft: "#fafafa",
    font: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    titleSize: "16px",
    radius: "0",
    headerStyle: "plain",
    tableHead: "#fafafa",
    tableHeadText: "#18181b",
  },
  gst: {
    accent: "#1d4ed8",
    accentSoft: "#dbeafe",
    ink: "#0f172a",
    muted: "#475569",
    line: "#93c5fd",
    soft: "#eff6ff",
    font: "Arial, Helvetica, sans-serif",
    titleSize: "17px",
    radius: "6px",
    headerStyle: "boxed",
    tableHead: "#1d4ed8",
    tableHeadText: "#fff",
  },
};

function money(value: number) {
  return formatPdfAmount(value);
}

export function isA4VariantTemplate(value: string): value is A4VariantTemplate {
  return value in THEMES;
}

export function buildVariantInvoiceHtml(
  invoice: InvoiceDoc,
  company: InvoiceCompany,
  variant: A4VariantTemplate,
) {
  const theme = THEMES[variant];
  const logo = logoDataUri(company.logoPath);
  const rate = gstRateFromPercent(company.gstPercent);
  const tax = taxableFromTotal(invoice.totalValue, rate, company.enableGst);
  const gstPct = Math.round(tax.taxRate * 100);
  const halfGstPct = gstPct / 2;
  const cgst = company.enableGst ? Number((tax.tax / 2).toFixed(2)) : 0;
  const sgst = company.enableGst ? Number((tax.tax - cgst).toFixed(2)) : 0;
  const isSale = invoice.type === "sale";
  const title =
    variant === "gst"
      ? isSale
        ? "GST TAX INVOICE"
        : "GST PURCHASE BILL"
      : isSale
        ? "TAX INVOICE"
        : "PURCHASE BILL";
  const partyLabel = isSale ? "Bill to" : "Supplier";
  const productsSubtotal = invoice.lines.reduce((sum, line) => sum + line.amount, 0);
  const charges = invoice.charges || [];
  const chargesTotal = charges.reduce((sum, c) => sum + c.amount, 0);
  const roundOff = invoice.roundOff || 0;
  const addressLines = company.address
    .split(/\n+/)
    .map((line) => escapeHtml(line.trim()))
    .filter(Boolean)
    .join("<br />");
  const partyAddress = escapeHtml(invoice.partyAddress || "—");
  const mark = escapeHtml((company.name || "D").trim().charAt(0).toUpperCase() || "D");

  const rows = invoice.lines
    .map((line, index) => {
      const lineTax = taxableFromTotal(line.amount, rate, company.enableGst);
      const lineCgst = company.enableGst ? Number((lineTax.tax / 2).toFixed(2)) : 0;
      const lineSgst = company.enableGst ? Number((lineTax.tax - lineCgst).toFixed(2)) : 0;
      return `
        <tr>
          <td class="c">${index + 1}</td>
          <td class="l">
            <div class="item">${escapeHtml(line.item)}</div>
            <div class="sub">Qty ${line.quantity} · Gross ${line.gross}</div>
          </td>
          <td class="r">${money(line.unitPrice)}</td>
          <td class="r">${money(lineTax.taxable)}</td>
          ${
            company.enableGst
              ? `<td class="r">${money(lineCgst)}</td><td class="r">${money(lineSgst)}</td>`
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
          <td class="c"></td>
          <td class="l"><em>${escapeHtml(charge.label)}</em></td>
          <td class="r">—</td>
          <td class="r">—</td>
          ${company.enableGst ? `<td class="r">—</td><td class="r">—</td>` : ""}
          <td class="r b">${money(charge.amount)}</td>
        </tr>`
    )
    .join("");

  const logoHtml = logo
    ? `<img src="${logo}" alt="" />`
    : `<div class="mark">${mark}</div>`;

  const headerInner = `
    <div class="brand">
      ${logoHtml}
      <div>
        <h1>${escapeHtml(company.name)}</h1>
        <p class="legal">${escapeHtml(company.legalName)}</p>
        <p class="addr">${addressLines}</p>
        <p class="contact">${escapeHtml(company.phone)} · ${escapeHtml(company.email)}</p>
        ${
          company.enableGst && company.gstin
            ? `<p class="gstin">GSTIN: ${escapeHtml(company.gstin)}</p>`
            : ""
        }
      </div>
    </div>
    <div class="meta">
      <div class="doc-title">${title}</div>
      <div class="meta-row"><span>No.</span><strong>${escapeHtml(invoice.invoiceNo)}</strong></div>
      <div class="meta-row"><span>Date</span><strong>${escapeHtml(invoice.invoiceDate)}</strong></div>
      <div class="meta-row"><span>Status</span><strong>${escapeHtml(invoice.paymentStatus)}</strong></div>
      ${
        invoice.paymentMethod
          ? `<div class="meta-row"><span>Mode</span><strong>${escapeHtml(invoice.paymentMethod)}</strong></div>`
          : ""
      }
    </div>`;

  let headerBlock = "";
  if (theme.headerStyle === "band") {
    headerBlock = `<header class="hdr band">${headerInner}</header>`;
  } else if (theme.headerStyle === "boxed") {
    headerBlock = `<header class="hdr boxed">${headerInner}</header>`;
  } else if (theme.headerStyle === "bar") {
    headerBlock = `<div class="accent-bar"></div><header class="hdr">${headerInner}</header>`;
  } else if (theme.headerStyle === "rule") {
    headerBlock = `<header class="hdr rule">${headerInner}</header>`;
  } else {
    headerBlock = `<header class="hdr">${headerInner}</header>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(invoice.invoiceNo)} · ${title}</title>
  <style>
    @page { size: A4 portrait; margin: 8mm; }
    :root {
      --accent: ${theme.accent};
      --accent-soft: ${theme.accentSoft};
      --ink: ${theme.ink};
      --muted: ${theme.muted};
      --line: ${theme.line};
      --soft: ${theme.soft};
      --radius: ${theme.radius};
      --head-bg: ${theme.tableHead};
      --head-fg: ${theme.tableHeadText};
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; }
    body {
      font-family: ${theme.font};
      color: var(--ink);
      font-size: ${variant === "compact" ? "9px" : "10px"};
      line-height: 1.4;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      width: 194mm;
      min-height: 277mm;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: ${variant === "compact" ? "8px" : "12px"};
    }
    .accent-bar {
      height: 6px;
      background: var(--accent);
      border-radius: var(--radius);
    }
    .hdr {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-start;
      padding-bottom: 10px;
    }
    .hdr.band {
      background: var(--accent);
      color: #fff;
      padding: 14px 16px;
      border-radius: var(--radius);
    }
    .hdr.band .legal,
    .hdr.band .addr,
    .hdr.band .contact,
    .hdr.band .gstin,
    .hdr.band .meta-row span { color: rgba(255,255,255,0.82); }
    .hdr.band .doc-title { color: #fff; border-color: rgba(255,255,255,0.35); }
    .hdr.boxed {
      border: 1.5px solid var(--accent);
      border-radius: var(--radius);
      padding: 12px 14px;
      background: var(--soft);
    }
    .hdr.rule {
      border-bottom: 2px solid var(--ink);
      padding-bottom: 12px;
    }
    .brand {
      display: flex;
      gap: 10px;
      min-width: 0;
      flex: 1;
    }
    .brand img, .mark {
      width: 46px;
      height: 46px;
      object-fit: contain;
      border-radius: var(--radius);
      border: 1px solid var(--line);
      background: #fff;
      flex: none;
    }
    .mark {
      display: grid;
      place-items: center;
      font-weight: 800;
      font-size: 18px;
      color: var(--accent);
      background: var(--accent-soft);
    }
    .hdr.band .mark {
      border-color: rgba(255,255,255,0.35);
      background: rgba(255,255,255,0.15);
      color: #fff;
    }
    .brand h1 {
      margin: 0;
      font-size: ${theme.titleSize};
      font-weight: 800;
      line-height: 1.15;
      letter-spacing: 0.01em;
    }
    .legal, .addr, .contact, .gstin, .sub {
      margin: 2px 0 0;
      color: var(--muted);
      font-size: 9px;
    }
    .gstin { font-weight: 700; color: var(--ink); }
    .meta { min-width: 150px; text-align: right; }
    .doc-title {
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 8px;
      padding-bottom: 6px;
      border-bottom: 1px solid var(--line);
      color: var(--accent);
    }
    .meta-row {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 3px;
    }
    .meta-row span { color: var(--muted); }
    .cards {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .card {
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--soft);
      padding: 10px 12px;
    }
    .card h3 {
      margin: 0 0 6px;
      font-size: 9px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .card strong { font-size: 12px; }
    table { width: 100%; border-collapse: collapse; }
    th, td {
      border: 1px solid var(--line);
      padding: ${variant === "compact" ? "4px 5px" : "6px 7px"};
      vertical-align: top;
    }
    th {
      background: var(--head-bg);
      color: var(--head-fg);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      font-weight: 700;
    }
    .c { text-align: center; }
    .r { text-align: right; }
    .l { text-align: left; }
    .b { font-weight: 700; }
    .item { font-weight: 700; }
    .footer-grid {
      display: grid;
      grid-template-columns: 1.2fr 0.8fr;
      gap: 12px;
      margin-top: auto;
    }
    .words, .bank, .notes {
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 10px 12px;
      background: #fff;
    }
    .words h4, .bank h4, .notes h4 {
      margin: 0 0 6px;
      font-size: 9px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .totals {
      border: 1px solid var(--line);
      border-radius: var(--radius);
      overflow: hidden;
    }
    .tot-row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 6px 10px;
      border-bottom: 1px solid var(--line);
    }
    .tot-row:last-child { border-bottom: 0; }
    .tot-row.grand {
      background: var(--accent);
      color: #fff;
      font-size: 12px;
      font-weight: 800;
    }
    .sign {
      margin-top: 18px;
      text-align: right;
      color: var(--muted);
      font-size: 9px;
    }
    .sign .line {
      margin-top: 28px;
      border-top: 1px solid var(--line);
      display: inline-block;
      min-width: 140px;
      padding-top: 4px;
    }
  </style>
</head>
<body>
  <div class="page">
    ${headerBlock}
    <div class="cards">
      <div class="card">
        <h3>${partyLabel}</h3>
        <strong>${escapeHtml(invoice.partyName || "—")}</strong>
        <p class="sub">${partyAddress}</p>
        ${invoice.partyPhone ? `<p class="sub">${escapeHtml(invoice.partyPhone)}</p>` : ""}
      </div>
      <div class="card">
        <h3>Branch / Place</h3>
        <strong>${escapeHtml(invoice.branchName || "—")}</strong>
        <p class="sub">${escapeHtml(invoice.branchRegion || "")}</p>
        <p class="sub">Due ${escapeHtml(invoice.dueDate || invoice.invoiceDate)}</p>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th class="c" style="width:28px">#</th>
          <th class="l">Particulars</th>
          <th class="r" style="width:70px">Rate</th>
          <th class="r" style="width:78px">Taxable</th>
          ${
            company.enableGst
              ? `<th class="r" style="width:62px">CGST</th><th class="r" style="width:62px">SGST</th>`
              : ""
          }
          <th class="r" style="width:78px">Amount</th>
        </tr>
      </thead>
      <tbody>${rows}${chargeRows}</tbody>
    </table>
    <div class="footer-grid">
      <div>
        <div class="words">
          <h4>Amount in words</h4>
          <div>${escapeHtml(amountWordsPlain(invoice.totalValue))}</div>
        </div>
        <div class="bank" style="margin-top:10px">
          <h4>Bank details</h4>
          <div>${escapeHtml(company.bankName)} · A/c ${escapeHtml(company.accountNo)}</div>
          <div class="sub">IFSC ${escapeHtml(company.ifsc)} · ${escapeHtml(company.branch)}</div>
          <div class="sub">UPI ${escapeHtml(company.upi)}</div>
        </div>
        ${
          invoice.notes
            ? `<div class="notes" style="margin-top:10px"><h4>Notes</h4><div>${escapeHtml(invoice.notes)}</div></div>`
            : ""
        }
      </div>
      <div class="totals">
        <div class="tot-row"><div>Products</div><div>${money(productsSubtotal)}</div></div>
        ${
          chargesTotal > 0
            ? `<div class="tot-row"><div>Charges</div><div>${money(chargesTotal)}</div></div>`
            : ""
        }
        ${
          company.enableGst
            ? `<div class="tot-row"><div>Taxable</div><div>${money(tax.taxable)}</div></div>
               <div class="tot-row"><div>CGST @ ${halfGstPct}%</div><div>${money(cgst)}</div></div>
               <div class="tot-row"><div>SGST @ ${halfGstPct}%</div><div>${money(sgst)}</div></div>`
            : ""
        }
        ${
          roundOff
            ? `<div class="tot-row"><div>Round off</div><div>${roundOff >= 0 ? "" : "-"}${money(Math.abs(roundOff))}</div></div>`
            : ""
        }
        <div class="tot-row grand"><div>Grand total</div><div>${formatINR(invoice.totalValue)}</div></div>
        <div class="tot-row"><div>Received</div><div>${money(invoice.paidAmount)}</div></div>
        <div class="tot-row"><div>Balance due</div><div>${money(invoice.dueAmount)}</div></div>
      </div>
    </div>
    <div class="sign">
      <div>For ${escapeHtml(company.name)}</div>
      <div class="line">Authorised signatory</div>
    </div>
  </div>
</body>
</html>`;
}
