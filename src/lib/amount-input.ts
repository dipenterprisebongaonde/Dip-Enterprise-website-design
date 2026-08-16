/** Display helper: blank amount inputs instead of showing 0. */
export function amountFieldValue(value: number | string | null | undefined) {
  if (value === "" || value == null) return "";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n === 0) return "";
  return String(n);
}

/** Parse an amount input; empty → 0 for math, caller validates > 0 when required. */
export function parseAmountInput(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return 0;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : 0;
}
