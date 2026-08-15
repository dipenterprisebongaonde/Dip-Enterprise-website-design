
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteUserButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onDelete() {
    setLoading(true);
    const res = await fetch(`/api/app/users?id=${userId}`, { method: "DELETE" });
    setLoading(false);
    if (res.ok) router.refresh();
  }

  return (
    <button className="text-sm text-[var(--danger)]" disabled={loading} onClick={onDelete} type="button">
      {loading ? "Removing..." : "Remove"}
    </button>
  );
}
