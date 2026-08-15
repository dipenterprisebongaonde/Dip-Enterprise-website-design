
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";

export function BranchFocusLink({
  branchId,
  name,
  region,
  index = 0,
}: {
  branchId: string;
  name: string;
  region: string;
  index?: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    await fetch("/api/app/active-branch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branchId }),
    });
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="path-branch-card"
      style={{ animationDelay: `${280 + index * 70}ms` }}
    >
      <span className="path-branch-mark" aria-hidden>
        {name.slice(0, 1)}
      </span>
      <span className="path-branch-copy">
        <strong>{name}</strong>
        <em>{region}</em>
      </span>
      <span className="path-branch-cta">
        {loading ? "Opening..." : "Open workspace"}
        <ArrowUpRight size={16} />
      </span>
    </button>
  );
}

export function ClearBranchFocusLink() {
  const router = useRouter();
  return (
    <Link
      href="/dashboard"
      className="text-sm font-semibold text-[var(--accent)]"
      onClick={async (e) => {
        e.preventDefault();
        await fetch("/api/app/active-branch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ branchId: null }),
        });
        router.push("/dashboard");
        router.refresh();
      }}
    >
      View all branches
    </Link>
  );
}
