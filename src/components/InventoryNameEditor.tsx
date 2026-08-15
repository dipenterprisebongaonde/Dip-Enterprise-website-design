
"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function InventoryNameEditor({
  itemId,
  name,
  compact = false,
}: {
  itemId: string;
  name: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setValue(name);
  }, [name]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const cleaned = value.trim().replace(/\s+/g, " ");
    if (cleaned.length < 2) {
      setError("Name must be at least 2 characters.");
      return;
    }
    if (cleaned === name) {
      setOpen(false);
      return;
    }

    setSaving(true);
    setError("");
    const res = await fetch(`/api/app/inventory/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: cleaned }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) {
      setError(data.error || "Could not rename product.");
      return;
    }

    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        className="btn btn-ghost"
        style={{ padding: "0.35rem 0.7rem", fontSize: "0.8rem" }}
        onClick={() => {
          setOpen(true);
          setError("");
          setValue(name);
        }}
      >
        Edit Details
      </button>
    );
  }

  return (
    <form
      className={`inventory-name-editor ${compact ? "compact" : ""}`}
      onSubmit={onSubmit}
    >
      <p className="party-pay-title">Edit details</p>
      <label>
        <span>Product name</span>
        <input
          className="field"
          required
          minLength={2}
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={saving}
        />
      </label>
      {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}
      <div className="add-payment-actions">
        <button className="btn btn-primary" disabled={saving} type="submit">
          {saving ? "Saving..." : "Save details"}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={saving}
          onClick={() => {
            setOpen(false);
            setError("");
            setValue(name);
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
