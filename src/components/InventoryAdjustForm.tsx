"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type ItemOption = { id: string; label: string };

export function InventoryAdjustForm({
  items,
  defaultItemId,
  compact = false,
}: {
  items: ItemOption[];
  defaultItemId?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setOk("");

    const form = new FormData(event.currentTarget);
    const payload = {
      itemId: String(form.get("itemId") || ""),
      type: String(form.get("type") || "IN"),
      quantity: Number(form.get("quantity") || 0),
      note: String(form.get("note") || ""),
    };

    const res = await fetch("/api/app/inventory/adjust", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Adjustment failed");
      return;
    }

    setOk("Stock updated — timeline refreshed.");
    event.currentTarget.reset();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className={`inventory-adjust-form${compact ? " compact" : ""}`}>
      <div>
        <h3>Adjust stock</h3>
        <p>Stock in adds units, stock out removes units, set quantity replaces on-hand.</p>
      </div>
      <div className="invoice-grid">
        <label>
          <span>Item</span>
          <select className="field" name="itemId" required defaultValue={defaultItemId || ""}>
            <option value="">Select product</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Movement type</span>
          <select className="field" name="type" required defaultValue="IN">
            <option value="IN">Stock in</option>
            <option value="OUT">Stock out</option>
            <option value="ADJUST">Set quantity</option>
          </select>
        </label>
        <label>
          <span>Quantity</span>
          <input className="field" name="quantity" type="number" min={1} required />
        </label>
        <label>
          <span>Note</span>
          <input className="field" name="note" placeholder="Optional reason" />
        </label>
      </div>
      {error ? <p className="mt-3 text-sm text-[var(--danger)]">{error}</p> : null}
      {ok ? <p className="mt-3 text-sm text-[var(--success)]">{ok}</p> : null}
      <div className="invoice-actions">
        <button className="btn btn-primary" disabled={loading} type="submit">
          {loading ? "Saving..." : "Apply adjustment"}
        </button>
      </div>
    </form>
  );
}
