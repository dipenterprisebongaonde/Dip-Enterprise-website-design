"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { BillScanDraft } from "@/lib/bill-scan-types";
import { AI_BILL_DRAFT_KEY } from "@/lib/bill-scan-types";

const BILL_SCAN_ACCEPT = "image/png,image/jpeg,image/jpg,image/webp,application/pdf";

export function AiBillUploadCard() {
  const router = useRouter();
  const [mode, setMode] = useState<"purchase" | "sale">("purchase");
  const [file, setFile] = useState<File | null>(null);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<BillScanDraft | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/app/bills/scan")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setAiConfigured(Boolean(data.aiConfigured));
      })
      .catch(() => {
        if (!cancelled) setAiConfigured(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onScan(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      setError("Choose a bill photo or PDF first.");
      return;
    }
    setLoading(true);
    setError("");
    setPreview(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("mode", mode);
      const res = await fetch("/api/app/bills/scan", { method: "POST", body: form });
      const data = await res.json();
      setLoading(false);
      if (!res.ok) {
        setError(data.error || "Could not scan bill.");
        return;
      }
      setPreview(data.draft as BillScanDraft);
    } catch {
      setLoading(false);
      setError("Could not scan bill.");
    }
  }

  function continueToForm() {
    if (!preview) return;
    sessionStorage.setItem(AI_BILL_DRAFT_KEY, JSON.stringify(preview));
    router.push(
      preview.mode === "sale"
        ? "/dashboard/sales/new?ai=1"
        : "/dashboard/purchases/new?ai=1",
    );
  }

  return (
    <section className="ai-bill-card panel">
      <div className="ai-bill-card-head">
        <div>
          <p className="eyebrow">AI assistant</p>
          <h3>Upload bills</h3>
          <p>
            Snap or upload a supplier bill / invoice. AI fills a draft so you can review and
            save.
          </p>
        </div>
        <span className={`ai-bill-status ${aiConfigured ? "ok" : "warn"}`}>
          {aiConfigured == null
            ? "Checking…"
            : aiConfigured
              ? "AI ready"
              : "PDF text mode · add GEMINI_API_KEY for photos"}
        </span>
      </div>

      <form className="ai-bill-form" onSubmit={onScan}>
        <div className="ai-bill-tabs" role="tablist" aria-label="Bill type">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "purchase"}
            className={mode === "purchase" ? "is-active" : undefined}
            onClick={() => setMode("purchase")}
          >
            Purchase bill
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "sale"}
            className={mode === "sale" ? "is-active" : undefined}
            onClick={() => setMode("sale")}
          >
            Sales invoice
          </button>
        </div>

        <label className="ai-bill-drop">
          <input
            type="file"
            accept={BILL_SCAN_ACCEPT}
            onChange={(e) => {
              setFile(e.target.files?.[0] || null);
              setPreview(null);
              setError("");
            }}
          />
          <strong>{file ? file.name : "Drop bill photo or PDF"}</strong>
          <span>PNG, JPG, WEBP, or PDF · up to 10 MB</span>
        </label>

        {error ? <p className="form-error">{error}</p> : null}

        <div className="ai-bill-actions">
          <button className="btn btn-primary" type="submit" disabled={loading || !file}>
            {loading ? "Reading bill…" : "Scan with AI"}
          </button>
        </div>
      </form>

      {preview ? (
        <div className="ai-bill-preview">
          <div className="ai-bill-preview-head">
            <div>
              <p className="eyebrow">Draft ready · {preview.confidence} confidence</p>
              <h4>
                {preview.partyName || "Unknown party"} ·{" "}
                {preview.invoiceNo || "No invoice no."}
              </h4>
              <p>
                {preview.lines.filter((l) => l.item).length} line
                {preview.lines.filter((l) => l.item).length === 1 ? "" : "s"}
                {preview.invoiceDate ? ` · ${preview.invoiceDate}` : ""} · via {preview.provider}
              </p>
            </div>
            <button type="button" className="btn btn-primary" onClick={continueToForm}>
              Review & save
            </button>
          </div>
          <ul>
            {preview.lines
              .filter((line) => line.item)
              .slice(0, 5)
              .map((line, index) => (
                <li key={`${line.item}-${index}`}>
                  <span>{line.item}</span>
                  <strong>
                    {line.quantity} × ₹{line.unitPrice.toLocaleString("en-IN")}
                  </strong>
                </li>
              ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

