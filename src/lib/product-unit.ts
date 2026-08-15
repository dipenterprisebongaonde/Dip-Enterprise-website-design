
/** Common inventory units; free-text units are also allowed. */
export const PRODUCT_UNITS = [
  "pcs",
  "kg",
  "g",
  "L",
  "ml",
  "m",
  "cm",
  "box",
  "pack",
  "pair",
  "set",
  "roll",
  "dozen",
] as const;

export type ProductUnit = (typeof PRODUCT_UNITS)[number] | string;

export function normalizeProductUnit(value?: string | null) {
  const cleaned = (value || "pcs").trim().replace(/\s+/g, " ");
  return cleaned || "pcs";
}

export function productUnitOptions() {
  return PRODUCT_UNITS.map((unit) => ({ label: unit, value: unit }));
}
