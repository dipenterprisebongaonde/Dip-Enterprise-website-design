
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PRODUCT_UNITS } from "@/lib/product-unit";

export function InventoryUnitEditor({
  itemId,
  unit,
}: {
  itemId: string;
  unit: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(unit);
  const [custom, setCustom] = useState(
    PRODUCT_UNITS.includes(unit as (typeof PRODUCT_UNITS)[number]) ? "" : unit
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isCustom = value === "__custom__" || Boolean(custom && value === custom);

  async function save(nextUnit: string) {
    const cleaned = nextUnit.trim();
    if (!cleaned || cleaned === unit) return;
    setSaving(true);
    setError("");
    const res = await fetch(`/api/app/inventory/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unit: cleaned }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Failed");
      return;
    }
    router.refresh();
  }

  return (
    <div className="inventory-unit-editor">
      <select
        className="field"
        aria-label="Product unit"
        disabled={saving}
        value={
          PRODUCT_UNITS.includes(value as (typeof PRODUCT_UNITS)[number]) ? value : "__custom__"
        }
        onChange={(e) => {
          const next = e.target.value;
          if (next === "__custom__") {
            setValue("__custom__");
            return;
          }
          setCustom("");
          setValue(next);
          void save(next);
        }}
      >
        {PRODUCT_UNITS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
        <option value="__custom__">Custom…</option>
      </select>
      {(value === "__custom__" || isCustom) && (
        <input
          className="field"
          aria-label="Custom unit"
          placeholder="e.g. bag, bundle"
          disabled={saving}
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onBlur={() => {
            if (custom.trim()) {
              setValue(custom.trim());
              void save(custom);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
      )}
      {error && <p className="field-hint text-[var(--danger)]">{error}</p>}
    </div>
  );
}
