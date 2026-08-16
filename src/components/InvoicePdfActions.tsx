"use client";

import { useEffect, useRef, useState } from "react";
import { INVOICE_PDF_TEMPLATES } from "@/lib/invoice-pdf-templates";

export function InvoicePdfActions({
  kind,
  id,
}: {
  kind: "sales" | "purchases";
  id: string;
}) {
  const [open, setOpen] = useState(false);
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

  return (
    <div className="pdf-actions" ref={rootRef}>
      <button
        className="btn btn-ghost px-3 py-1.5 text-sm"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        PDF
      </button>
      {open ? (
        <div className="pdf-menu">
          <p>Invoice PDF</p>
          {INVOICE_PDF_TEMPLATES.map((template) => (
            <a
              key={template.id}
              href={`${base}?format=${template.id}`}
              target="_blank"
              rel="noreferrer"
            >
              {template.kind === "a4" ? `A4 · ${template.name}` : template.name}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
