"use client";

export function InvoicePdfActions({
  kind,
  id,
}: {
  kind: "sales" | "purchases";
  id: string;
}) {
  const href = `/api/app/${kind}/${id}/pdf?format=thermal80`;

  return (
    <a className="btn btn-ghost px-3 py-1.5 text-sm" href={href} target="_blank" rel="noreferrer">
      PDF · 80mm
    </a>
  );
}
