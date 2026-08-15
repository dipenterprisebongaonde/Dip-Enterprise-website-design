"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { LedgerDeleteAction } from "@/lib/party-ledger";

export function DeleteLedgerEntryButton({ action }: { action: LedgerDeleteAction }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onDelete() {
    const ok = window.confirm(action.confirm);
    if (!ok) return;

    setLoading(true);
    setError("");
    try {
      const res = await fetch(action.endpoint, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not delete");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not delete");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ledger-delete">
      <button
        type="button"
        className="ledger-delete-btn"
        disabled={loading}
        onClick={onDelete}
      >
        {loading ? "Deleting..." : action.label}
      </button>
      {error ? <span className="text-xs text-[var(--danger)]">{error}</span> : null}
    </div>
  );
}
