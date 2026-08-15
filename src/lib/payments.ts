import { PaymentStatus } from "@prisma/client";

export function roundMoney(value: number) {
  return Number(Math.max(0, value).toFixed(2));
}

export function roundSignedMoney(value: number) {
  return Number(value.toFixed(2));
}

/** Difference needed to round a subtotal to the nearest rupee. */
export function computeNearestRupeeRoundOff(subtotal: number) {
  const base = roundMoney(subtotal);
  const rounded = Math.round(base);
  return roundSignedMoney(rounded - base);
}

export function resolveInvoiceRoundOff(options: {
  subtotal: number;
  enabled?: boolean;
  roundOff?: number | null;
}) {
  if (options.enabled === false) return 0;
  if (options.enabled === true) {
    return computeNearestRupeeRoundOff(options.subtotal);
  }
  if (typeof options.roundOff === "number" && Number.isFinite(options.roundOff)) {
    return roundSignedMoney(options.roundOff);
  }
  return 0;
}

export function resolvePaymentStatus(amount: number, paidAmount: number): PaymentStatus {
  const total = roundMoney(amount);
  const paid = roundMoney(paidAmount);

  if (paid <= 0) return PaymentStatus.UNPAID;
  if (paid + 0.001 >= total) return PaymentStatus.PAID;
  return PaymentStatus.PARTIAL;
}

export function normalizeInitialPaidAmount(options: {
  amount: number;
  paymentStatus: "PAID" | "UNPAID" | "PARTIAL";
  paidAmount?: number | null;
}) {
  const total = roundMoney(options.amount);

  if (options.paymentStatus === "UNPAID") {
    return 0;
  }

  if (options.paymentStatus === "PAID") {
    return total;
  }

  const paid = roundMoney(options.paidAmount ?? 0);
  if (paid <= 0) {
    throw new Error("PARTIAL_REQUIRES_PAID_AMOUNT");
  }
  if (paid >= total) {
    throw new Error("PARTIAL_MUST_BE_LESS_THAN_TOTAL");
  }
  return paid;
}

export function dueAmount(amount: number, paidAmount: number) {
  return roundMoney(Math.max(0, amount - paidAmount));
}

export function summarizePartyInvoices(
  invoices: Array<{ amount: number; paidAmount: number }>
) {
  const totalBilled = roundMoney(invoices.reduce((sum, invoice) => sum + invoice.amount, 0));
  const moneyTaken = roundMoney(invoices.reduce((sum, invoice) => sum + invoice.paidAmount, 0));
  const balance = roundMoney(Math.max(0, totalBilled - moneyTaken));

  return {
    totalBilled,
    moneyTaken,
    balance,
    invoiceCount: invoices.length,
  };
}
