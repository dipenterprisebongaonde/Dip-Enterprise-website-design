
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type BranchOption = {
  id: string;
  name: string;
  region: string;
};

export function BranchSwitcher({
  branches,
  activeBranchId,
  locked = false,
}: {
  branches: BranchOption[];
  activeBranchId?: string | null;
  locked?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(activeBranchId || "");

  async function onChange(next: string) {
    setValue(next);
    const res = await fetch("/api/app/active-branch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branchId: next || null }),
    });
    if (!res.ok) return;
    startTransition(() => {
      router.refresh();
    });
  }

  if (locked) {
    const current = branches.find((branch) => branch.id === value);
    return (
      <div className="branch-switch-chip" title="Your assigned branch">
        <span>Branch</span>
        <strong>{current?.name || "Assigned branch"}</strong>
      </div>
    );
  }

  return (
    <label className="branch-switch-control">
      <span>Branch</span>
      <select
        className="field"
        value={value}
        disabled={pending}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">All branches</option>
        {branches.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name} · {branch.region}
          </option>
        ))}
      </select>
    </label>
  );
}
