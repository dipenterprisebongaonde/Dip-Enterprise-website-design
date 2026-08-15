
import { z } from "zod";
import { roundMoney } from "@/lib/payments";

export const invoiceLineSchema = z.object({
  item: z.string().min(1),
  quantity: z.number().int().positive(),
  /** Billing quantity — multiplies with unit price for line total */
  gross: z.number().int().positive().optional(),
  unitPrice: z.number().nonnegative(),
  amount: z.number().nonnegative().optional(),
});

export const invoiceChargeSchema = z.object({
  label: z.string().min(1).max(80),
  amount: z.number().nonnegative(),
});

export type InvoiceLineInput = z.infer<typeof invoiceLineSchema>;
export type InvoiceChargeInput = z.infer<typeof invoiceChargeSchema>;

export const CHARGE_PRESETS = ["Car fare", "Labour", "Ice"] as const;

export function normalizeInvoiceCharges(rawCharges: InvoiceChargeInput[] | undefined) {
  const charges = (rawCharges || [])
    .map((charge) => ({
      label: charge.label.trim(),
      amount: roundMoney(charge.amount),
    }))
    .filter((charge) => charge.label.length > 0 && charge.amount > 0);

  const chargesTotal = roundMoney(charges.reduce((sum, charge) => sum + charge.amount, 0));
  return { charges, chargesTotal };
}

export function normalizeInvoiceLines(rawLines: InvoiceLineInput[]) {
  const lines = rawLines
    .map((line) => {
      const item = line.item.trim();
      const quantity = line.quantity;
      const gross = line.gross && line.gross > 0 ? line.gross : quantity;
      const unitPrice = roundMoney(line.unitPrice);
      const amount = roundMoney(line.amount ?? gross * unitPrice);
      return { item, quantity, gross, unitPrice, amount };
    })
    .filter((line) => line.item.length > 0 && line.quantity > 0 && line.gross > 0);

  if (lines.length === 0) {
    throw new Error("LINES_REQUIRED");
  }

  const amount = roundMoney(lines.reduce((sum, line) => sum + line.amount, 0));
  const quantity = lines.reduce((sum, line) => sum + line.quantity, 0);
  const gross = lines.reduce((sum, line) => sum + line.gross, 0);
  const item =
    lines.length === 1
      ? lines[0].item
      : lines.map((line) => `${line.item} × ${line.quantity}`).join(", ");
  const unitPrice = gross > 0 ? roundMoney(amount / gross) : 0;

  return { lines, amount, quantity, gross, item, unitPrice };
}

export function linesFromLegacy(invoice: {
  item: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}) {
  return [
    {
      item: invoice.item,
      quantity: invoice.quantity,
      gross: invoice.quantity,
      unitPrice: invoice.unitPrice,
      amount: invoice.amount,
    },
  ];
}
