"use client";

import { useEffect, useRef, useState } from "react";
import { INVOICE_PDF_TEMPLATES } from "@/lib/invoice-pdf-templates";

function filenameFromDisposition(header: string | null, fallback: string) {
  if (!header) return fallback;
  const utf = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf?.[1]) {
    try {
      return decodeURIComponent(utf[1].trim());
    } catch {
      /* fall through */
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain?.[1]?.trim() || fallback;
}

export function InvoicePdfActions({
  kind,
  id,
}: {
  kind: "sales" | "purchases";
  id: string;
}) {
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const base = `/api/app/${kind}/${id}/pdf`;

  async function downloadPdf(formatId: string, label: string) {
    setBusyId(formatId);
    setError("");
    try {
      const res = await fetch(`${base}?format=${encodeURIComponent(formatId)}&download=1`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!res.ok) {
        let message = `Could not download ${label}.`;
        try {
          const data = (await res.json()) as { error?: string };
          if (data.error) message = data.error;
        } catch {
          /* non-JSON error body */
        }
        setError(message);
        return;
      }
      const type = res.headers.get("Content-Type") || "";
      if (!type.includes("pdf")) {
        setError("Server did not return a PDF. Try again.");
        return;
      }
      const blob = await res.blob();
      if (!blob.size) {
        setError("PDF was empty. Try again.");
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filenameFromDisposition(
        res.headers.get("Content-Disposition"),
        `invoice-${formatId}.pdf`,
      );
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setOpen(false);
    } catch {
      setError("Could not download PDF. Check your connection and try again.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="pdf-actions" ref={rootRef}>
      <button
        className="btn btn-ghost px-3 py-1.5 text-sm"
        type="button"
        aria-expanded={open}
        onClick={() => {
          setError("");
          setOpen((v) => !v);
        }}
      >
        PDF
      </button>
      {open ? (
        <div className="pdf-menu">
          <p>Invoice PDF</p>
          {INVOICE_PDF_TEMPLATES.map((template) => {
            const label =
              template.kind === "a4" ? `A4 · ${template.name}` : template.name;
            const busy = busyId === template.id;
            return (
              <button
                key={template.id}
                type="button"
                disabled={busyId !== null}
                onClick={() => void downloadPdf(template.id, label)}
              >
                {busy ? "Preparing…" : label}
              </button>
            );
          })}
          <a
            className="pdf-menu-preview"
            href={`${base}?view=html`}
            target="_blank"
            rel="noreferrer"
          >
            Open HTML preview
          </a>
          {error ? <p className="pdf-menu-error">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
