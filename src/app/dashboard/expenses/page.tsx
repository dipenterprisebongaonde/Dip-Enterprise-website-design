import Link from "next/link";

import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { ExpenseEntryForm } from "@/components/ExpenseEntryForm";
import { MetricGrid } from "@/components/MetricGrid";
import { getBranchScope } from "@/lib/active-branch";
import { getSession } from "@/lib/auth";
import { dateRangeQuery, rangeInputValues, resolveDateRange } from "@/lib/date-range";
import {
  buildSeriesForGrain,
  grainNoun,
  seriesGrainForRange,
  seriesTouchHint,
  type SeriesGrain,
  type SeriesPoint,
} from "@/lib/metric-series";
import { prisma } from "@/lib/prisma";

function dateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function sampleSeriesForGrain(grain: SeriesGrain): SeriesPoint[] {
  if (grain === "year") {
    return [
      { key: "y0", label: "2023", value: 2_45_000 },
      { key: "y1", label: "2024", value: 3_12_500 },
      { key: "y2", label: "2025", value: 2_88_200 },
      { key: "y3", label: "2026", value: 1_23_850 },
    ];
  }
  if (grain === "month") {
    return [
      { key: "m0", label: "Apr 2026", value: 42_000 },
      { key: "m1", label: "May 2026", value: 51_200 },
      { key: "m2", label: "Jun 2026", value: 47_800 },
      { key: "m3", label: "Jul 2026", value: 58_400 },
      { key: "m4", label: "Aug 2026", value: 66_350 },
    ];
  }
  return [
    { key: "s0", label: "1", value: 2200 },
    { key: "s1", label: "2", value: 2800 },
    { key: "s2", label: "3", value: 2400 },
    { key: "s3", label: "4", value: 3100 },
    { key: "s4", label: "5", value: 2900 },
    { key: "s5", label: "6", value: 3600 },
    { key: "s6", label: "7", value: 3300 },
    { key: "s7", label: "8", value: 4100 },
    { key: "s8", label: "9", value: 3800 },
    { key: "s9", label: "10", value: 4500 },
    { key: "s10", label: "11", value: 4200 },
    { key: "s11", label: "12", value: 5100 },
    { key: "s12", label: "13", value: 4700 },
    { key: "s13", label: "14", value: 5600 },
    { key: "s14", label: "15", value: 5200 },
    { key: "s15", label: "16", value: 6100 },
    { key: "s16", label: "17", value: 5800 },
    { key: "s17", label: "18", value: 6400 },
    { key: "s18", label: "19", value: 7000 },
    { key: "s19", label: "20", value: 6800 },
    { key: "s20", label: "21", value: 7600 },
    { key: "s21", label: "22", value: 8200 },
    { key: "s22", label: "23", value: 18450 },
  ];
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{
    range?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const params = await searchParams;
  const { where: branchWhere, branchId: activeBranchId } = await getBranchScope(session);

  const dateRange = resolveDateRange({
    range: params.range,
    from: params.from,
    to: params.to,
  });
  // Auto: today/week/month → day, year/FY → month, all time → year.
  const grain = seriesGrainForRange(dateRange);
  const expenseDateFilter = dateRangeQuery(dateRange);
  const where = {
    ...branchWhere,
    ...(expenseDateFilter ? { expenseDate: expenseDateFilter } : {}),
  };
  const inputs = rangeInputValues(dateRange);

  const [expenses, branches] = await Promise.all([
    prisma.expense.findMany({
      where,
      include: { branch: true },
      orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
    }),
    prisma.branch.findMany({
      where: activeBranchId ? { id: activeBranchId } : {},
      orderBy: { name: "asc" },
    }),
  ]);

  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const showBranch = session.role === Role.SUPER_ADMIN && !activeBranchId;

  type DayTotal = {
    key: string;
    dateKey: string;
    date: Date;
    branchId: string | null;
    branchName: string | null;
    amount: number;
  };

  const dayMap = new Map<string, DayTotal>();
  for (const expense of expenses) {
    const day = dateKey(expense.expenseDate);
    const groupKey = showBranch ? `${day}|${expense.branchId}` : day;
    const existing = dayMap.get(groupKey);
    if (existing) {
      existing.amount += expense.amount;
    } else {
      dayMap.set(groupKey, {
        key: groupKey,
        dateKey: day,
        date: expense.expenseDate,
        branchId: showBranch ? expense.branchId : null,
        branchName: showBranch ? expense.branch.name : null,
        amount: expense.amount,
      });
    }
  }

  const dailyTotals = Array.from(dayMap.values()).sort(
    (a, b) =>
      b.date.getTime() - a.date.getTime() ||
      (a.branchName || "").localeCompare(b.branchName || "")
  );

  const alignedSeries = buildSeriesForGrain(
    dateRange,
    expenses.map((expense) => ({
      date: expense.expenseDate,
      amount: expense.amount,
    })),
    grain
  );

  const hasRealSeries = alignedSeries.some((point) => point.value > 0);
  const expenseSeries = hasRealSeries ? alignedSeries : sampleSeriesForGrain(grain);
  const seriesTotal = expenseSeries.reduce((sum, point) => sum + point.value, 0);
  const stackTotal = hasRealSeries ? total : seriesTotal;
  const periodWord = grainNoun(grain);
  const stackHint = hasRealSeries
    ? `${expenses.length} entries · ${dateRange.label} · by ${periodWord}`
    : `Sample preview · ${dateRange.label} · by ${periodWord}`;
  const touchHint = seriesTouchHint(dateRange.preset, grain);

  function money(value: number) {
    return `₹${value.toLocaleString("en-IN")}`;
  }

  return (
    <div className="space-y-4">
      <DateRangeFilter
        basePath="/dashboard/expenses"
        currentRange={dateRange.preset}
        fromValue={inputs.from}
        toValue={inputs.to}
      />
      <p className="date-range-label">
        Showing <strong>{expenses.length}</strong> expense
        {expenses.length === 1 ? "" : "s"} for <strong>{dateRange.label}</strong>
        {" · "}
        by <strong>{periodWord}</strong>
        {" · "}
        Total ₹{total.toLocaleString("en-IN")}
      </p>

      <MetricGrid
        className="metric-row-full"
        items={[
          {
            label: "Total expenses",
            value: money(stackTotal),
            hint: stackHint,
            tone: "red",
            variant: "trend",
            pill: "EXPENSE",
            points: expenseSeries,
            touchHint,
            wide: true,
          },
        ]}
      />

      <ExpenseEntryForm
        showBranch={showBranch}
        defaultBranchId={activeBranchId}
        branches={branches.map((branch) => ({ label: branch.name, value: branch.id }))}
      />

      <div className="panel overflow-x-auto rounded-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-lg font-bold text-[var(--navy)]">Daily totals</h3>
          <span className="payment-chip due">Total ₹{total.toLocaleString("en-IN")}</span>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              {showBranch ? <th>Branch</th> : null}
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {dailyTotals.map((day) => {
              const href = day.branchId
                ? `/dashboard/expenses/day/${day.dateKey}?branchId=${day.branchId}`
                : `/dashboard/expenses/day/${day.dateKey}`;
              return (
                <tr key={day.key}>
                  <td>
                    <Link href={href} className="party-link">
                      {day.date.toLocaleDateString("en-IN")}
                    </Link>
                  </td>
                  {showBranch ? <td>{day.branchName}</td> : null}
                  <td>
                    <Link href={href} className="party-link">
                      ₹{day.amount.toLocaleString("en-IN")}
                    </Link>
                  </td>
                </tr>
              );
            })}
            {dailyTotals.length === 0 && (
              <tr>
                <td colSpan={showBranch ? 3 : 2} className="text-[var(--muted)]">
                  No expenses in this date range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
