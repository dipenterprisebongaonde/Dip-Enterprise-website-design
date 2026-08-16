"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ProofLocalPreview } from "@/components/PaymentProofView";
import { PAYMENT_PROOF_ACCEPT } from "@/lib/payment-proof";

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

type Mode = "PAY" | "ADVANCE" | "APPLY";

export function PartyPaymentActions({
  kind,
  id,
  balance,
  advanceBalance,
  invoiceDue,
}: {
  kind: "customers" | "vendors";
  id: string;
  balance: number;
  advanceBalance: number;
  invoiceDue: number;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode | null>(null);
  const [amount, setAmount] = useState(balance > 0 ? balance : 0);
  const [paidAt, setPaidAt] = useState(todayInputValue());
  const [note, setNote] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const applyMax = Math.max(
    0,
    Math.min(Number(advanceBalance) || 0, Number(invoiceDue) || 0)
  );
  const canApply = applyMax > 0;

  function openMode(next: Mode) {
    setMode(next);
    if (next === "PAY") {
      setAmount(balance > 0 ? balance : 0);
    } else if (next === "APPLY") {
      setAmount(applyMax);
    } else {
      setAmount(0);
    }
    setPaidAt(todayInputValue());
    setNote("");
    setProof(null);
    setError("");
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!mode) return;
    setLoading(true);
    setError("");

    const form = new FormData();
    form.append("amount", String(Number(amount)));
    form.append("type", mode);
    form.append("paidAt", paidAt);
    if (note.trim()) form.append("note", note.trim());
    if (proof && mode !== "APPLY") form.append("proof", proof);

    const res = await fetch(`/api/app/${kind}/${id}/payments`, {
      method: "POST",
      body: form,
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Could not save payment");
      return;
    }

    setMode(null);
    setProof(null);
    router.refresh();
  }

  const title =
    mode === "PAY"
      ? "Record payment against dues"
      : mode === "APPLY"
        ? "Settlement from advance"
        : "Add advance payment";

  const submitLabel =
    mode === "PAY" ? "Save payment" : mode === "APPLY" ? "Settle" : "Save advance";

  return (
    <div className="party-pay">
      <div className="payment-meta">
        <span className={`payment-chip ${balance > 0 ? "due" : "paid"}`}>
          Balance ₹{balance.toLocaleString()}
        </span>
        <span className="payment-chip">Advance ₹{advanceBalance.toLocaleString()}</span>
      </div>

      {!mode ? (
        <div className="party-pay-actions">
          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: "0.35rem 0.7rem", fontSize: "0.8rem" }}
            onClick={() => openMode("PAY")}
          >
            Pay
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: "0.35rem 0.7rem", fontSize: "0.8rem" }}
            onClick={() => openMode("ADVANCE")}
          >
            Advance
          </button>
          {canApply ? (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ padding: "0.35rem 0.7rem", fontSize: "0.8rem" }}
              onClick={() => openMode("APPLY")}
            >
              Settlement
            </button>
          ) : null}
        </div>
      ) : (
        <form className="add-payment-form" onSubmit={onSubmit}>
          <p className="party-pay-title">{title}</p>
          <label>
            <span>Amount</span>
            <input
              className="field"
              type="number"
              min={0.01}
              max={mode === "APPLY" ? applyMax : undefined}
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value) || 0)}
            />
          </label>
          <label>
            <span>{mode === "APPLY" ? "Settlement date" : "Paying date"}</span>
            <input
              className="field"
              type="date"
              required
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
            />
          </label>
          <label>
            <span>Note</span>
            <input
              className="field"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional"
            />
          </label>
          {mode !== "APPLY" ? (
            <label className="proof-upload">
              <span>Payment proof</span>
              <input
                className="field"
                type="file"
                accept={PAYMENT_PROOF_ACCEPT}
                onChange={(e) => setProof(e.target.files?.[0] || null)}
              />
              <span className="field-hint">Screenshot or PDF (optional, max 8 MB)</span>
              <ProofLocalPreview file={proof} />
            </label>
          ) : null}
          {mode === "PAY" ? (
            <p className="party-pay-hint">
              Applies to oldest unpaid invoices first. Extra amount becomes advance.
            </p>
          ) : null}
          {mode === "APPLY" ? (
            <p className="party-pay-hint">
              Settles existing advance (max ₹{applyMax.toLocaleString()}) against oldest unpaid
              invoices first.
            </p>
          ) : null}
          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
          <div className="add-payment-actions">
            <button className="btn btn-primary" disabled={loading} type="submit">
              {loading ? "Saving..." : submitLabel}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setMode(null);
                setError("");
                setProof(null);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
