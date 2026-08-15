export type InvoiceNumberKind = "sale" | "purchase";

/** Indian financial year label, e.g. 26-27 for Apr 2026–Mar 2027. */
export function getIndianFinancialYear(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0 = Jan
  const startYear = month >= 3 ? year : year - 1;
  const endYear = startYear + 1;
  return {
    startYear,
    endYear,
    label: `${String(startYear).slice(-2)}-${String(endYear).slice(-2)}`,
  };
}

export function parseDateInput(value?: string | null) {
  if (!value) return new Date();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    const fallback = new Date(value);
    return Number.isNaN(fallback.getTime()) ? new Date() : fallback;
  }
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  return new Date(year, month, day);
}

export function invoiceDocPrefix(kind: InvoiceNumberKind) {
  return kind === "sale" ? "INV" : "PUR";
}

/** Format like `INV 26-27/0001` or `PUR 26-27/0001`. */
export function formatInvoiceNumber(
  kind: InvoiceNumberKind,
  sequence: number,
  date = new Date()
) {
  const fy = getIndianFinancialYear(date).label;
  const prefix = invoiceDocPrefix(kind);
  const seq = Math.max(1, Math.trunc(sequence));
  return `${prefix} ${fy}/${String(seq).padStart(4, "0")}`;
}

export function parseInvoiceSequence(
  invoiceNo: string,
  kind: InvoiceNumberKind,
  fy: string
) {
  const prefix = invoiceDocPrefix(kind);
  const match = invoiceNo.trim().match(
    new RegExp(`^${prefix}\\s+${fy.replace("-", "\\-")}\\/(\\d{1,6})$`, "i")
  );
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

/** True when value looks like `INV 26-27/0001` / `PUR 26-27/0001`. */
export function isAutoInvoiceNumber(invoiceNo: string, kind: InvoiceNumberKind) {
  const prefix = invoiceDocPrefix(kind);
  return new RegExp(`^${prefix}\\s+\\d{2}-\\d{2}\\/\\d{1,6}$`, "i").test(
    invoiceNo.trim()
  );
}

/** Keep sequence, swap FY to match date. Returns null if not auto-format. */
export function applyFinancialYearToInvoiceNumber(
  invoiceNo: string,
  kind: InvoiceNumberKind,
  date: Date
) {
  const prefix = invoiceDocPrefix(kind);
  const match = invoiceNo.trim().match(
    new RegExp(`^${prefix}\\s+(\\d{2}-\\d{2})\\/(\\d{1,6})$`, "i")
  );
  if (!match) return null;
  const fy = getIndianFinancialYear(date).label;
  if (match[1] === fy) return invoiceNo.trim();
  return formatInvoiceNumber(kind, Number(match[2]), date);
}
