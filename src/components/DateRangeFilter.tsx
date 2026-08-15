
"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const PRESETS = [
  { value: "today", label: "Today" },
  { value: "week", label: "Last 7 days" },
  { value: "month", label: "This month" },
  { value: "year", label: "This year" },
  { value: "fy", label: "FY year" },
  { value: "all", label: "All time" },
  { value: "custom", label: "Custom" },
] as const;

type BranchOption = { id: string; name: string; region: string };

export function DateRangeFilter({
  currentRange,
  fromValue,
  toValue,
  branchId,
  branches,
  canSwitchBranch,
  basePath = "/dashboard",
}: {
  currentRange: string;
  fromValue: string;
  toValue: string;
  branchId?: string | null;
  branches?: BranchOption[];
  canSwitchBranch?: boolean;
  basePath?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [from, setFrom] = useState(fromValue);
  const [to, setTo] = useState(toValue);

  useEffect(() => {
    setFrom(fromValue);
    setTo(toValue);
  }, [fromValue, toValue]);

  function pushParams(next: {
    range?: string | null;
    from?: string | null;
    to?: string | null;
    branch?: string | null;
  }) {
    const params = new URLSearchParams();
    const nextBranch = next.branch === undefined ? branchId : next.branch;
    if (nextBranch) params.set("branch", nextBranch);
    if (next.range) params.set("range", next.range);
    if (next.from) params.set("from", next.from);
    if (next.to) params.set("to", next.to);
    const sort = searchParams.get("sort");
    const dir = searchParams.get("dir");
    if (sort) params.set("sort", sort);
    if (dir) params.set("dir", dir);
    const query = params.toString();
    router.push(query ? `${basePath}?${query}` : basePath);
  }

  function selectPreset(preset: string) {
    if (preset === "custom") {
      pushParams({
        range: "custom",
        from: from || fromValue || null,
        to: to || toValue || null,
      });
      return;
    }
    pushParams({ range: preset, from: null, to: null });
  }

  async function onBranchChange(value: string) {
    await fetch("/api/app/active-branch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branchId: value || null }),
    });
    pushParams({
      branch: value || null,
      range: currentRange,
      from: currentRange === "custom" ? from || fromValue || null : null,
      to: currentRange === "custom" ? to || toValue || null : null,
    });
    router.refresh();
  }

  function onCustomSubmit(event: FormEvent) {
    event.preventDefault();
    pushParams({
      range: "custom",
      from: from || null,
      to: to || null,
    });
  }

  const selectedBranch = branches?.find((branch) => branch.id === branchId);

  return (
    <div className="date-range-panel">
      {canSwitchBranch && branches && branches.length > 0 && (
        <div className="branch-switcher">
          <label>
            <span>Branch</span>
            <select
              className="field"
              value={branchId || ""}
              onChange={(e) => onBranchChange(e.target.value)}
            >
              <option value="">All branches</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name} · {branch.region}
                </option>
              ))}
            </select>
          </label>
          <p className="branch-switcher-note">
            Viewing{" "}
            <strong>{selectedBranch ? selectedBranch.name : "All branches"}</strong>
          </p>
        </div>
      )}

      <div className="filter-bar">
        {PRESETS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            className={`filter-chip ${currentRange === preset.value ? "active" : ""}`}
            onClick={() => selectPreset(preset.value)}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {currentRange === "custom" && (
        <form className="date-range-form" onSubmit={onCustomSubmit}>
          <label>
            <span>From</span>
            <input
              className="field"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            <span>To</span>
            <input
              className="field"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <button className="btn btn-primary" type="submit">
            Apply range
          </button>
        </form>
      )}
    </div>
  );
}
