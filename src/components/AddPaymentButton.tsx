"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PaymentProofView, ProofLocalPreview } from "@/components/PaymentProofView";
import { PAYMENT_PROOF_ACCEPT } from "@/lib/payment-proof";

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function formatPaidDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString();
}

type PayMode = "PAYMENT" | "SETTLEMENT";

export function AddPaymentButton({
  kind,
  id,
  dueAmount,
  paidAmount,
  advanceBalance = 0,
  lastPaidAt,
  lastPaymentMethod,
  lastProofUrl,
  lastProofName,
  lastProofMime,
  lastProofPaymentId,
}: {
  kind: "sales" | "purchases";
  id: string;
  dueAmount: number;
  paidAmount: number;
  advanceBalance?: number;
  lastPaidAt?: string | null;
  lastPaymentMethod?: string | null;
  lastProofUrl?: string | null;
  lastProofName?: string | null;
  lastProofMime?: string | null;
  lastProofPaymentId?: string | null;
}) {
  void lastPaymentMethod;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<PayMode>("PAYMENT");
  const settleMax = useMemo(
    () => Math.max(0, Math.min(Number(dueAmount) || 0, Number(advanceBalance) || 0)),
    [dueAmount, advanceBalance],
  );
  const canSettle = settleMax > 0;
  const [amount, setAmount] = useState(dueAmount > 0 ? dueAmount : 0);
  const [paidAt, setPaidAt] = useState(todayInputValue());
  const [note, setNote] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const lastPaidLabel = formatPaidDate(lastPaidAt);

  const proofView = (
    <PaymentProofView
      url={lastProofUrl}
      fileName={lastProofName}
      mimeType={lastProofMime}
      compact
      removeSource={kind === "sales" ? "sale" : "purchase"}
      removePaymentId={lastProofPaymentId}
    />
  );

  function openForm(nextMode: PayMode) {
    setMode(nextMode);
    setOpen(true);
    setError("");
    setProof(null);
    setNote("");
    setPaidAt(todayInputValue());
    if (nextMode === "SETTLEMENT") {
      setAmount(settleMax);
    } else {
      setAmount(dueAmount > 0 ? dueAmount : 0);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.set("amount", String(amount));
      formData.set("paidAt", paidAt);
      formData.set("note", note);
      if (mode === "SETTLEMENT") {
        formData.set("settleFromAdvance", "1");
      } else if (proof) {
        formData.set("proof", proof);
      }

      const res = await fetch(`/api/app/${kind}/${id}/payments`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Unable to add payment");
        return;
      }
      setOpen(false);
      setNote("");
      setProof(null);
      setPaidAt(todayInputValue());
      router.refresh();
    } catch {
      setError("Unable to add payment");
    } finally {
      setLoading(false);
    }
  }

  if (dueAmount <= 0) {
    return (
      <div className="payment-meta">
        <span className="muted">Fully paid · ₹{paidAmount.toLocaleString("en-IN")}</span>
        {lastPaidLabel ? <span className="muted">Last paid {lastPaidLabel}</span> : null}
        {proofView}
      </div>
    );
  }

  return (
    <div className="payment-actions">
      <div className="payment-meta">
        <span className="muted">Paid ₹{paidAmount.toLocaleString("en-IN")}</span>
        {Number(advanceBalance) > 0 ? (
          <span className="payment-chip">Advance ₹{Number(advanceBalance).toLocaleString("en-IN")}</span>
        ) : null}
        {lastPaidLabel ? <span className="muted">Last paid {lastPaidLabel}</span> : null}
        {proofView}
      </div>
      {!open ? (
        <div className="party-pay-actions">
          <button type="button" className="btn btn-secondary" onClick={() => openForm("PAYMENT")}>
            + Payment
          </button>
          {canSettle ? (
            <button type="button" className="btn btn-ghost" onClick={() => openForm("SETTLEMENT")}>
              Settlement
            </button>
          ) : null}
        </div>
      ) : (
        <form className="inline-payment-form" onSubmit={onSubmit}>
          <p className="party-pay-title">
            {mode === "SETTLEMENT" ? "Settlement from advance" : "Record payment"}
          </p>
          <input
            type="number"
            min={0.01}
            max={mode === "SETTLEMENT" ? settleMax : dueAmount}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            required
          />
          <input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} required />
          <input
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {mode === "PAYMENT" ? (
            <>
              <input
                type="file"
                accept={PAYMENT_PROOF_ACCEPT}
                onChange={(e) => setProof(e.target.files?.[0] || null)}
              />
              <ProofLocalPreview file={proof} />
            </>
          ) : (
            <p className="party-pay-hint">
              Uses party advance (max ₹{settleMax.toLocaleString("en-IN")}) against this bill.
            </p>
          )}
          <button className="btn btn-primary" disabled={loading}>
            {loading ? "Saving..." : mode === "SETTLEMENT" ? "Settle" : "Save"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setOpen(false);
              setError("");
              setProof(null);
            }}
          >
            Cancel
          </button>
          {error ? <p className="error">{error}</p> : null}
        </form>
      )}
    </div>
  );
}
