"use client";

import { useMemo, useState } from "react";
import { amountFieldValue, parseAmountInput } from "@/lib/amount-input";

type Props = {
  invoiceId: string;
  dueAmount: number;
  onDone: () => void;
};

export function AddPaymentButton({ invoiceId, dueAmount, onDone }: Props) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [payingDate, setPayingDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const amountValue = useMemo(() => parseAmountInput(amount), [amount]);

  function openModal() {
    setAmount(dueAmount > 0 ? amountFieldValue(dueAmount) : "");
    setPayingDate(new Date().toISOString().slice(0, 10));
    setNote("");
    setProofFile(null);
    setError("");
    setOpen(true);
  }

  async function save() {
    setBusy(true);
    setError("");
    try {
      if (!(amountValue > 0)) {
        setError("Enter a valid amount.");
        return;
      }
      const form = new FormData();
      form.set("invoiceId", invoiceId);
      form.set("amount", String(amountValue));
      form.set("payingDate", payingDate);
      form.set("note", note);
      if (proofFile) form.set("proof", proofFile);

      const res = await fetch("/api/app/payments", {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not save payment.");
        return;
      }
      setOpen(false);
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-bold text-white"
      >
        PAY
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">Add payment</h3>
            <div className="mt-3 space-y-3">
              <label className="block text-xs font-semibold text-slate-600">
                Amount
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                Paying date
                <input
                  type="date"
                  value={payingDate}
                  onChange={(e) => setPayingDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                Note
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Optional"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                Payment proof
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              {error ? <p className="text-xs text-rose-600">{error}</p> : null}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void save()}
                className="flex-1 rounded-xl bg-[#5b2d90] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy ? "Saving…" : "Save payment"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
