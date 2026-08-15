
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Field = {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string | number;
  options?: { label: string; value: string }[];
};

export function DataForm({
  action,
  fields,
  submitLabel,
}: {
  action: string;
  fields: Field[];
  submitLabel: string;
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
    const payload: Record<string, unknown> = {};
    for (const field of fields) {
      const raw = String(form.get(field.name) ?? "");
      if (field.type === "number") {
        if (raw.trim() === "") {
          payload[field.name] = field.required ? NaN : 0;
        } else {
          payload[field.name] = Number(raw);
        }
      } else {
        payload[field.name] = raw;
      }
    }

    const res = await fetch(action, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Failed to save");
      return;
    }

    setOk("Saved successfully");
    event.currentTarget.reset();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="panel rounded-sm p-4 md:p-5">
      <div className="grid gap-3 md:grid-cols-2">
        {fields.map((field) =>
          field.type === "hidden" ? (
            <input
              key={field.name}
              type="hidden"
              name={field.name}
              defaultValue={field.defaultValue ?? ""}
            />
          ) : (
            <label key={field.name} className="block text-sm">
              <span className="mb-1 block text-[var(--muted)]">{field.label}</span>
              {field.options ? (
                <select
                  className="field"
                  name={field.name}
                  required={field.required}
                  defaultValue={field.defaultValue ?? ""}
                >
                  <option value="">Select</option>
                  {field.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="field"
                  name={field.name}
                  type={field.type || "text"}
                  required={field.required}
                  placeholder={field.placeholder}
                  defaultValue={field.defaultValue}
                  step={field.type === "number" ? "any" : undefined}
                />
              )}
            </label>
          )
        )}
      </div>
      {error && <p className="mt-3 text-sm text-[var(--danger)]">{error}</p>}
      {ok && <p className="mt-3 text-sm text-[var(--success)]">{ok}</p>}
      <button className="btn btn-primary mt-4" disabled={loading} type="submit">
        {loading ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
