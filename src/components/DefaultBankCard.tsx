"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export type DefaultBankValues = {
  bankName: string;
  accountNo: string;
  ifsc: string;
  bankBranch: string;
  upi: string;
};

export function DefaultBankCard({ initial }: { initial: DefaultBankValues }) {
  const router = useRouter();
  const [values, setValues] = useState({
    bankName: initial.bankName || "",
    accountNo: initial.accountNo || "",
    ifsc: initial.ifsc || "",
    bankBranch: initial.bankBranch || "",
    upi: initial.upi || "",
  });
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);

  function updateField<K extends keyof DefaultBankValues>(key: K, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setOk("");

    try {
      const res = await fetch("/api/app/settings/bank", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        setError(data.error || "Could not save default bank.");
        return;
      }

      if (data.bank) {
        setValues({
          bankName: data.bank.bankName || "",
          accountNo: data.bank.accountNo || "",
          ifsc: data.bank.ifsc || "",
          bankBranch: data.bank.bankBranch || "",
          upi: data.bank.upi || "",
        });
      }
      setOk("Default bank account saved for all branches.");
      router.refresh();
    } catch {
      setLoading(false);
      setError("Could not save default bank.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="settings-block">
      <div className="settings-block-head">
        <h3>Default bank (all branches)</h3>
        <p>
          Used on invoice PDFs when a branch has no bank details of its own. Applies across every
          branch.
        </p>
      </div>

      <div className="invoice-grid">
        <label>
          <span>Bank name</span>
          <input
            className="field"
            required
            value={values.bankName}
            onChange={(e) => updateField("bankName", e.target.value)}
          />
        </label>
        <label>
          <span>Account number</span>
          <input
            className="field"
            required
            value={values.accountNo}
            onChange={(e) => updateField("accountNo", e.target.value)}
          />
        </label>
        <label>
          <span>IFSC</span>
          <input
            className="field"
            required
            value={values.ifsc}
            onChange={(e) => updateField("ifsc", e.target.value)}
          />
        </label>
        <label>
          <span>Bank branch</span>
          <input
            className="field"
            required
            value={values.bankBranch}
            onChange={(e) => updateField("bankBranch", e.target.value)}
          />
        </label>
        <label>
          <span>UPI</span>
          <input
            className="field"
            required
            value={values.upi}
            onChange={(e) => updateField("upi", e.target.value)}
          />
        </label>
      </div>

      {error ? <p className="mt-4 text-sm text-[var(--danger)]">{error}</p> : null}
      {ok ? <p className="mt-4 text-sm text-emerald-700">{ok}</p> : null}

      <div className="invoice-actions mt-4">
        <button className="btn btn-primary" disabled={loading} type="submit">
          {loading ? "Saving…" : "Save default bank"}
        </button>
      </div>
    </form>
  );
}
