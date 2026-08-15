import { dueAmount, roundMoney } from "@/lib/payments";
import type { ProofSource } from "@/lib/payment-proof";

export type LedgerDeleteAction = {
  label: string;
  confirm: string;
  endpoint: string;
};

export type LedgerEntry = {
  id: string;
  date: Date;
  particulars: string;
  ref: string;
  debit: number;
  credit: number;
  balance: number;
  kind: "invoice" | "payment" | "advance";
  href?: string;
  proofUrl?: string | null;
  proofFileName?: string | null;
  proofMimeType?: string | null;
  proofPaymentId?: string | null;
  proofSource?: ProofSource | null;
  deleteAction?: LedgerDeleteAction | null;
};

type InvoiceLike = {
  id: string;
  invoiceNo: string;
  invoiceDate: Date;
  amount: number;
  paidAmount: number;
  item: string;
  paymentStatus: string;
  createdAt: Date;
  payments: Array<{
    id: string;
    amount: number;
    note: string | null;
    paidAt: Date;
    createdAt: Date;
    proofUrl?: string | null;
    proofFileName?: string | null;
    proofMimeType?: string | null;
  }>;
};

type PartyPaymentLike = {
  id: string;
  amount: number;
  type: "PAY" | "ADVANCE" | "APPLY";
  note: string | null;
  paidAt: Date;
  createdAt: Date;
  proofUrl?: string | null;
  proofFileName?: string | null;
  proofMimeType?: string | null;
};

export function buildPartyLedger(options: {
  invoices: InvoiceLike[];
  partyPayments: PartyPaymentLike[];
  invoiceHrefBase: string;
  invoiceProofSource: Extract<ProofSource, "sale" | "purchase">;
  partyProofSource: Extract<ProofSource, "customer" | "vendor">;
  partyId: string;
  allowDeleteInvoices?: boolean;
}) {
  const invoiceApiBase =
    options.invoiceProofSource === "sale" ? "/api/app/sales" : "/api/app/purchases";
  const partyApiBase =
    options.partyProofSource === "customer"
      ? `/api/app/customers/${options.partyId}`
      : `/api/app/vendors/${options.partyId}`;

  const raw: Array<Omit<LedgerEntry, "balance">> = [];

  for (const invoice of options.invoices) {
    raw.push({
      id: `inv-${invoice.id}`,
      date: invoice.invoiceDate,
      particulars: `Invoice · ${invoice.item}`,
      ref: invoice.invoiceNo,
      debit: roundMoney(invoice.amount),
      credit: 0,
      kind: "invoice",
      href: `${options.invoiceHrefBase}/${invoice.id}/edit`,
      deleteAction: options.allowDeleteInvoices
        ? {
            label: "Delete",
            confirm: `Delete invoice ${invoice.invoiceNo}? Stock and totals will be recalculated.`,
            endpoint: `${invoiceApiBase}/${invoice.id}`,
          }
        : null,
    });

    for (const payment of invoice.payments) {
      raw.push({
        id: `pay-${payment.id}`,
        date: payment.paidAt,
        particulars: payment.note || "Payment received",
        ref: invoice.invoiceNo,
        debit: 0,
        credit: roundMoney(payment.amount),
        kind: "payment",
        href: `${options.invoiceHrefBase}/${invoice.id}/edit`,
        proofUrl: payment.proofUrl || null,
        proofFileName: payment.proofFileName || null,
        proofMimeType: payment.proofMimeType || null,
        proofPaymentId: payment.proofUrl ? payment.id : null,
        proofSource: payment.proofUrl ? options.invoiceProofSource : null,
        deleteAction: {
          label: "Delete",
          confirm: `Delete this payment of ₹${roundMoney(payment.amount).toLocaleString()} on ${invoice.invoiceNo}?`,
          endpoint: `${invoiceApiBase}/${invoice.id}/payments/${payment.id}`,
        },
      });
    }
  }

  for (const payment of options.partyPayments) {
    if (payment.type !== "ADVANCE") continue;
    raw.push({
      id: `adv-${payment.id}`,
      date: payment.paidAt,
      particulars: payment.note || "Advance payment",
      ref: "ADVANCE",
      debit: 0,
      credit: roundMoney(payment.amount),
      kind: "advance",
      proofUrl: payment.proofUrl || null,
      proofFileName: payment.proofFileName || null,
      proofMimeType: payment.proofMimeType || null,
      proofPaymentId: payment.proofUrl ? payment.id : null,
      proofSource: payment.proofUrl ? options.partyProofSource : null,
      deleteAction: {
        label: "Delete",
        confirm: `Delete this advance of ₹${roundMoney(payment.amount).toLocaleString()}?`,
        endpoint: `${partyApiBase}/payments/${payment.id}`,
      },
    });
  }

  raw.sort((a, b) => {
    const byDate = a.date.getTime() - b.date.getTime();
    if (byDate !== 0) return byDate;
    // Invoices before payments on same day; advances after.
    const rank = { invoice: 0, payment: 1, advance: 2 } as const;
    return rank[a.kind] - rank[b.kind];
  });

  let running = 0;
  const entries: LedgerEntry[] = raw.map((entry) => {
    running = roundMoney(running + entry.debit - entry.credit);
    return { ...entry, balance: running };
  });

  const invoiceDue = roundMoney(
    options.invoices.reduce(
      (sum, invoice) => sum + dueAmount(invoice.amount, invoice.paidAmount),
      0
    )
  );

  return { entries, runningBalance: running, invoiceDue };
}
