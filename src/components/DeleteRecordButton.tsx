
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const LABELS = {
  sales: { singular: "sale invoice", path: "sales" },
  purchases: { singular: "purchase invoice", path: "purchases" },
  expenses: { singular: "expense", path: "expenses" },
  inventory: { singular: "product", path: "inventory" },
} as const;

export function DeleteRecordButton({
  kind,
  id,
  label,
  redirectTo,
}: {
  kind: keyof typeof LABELS;
  id: string;
  label: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onDelete() {
    const meta = LABELS[kind];
    const ok = window.confirm(
      kind === "expenses"
        ? `Delete expense "${label}"? Overview expense totals will update.`
        : kind === "inventory"
          ? `Delete product "${label}"? Stock movements for this product will also be removed.`
          : `Delete ${meta.singular} ${label}? Stock and totals will be recalculated.`
    );
    if (!ok) return;

    setLoading(true);
    setError("");
    const res = await fetch(`/api/app/${meta.path}/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Could not delete");
      return;
    }

    if (redirectTo) {
      router.push(redirectTo);
      router.refresh();
      return;
    }

    router.refresh();
  }

  return (
    <div className="inline-flex flex-col gap-1">
      <button
        className="btn btn-ghost"
        style={{ padding: "0.35rem 0.7rem", fontSize: "0.8rem", color: "var(--danger)" }}
        disabled={loading}
        onClick={onDelete}
        type="button"
      >
        {loading ? "Deleting..." : "Delete"}
      </button>
      {error ? <span className="text-xs text-[var(--danger)]">{error}</span> : null}
    </div>
  );
}

/** @deprecated Use DeleteRecordButton */
export function DeleteInvoiceButton({
  kind,
  id,
  invoiceNo,
}: {
  kind: "sales" | "purchases";
  id: string;
  invoiceNo: string;
}) {
  return <DeleteRecordButton kind={kind} id={id} label={invoiceNo} />;
}
