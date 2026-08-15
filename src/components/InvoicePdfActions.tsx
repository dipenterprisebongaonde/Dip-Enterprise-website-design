"use client";

import { useState } from "react";

export function InvoicePdfActions({
  kind,
  id,
}: {
  kind: "sales" | "purchases";
  id: string;
}) {
  const [open, setOpen] = useState(false);
  const isPurchase = kind === "purchases";

  return (
    <div className="pdf-actions">
      <button
        className="btn btn-ghost px-3 py-1.5 text-sm"
        type="button"
        onClick={() => setOpen((v) => !v)}
      >
        PDF
      </button>
      {open && (
        <div className="pdf-menu">
          <p>Select invoice format</p>
          {isPurchase ? (
            <>
              <a href={`/api/app/${kind}/${id}/pdf?format=itc`} target="_blank" rel="noreferrer">
                1. Tax Invoice (ITC template)
              </a>
              <a href={`/api/app/${kind}/${id}/pdf?format=amazon`} target="_blank" rel="noreferrer">
                2. Tax Invoice (Amazon template)
              </a>
            </>
          ) : (
            <>
              <a href={`/api/app/${kind}/${id}/pdf?format=amazon`} target="_blank" rel="noreferrer">
                1. Tax Invoice (Amazon template)
              </a>
              <a href={`/api/app/${kind}/${id}/pdf?format=itc`} target="_blank" rel="noreferrer">
                2. Tax Invoice (ITC template)
              </a>
            </>
          )}
        </div>
      )}
    </div>
  );
}
