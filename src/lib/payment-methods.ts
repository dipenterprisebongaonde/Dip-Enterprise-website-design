export const PAYMENT_METHODS = [
  "Cash",
  "UPI",
  "Bank Transfer",
  "Cheque",
  "Card",
  "Other",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export function normalizePaymentMethod(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const match = PAYMENT_METHODS.find((method) => method.toLowerCase() === raw.toLowerCase());
  return match || raw.slice(0, 40);
}