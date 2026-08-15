
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const CONFIRM_PHRASE = "RESET";

export function OperationalResetCard() {
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setOk("");

    const res = await fetch("/api/app/settings/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Could not reset data.");
      return;
    }

    const deleted = data.deleted || {};
    setOk(
      `Cleared ${deleted.sales ?? 0} sales, ${deleted.purchases ?? 0} purchases, ${deleted.inventoryItems ?? 0} inventory items, ${deleted.customers ?? 0} customers, ${deleted.vendors ?? 0} vendors.`
    );
    setConfirm("");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="panel space-y-4 rounded-sm border border-[var(--danger)]/25 p-5">
      <div>
        <h3 className="text-lg font-semibold text-[var(--navy)]">Reset operational data</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Permanently deletes all sales, purchases, inventory, customers, and vendors (including
          payments and payment proofs). Users, branches, expenses, fleet, CCTV, and company
          settings are kept.
        </p>
      </div>

      <label className="block max-w-sm">
        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
          Type {CONFIRM_PHRASE} to confirm
        </span>
        <input
          className="field"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={CONFIRM_PHRASE}
          autoComplete="off"
          spellCheck={false}
        />
      </label>

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      {ok ? <p className="text-sm text-emerald-700">{ok}</p> : null}

      <button
        type="submit"
        className="btn"
        style={{
          background: "var(--danger)",
          color: "#fff",
          borderColor: "var(--danger)",
        }}
        disabled={loading || confirm.trim() !== CONFIRM_PHRASE}
      >
        {loading ? "Resetting..." : "Reset sales, purchases, inventory, customers & vendors"}
      </button>
    </form>
  );
}
