
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type ItemOption = { id: string; label: string };

export function InventoryAdjustForm({ items }: { items: ItemOption[] }) {
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

    setOk("Stock updated");
    event.currentTarget.reset();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="panel p-4 md:p-5">
      <h3 className="text-xl font-bold text-[var(--navy)]">Adjust stock</h3>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Stock in adds units, stock out removes units, adjust sets the absolute quantity.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--muted)]">Item</span>
          <select className="field" name="itemId" required>
            <option value="">Select SKU</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--muted)]">Movement type</span>
          <select className="field" name="type" required>
            <option value="IN">Stock in</option>
            <option value="OUT">Stock out</option>
            <option value="ADJUST">Set quantity</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--muted)]">Quantity</span>
          <input className="field" name="quantity" type="number" min={1} required />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--muted)]">Note</span>
          <input className="field" name="note" placeholder="Optional reason" />
        </label>
      </div>
      {error && <p className="mt-3 text-sm text-[var(--danger)]">{error}</p>}
      {ok && <p className="mt-3 text-sm text-[var(--success)]">{ok}</p>}
      <button className="btn btn-primary mt-4" disabled={loading} type="submit">
        {loading ? "Saving..." : "Apply adjustment"}
      </button>
    </form>
  );
}
