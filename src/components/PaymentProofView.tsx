"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export type ProofSource = "sale" | "purchase" | "customer" | "vendor";

function isImageProof(url?: string | null, mime?: string | null, name?: string | null) {
  const haystack = `${mime || ""} ${name || ""} ${url || ""}`.toLowerCase();
  return (
    haystack.includes("image/") ||
    haystack.endsWith(".png") ||
    haystack.endsWith(".jpg") ||
    haystack.endsWith(".jpeg") ||
    haystack.endsWith(".webp") ||
    haystack.endsWith(".gif")
  );
}

export function PaymentProofView({
  url,
  fileName,
  mimeType,
  compact = false,
  removeSource,
  removePaymentId,
}: {
  url?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  compact?: boolean;
  removeSource?: ProofSource | null;
  removePaymentId?: string | null;
}) {
  const router = useRouter();
  const [broken, setBroken] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState("");
  const [gone, setGone] = useState(false);

  if (!url || gone) return null;

  const image = !broken && isImageProof(url, mimeType, fileName);
  const label = fileName || "Payment proof";
  const canRemove = Boolean(removeSource && removePaymentId);

  async function onRemove() {
    if (!removeSource || !removePaymentId) return;
    const ok = window.confirm("Remove this payment proof?");
    if (!ok) return;

    setRemoving(true);
    setError("");
    try {
      const res = await fetch("/api/app/payment-proofs/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: removeSource, paymentId: removePaymentId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not remove proof");
        return;
      }
      setGone(true);
      router.refresh();
    } catch {
      setError("Could not remove proof");
    } finally {
      setRemoving(false);
    }
  }

  const removeBtn = canRemove ? (
    <button
      type="button"
      className="payment-proof-remove"
      disabled={removing}
      onClick={onRemove}
    >
      {removing ? "Removing..." : "Remove"}
    </button>
  ) : null;

  if (!image) {
    return (
      <div className="payment-proof-actions">
        <a className="payment-chip proof" href={url} target="_blank" rel="noreferrer">
          {mimeType?.includes("pdf") || label.toLowerCase().endsWith(".pdf")
            ? "Open PDF proof"
            : "View proof"}
        </a>
        {removeBtn}
        {error ? <span className="text-xs text-[var(--danger)]">{error}</span> : null}
      </div>
    );
  }

  if (compact) {
    return (
      <div className="payment-proof-actions">
        <a
          className="payment-proof-thumb"
          href={url}
          target="_blank"
          rel="noreferrer"
          title={label}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={label} onError={() => setBroken(true)} />
        </a>
        {removeBtn}
        {error ? <span className="text-xs text-[var(--danger)]">{error}</span> : null}
      </div>
    );
  }

  return (
    <div className="payment-proof-preview">
      <a href={url} target="_blank" rel="noreferrer" className="payment-proof-frame">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={label} onError={() => setBroken(true)} />
      </a>
      <div className="payment-proof-actions">
        {fileName ? <p className="field-hint">{fileName}</p> : null}
        {removeBtn}
      </div>
      {error ? <span className="text-xs text-[var(--danger)]">{error}</span> : null}
    </div>
  );
}

/** Local preview for a file the user just selected (before upload). */
export function ProofLocalPreview({ file }: { file: File | null }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) {
      setUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  if (!file) return null;

  if (!url) {
    return <p className="field-hint">Selected: {file.name}</p>;
  }

  return (
    <div className="payment-proof-preview">
      <div className="payment-proof-frame">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={file.name} />
      </div>
      <p className="field-hint">{file.name}</p>
    </div>
  );
}
