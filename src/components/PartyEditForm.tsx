
"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export type PartyDetails = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
};

export function PartyEditForm({
  kind,
  party,
  compact = false,
}: {
  kind: "customers" | "vendors";
  party: PartyDetails;
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({
    name: party.name,
    email: party.email || "",
    phone: party.phone || "",
    address: party.address || "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setValues({
      name: party.name,
      email: party.email || "",
      phone: party.phone || "",
      address: party.address || "",
    });
  }, [party.name, party.email, party.phone, party.address]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch(`/api/app/${kind}/${party.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || `Could not update ${kind === "customers" ? "customer" : "vendor"}.`);
      return;
    }

    setOpen(false);
    router.refresh();
  }

  const label = kind === "customers" ? "customer" : "vendor";

  if (!open) {
    return (
      <button
        type="button"
        className="btn btn-ghost"
        style={{ padding: "0.35rem 0.7rem", fontSize: "0.8rem" }}
        onClick={() => {
          setOpen(true);
          setError("");
        }}
      >
        Edit
      </button>
    );
  }

  return (
    <form
      className={`party-edit-form ${compact ? "compact" : ""}`}
      onSubmit={onSubmit}
    >
      <p className="party-pay-title">Edit {label} details</p>
      <label>
        <span>Name</span>
        <input
          className="field"
          required
          minLength={2}
          value={values.name}
          onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
        />
      </label>
      <label>
        <span>Phone</span>
        <input
          className="field"
          value={values.phone}
          onChange={(e) => setValues((v) => ({ ...v, phone: e.target.value }))}
          placeholder="Optional"
        />
      </label>
      <label>
        <span>Email</span>
        <input
          className="field"
          type="email"
          value={values.email}
          onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
          placeholder="Optional"
        />
      </label>
      <label>
        <span>Address</span>
        <input
          className="field"
          value={values.address}
          onChange={(e) => setValues((v) => ({ ...v, address: e.target.value }))}
          placeholder="Optional"
        />
      </label>
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      <div className="add-payment-actions">
        <button className="btn btn-primary" disabled={loading} type="submit">
          {loading ? "Saving..." : "Save details"}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            setOpen(false);
            setError("");
            setValues({
              name: party.name,
              email: party.email || "",
              phone: party.phone || "",
              address: party.address || "",
            });
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
