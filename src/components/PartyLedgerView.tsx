import Link from "next/link";
import { DeleteLedgerEntryButton } from "@/components/DeleteLedgerEntryButton";
import { PartyEditForm } from "@/components/PartyEditForm";
import { PartyPaymentActions } from "@/components/PartyPaymentActions";
import { PaymentProofView } from "@/components/PaymentProofView";
import { LedgerEntry } from "@/lib/party-ledger";

function money(value: number) {
  return `₹${value.toLocaleString()}`;
}

function statusClass(status: string) {
  if (status === "PAID") return "ok";
  if (status === "PARTIAL") return "accent";
  return "warn";
}

export function PartyLedgerView({
  kind,
  backHref,
  title,
  subtitle,
  partyId,
  contact,
  summary,
  entries,
  invoices,
}: {
  kind: "customers" | "vendors";
  backHref: string;
  title: string;
  subtitle: string;
  partyId: string;
  contact: {
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    branchName: string;
  };
  summary: {
    totalBilled: number;
    balance: number;
    advanceBalance: number;
    invoiceDue: number;
    invoiceCount: number;
  };
  entries: LedgerEntry[];
  invoices: Array<{
    id: string;
    invoiceNo: string;
    invoiceDate: Date;
    item: string;
    amount: number;
    paidAmount: number;
    paymentStatus: string;
    href: string;
  }>;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={backHref} className="btn btn-ghost" style={{ padding: "0.3rem 0.7rem" }}>
            ← Back
          </Link>
          <h2 className="brand-display mt-3 text-3xl">{title}</h2>
          <p className="text-[var(--muted)]">{subtitle}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-sm text-[var(--muted)]">
            <span>{contact.branchName}</span>
            <span>·</span>
            <span>{contact.phone || "No phone"}</span>
            <span>·</span>
            <span>{contact.email || "No email"}</span>
          </div>
          {contact.address ? (
            <p className="mt-1 text-sm text-[var(--muted)]">{contact.address}</p>
          ) : null}
          <div className="mt-3">
            <PartyEditForm
              kind={kind}
              party={{
                id: partyId,
                name: title,
                email: contact.email,
                phone: contact.phone,
                address: contact.address,
              }}
            />
          </div>
        </div>
        <PartyPaymentActions
          kind={kind}
          id={partyId}
          balance={summary.balance}
          advanceBalance={summary.advanceBalance}
          invoiceDue={summary.invoiceDue}
        />
      </div>

      <div className="ledger-summary">
        <div>
          <p>Total billed</p>
          <strong>{money(summary.totalBilled)}</strong>
        </div>
        <div>
          <p>Invoices</p>
          <strong>{summary.invoiceCount}</strong>
        </div>
        <div>
          <p>Advance</p>
          <strong>{money(summary.advanceBalance)}</strong>
        </div>
        <div>
          <p>Balance</p>
          <strong>{money(summary.balance)}</strong>
        </div>
      </div>

      <div className="panel overflow-x-auto rounded-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-lg font-bold text-[var(--navy)]">Ledger</h3>
          <span className="text-sm text-[var(--muted)]">
            Running balance after each entry
          </span>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Particulars</th>
              <th>Ref</th>
              <th>Debit</th>
              <th>Credit</th>
              <th>Balance</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.date.toLocaleDateString()}</td>
                <td>
                  {entry.href ? (
                    <Link href={entry.href} className="party-link">
                      {entry.particulars}
                    </Link>
                  ) : (
                    entry.particulars
                  )}
                  <div className="text-xs text-[var(--muted)]">
                    {entry.kind === "invoice"
                      ? "Invoice"
                      : entry.kind === "advance"
                        ? "Advance"
                        : "Payment"}
                    {entry.proofUrl ? (
                      <div className="mt-1">
                        <PaymentProofView
                          url={entry.proofUrl}
                          fileName={entry.proofFileName}
                          mimeType={entry.proofMimeType}
                          compact
                          removeSource={entry.proofSource}
                          removePaymentId={entry.proofPaymentId}
                        />
                      </div>
                    ) : null}
                  </div>
                </td>
                <td>{entry.ref}</td>
                <td>{entry.debit > 0 ? money(entry.debit) : "—"}</td>
                <td>{entry.credit > 0 ? money(entry.credit) : "—"}</td>
                <td className="font-semibold">{money(entry.balance)}</td>
                <td>
                  {entry.deleteAction ? (
                    <DeleteLedgerEntryButton action={entry.deleteAction} />
                  ) : (
                    <span className="text-[var(--muted)]">—</span>
                  )}
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={7} className="text-[var(--muted)]">
                  No ledger entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="panel overflow-x-auto rounded-sm">
        <h3 className="mb-3 text-lg font-bold text-[var(--navy)]">Invoices</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Inv No</th>
              <th>Date</th>
              <th>Item</th>
              <th>Total</th>
              <th>Paid</th>
              <th>Due</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => {
              const due = roundDue(invoice.amount, invoice.paidAmount);
              return (
                <tr key={invoice.id}>
                  <td>
                    <Link href={invoice.href} className="party-link">
                      {invoice.invoiceNo}
                    </Link>
                  </td>
                  <td>{invoice.invoiceDate.toLocaleDateString()}</td>
                  <td>{invoice.item}</td>
                  <td>{money(invoice.amount)}</td>
                  <td>{money(invoice.paidAmount)}</td>
                  <td>{money(due)}</td>
                  <td>
                    <span className={`status-pill ${statusClass(invoice.paymentStatus)}`}>
                      {invoice.paymentStatus}
                    </span>
                  </td>
                </tr>
              );
            })}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={7} className="text-[var(--muted)]">
                  No invoices linked to this party.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function roundDue(amount: number, paidAmount: number) {
  return Number(Math.max(0, amount - paidAmount).toFixed(2));
}
