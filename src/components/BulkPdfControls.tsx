
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type BulkPdfContextValue = {
  kind: "sales" | "purchases";
  selected: Set<string>;
  allIds: string[];
  toggle: (id: string) => void;
  toggleAll: () => void;
  clear: () => void;
  download: () => Promise<void>;
  loading: boolean;
  error: string;
};

const BulkPdfContext = createContext<BulkPdfContextValue | null>(null);

function useBulkPdf() {
  const ctx = useContext(BulkPdfContext);
  if (!ctx) throw new Error("Bulk PDF controls require BulkPdfProvider");
  return ctx;
}

export function BulkPdfProvider({
  kind,
  ids,
  children,
}: {
  kind: "sales" | "purchases";
  ids: string[];
  children: ReactNode;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const toggle = useCallback((id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((current) => {
      if (current.size === ids.length) return new Set();
      return new Set(ids);
    });
  }, [ids]);

  const clear = useCallback(() => setSelected(new Set()), []);

  const download = useCallback(async () => {
    if (selected.size === 0) {
      setError("Select at least one invoice.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/app/${kind}/pdf-bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selected] }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Could not download invoices.");
        setLoading(false);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      anchor.href = url;
      anchor.download =
        kind === "sales"
          ? `sales-invoices-${stamp}.zip`
          : `purchase-invoices-${stamp}.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setLoading(false);
    } catch {
      setError("Network error while downloading.");
      setLoading(false);
    }
  }, [kind, selected]);

  const value = useMemo(
    () => ({
      kind,
      selected,
      allIds: ids,
      toggle,
      toggleAll,
      clear,
      download,
      loading,
      error,
    }),
    [kind, selected, ids, toggle, toggleAll, clear, download, loading, error]
  );

  return <BulkPdfContext.Provider value={value}>{children}</BulkPdfContext.Provider>;
}

export function BulkPdfToolbar({ label }: { label: string }) {
  const { selected, allIds, toggleAll, clear, download, loading, error } = useBulkPdf();
  const allSelected = allIds.length > 0 && selected.size === allIds.length;

  return (
    <div className="bulk-pdf-toolbar">
      <div>
        <h3 className="text-lg font-bold text-[var(--navy)]">{label}</h3>
        <p className="text-sm text-[var(--muted)]">
          Select invoices and download as a ZIP of PDFs.
        </p>
      </div>
      <div className="bulk-pdf-actions">
        <button type="button" className="btn btn-ghost" onClick={toggleAll} disabled={!allIds.length}>
          {allSelected ? "Clear all" : "Select all"}
        </button>
        {selected.size > 0 ? (
          <button type="button" className="btn btn-ghost" onClick={clear}>
            Clear ({selected.size})
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn-primary"
          onClick={download}
          disabled={loading || selected.size === 0}
        >
          {loading
            ? "Preparing ZIP..."
            : selected.size > 0
              ? `Download ${selected.size} PDF${selected.size === 1 ? "" : "s"}`
              : "Download PDFs"}
        </button>
      </div>
      {error ? <p className="bulk-pdf-error">{error}</p> : null}
    </div>
  );
}

export function BulkPdfSelectAll() {
  const { selected, allIds, toggleAll } = useBulkPdf();
  const allSelected = allIds.length > 0 && selected.size === allIds.length;
  const partial = selected.size > 0 && !allSelected;

  return (
    <input
      type="checkbox"
      className="bulk-pdf-check"
      checked={allSelected}
      ref={(el) => {
        if (el) el.indeterminate = partial;
      }}
      onChange={toggleAll}
      aria-label="Select all invoices"
      disabled={allIds.length === 0}
    />
  );
}

export function BulkPdfCheckbox({ id, label }: { id: string; label: string }) {
  const { selected, toggle } = useBulkPdf();
  return (
    <input
      type="checkbox"
      className="bulk-pdf-check"
      checked={selected.has(id)}
      onChange={() => toggle(id)}
      aria-label={`Select ${label}`}
    />
  );
}
