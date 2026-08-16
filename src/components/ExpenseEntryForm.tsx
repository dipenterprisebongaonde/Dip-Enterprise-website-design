
"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Option = { label: string; value: string };

type ExpenseLine = {
  key: string;
  title: string;
  amount: number;
};

function makeKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyLine(): ExpenseLine {
  return {
    key: makeKey(),
    title: "",
    amount: 0,
  };
}

function createLines(count: number) {
  return Array.from({ length: count }, () => emptyLine());
}

const DEFAULT_ROWS = 1;

export function ExpenseEntryForm({
  branches,
  showBranch,
  defaultBranchId,
}: {
  branches: Option[];
  showBranch: boolean;
  defaultBranchId?: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);
  const [expenseDate, setExpenseDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [branchId, setBranchId] = useState(defaultBranchId || "");
  const [lines, setLines] = useState<ExpenseLine[]>(() => createLines(DEFAULT_ROWS));

  const total = useMemo(
    () =>
      Number(
        lines
          .reduce((sum, line) => sum + Math.max(0, Number(line.amount) || 0), 0)
          .toFixed(2)
      ),
    [lines]
  );

  function updateLine(key: string, patch: Partial<ExpenseLine>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line))
    );
  }

  function addLine() {
    setLines((current) => [...current, emptyLine()]);
  }

  function removeLine(key: string) {
    setLines((current) =>
      current.length <= 1 ? current : current.filter((line) => line.key !== key)
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setOk("");

    const incomplete = lines.filter((line) => {
      const title = line.title.trim();
      const amount = Number(line.amount) || 0;
      const touched = Boolean(title || amount > 0);
      if (!touched) return false;
      return title.length < 2 || amount <= 0;
    });

    if (incomplete.length > 0) {
      setLoading(false);
      setError("Each filled row needs a title and amount.");
      return;
    }

    const entries = lines
      .map((line) => ({
        title: line.title.trim(),
        amount: Number(line.amount) || 0,
        expenseDate,
      }))
      .filter((line) => line.title.length >= 2 && line.amount > 0);

    if (entries.length === 0) {
      setLoading(false);
      setError("Fill title and amount on at least one expense row.");
      return;
    }

    const res = await fetch("/api/app/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        branchId: branchId || undefined,
        expenseDate,
        entries,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Could not save expenses.");
      return;
    }

    const count = data.count || entries.length;
    setOk(`Saved ${count} expense${count === 1 ? "" : "s"}.`);
    setLines(createLines(DEFAULT_ROWS));
    router.refresh();
  }

  const validCount = lines.filter((l) => l.title.trim() && l.amount > 0).length;

  return (
    <form onSubmit={onSubmit} className="panel rounded-sm p-4 md:p-5 space-y-4">
      <div className="invoice-lines-head" style={{ marginBottom: 0 }}>
        <div>
          <h3>Add expenses</h3>
          <p>
            Enter a <strong>title</strong> and <strong>amount</strong>. Use{" "}
            <strong>+ Add another expense</strong> for more rows.
          </p>
        </div>
        <span className="payment-chip due">Total ₹{total.toLocaleString("en-IN")}</span>
      </div>

      <div className="invoice-grid">
        <label>
          <span>Date</span>
          <input
            className="field"
            type="date"
            required
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
          />
        </label>
        {showBranch ? (
          <label>
            <span>Branch</span>
            <select
              className="field"
              required
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
            >
              <option value="">Select branch</option>
              {branches.map((branch) => (
                <option key={branch.value} value={branch.value}>
                  {branch.label}
                </option>
              ))}
            </select>
          </label>
        ) : defaultBranchId ? (
          <input type="hidden" value={defaultBranchId} readOnly />
        ) : null}
      </div>

      <div className="invoice-lines">
        <div className="invoice-lines-list">
          {lines.map((line, index) => (
            <div key={line.key} className="invoice-line-row expense-line-row">
              <label>
                <span>Title {index + 1} *</span>
                <input
                  className="field"
                  value={line.title}
                  onChange={(e) => updateLine(line.key, { title: e.target.value })}
                  placeholder="Rent / Fuel / Salary"
                />
              </label>
              <label>
                <span>Amount *</span>
                <input
                  className="field"
                  type="number"
                  min={0}
                  step="0.01"
                  value={line.amount || ""}
                  onChange={(e) =>
                    updateLine(line.key, { amount: Number(e.target.value) || 0 })
                  }
                  placeholder="Enter amount"
                />
              </label>
              <button
                type="button"
                className="btn btn-ghost line-remove"
                onClick={() => removeLine(line.key)}
                disabled={lines.length <= 1}
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <div className="add-payment-actions" style={{ marginTop: "0.75rem" }}>
          <button type="button" className="btn btn-ghost" onClick={addLine}>
            + Add another expense
          </button>
          <button className="btn btn-primary" disabled={loading} type="submit">
            {loading
              ? "Saving..."
              : validCount > 0
                ? `Save ${validCount} expense${validCount === 1 ? "" : "s"}`
                : "Save expenses"}
          </button>
        </div>
      </div>

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      {ok ? <p className="text-sm text-emerald-700">{ok}</p> : null}
    </form>
  );
}
