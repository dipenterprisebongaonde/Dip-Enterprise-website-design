
import type { DateRange, DateRangePreset } from "@/lib/date-range";

export type SeriesGrain = "day" | "month" | "year";

export type SeriesPoint = {
  key: string;
  label: string;
  value: number;
};

function localDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function seriesGrainForRange(range: DateRange): SeriesGrain {
  if (range.preset === "year" || range.preset === "fy") return "month";
  if (range.preset === "all") return "year";

  if (range.preset === "custom" && range.from && range.to) {
    const days =
      (range.to.getTime() - range.from.getTime()) / (1000 * 60 * 60 * 24);
    if (days > 730) return "year";
    if (days > 62) return "month";
  }

  // today / week / month / short custom → one point per day
  return "day";
}

export function grainNoun(grain: SeriesGrain) {
  if (grain === "year") return "year";
  if (grain === "month") return "month";
  return "day";
}

function periodKey(date: Date, grain: SeriesGrain) {
  if (grain === "year") return `${date.getFullYear()}`;
  if (grain === "month") {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }
  return localDateKey(date);
}

function periodLabel(key: string, grain: SeriesGrain) {
  if (grain === "year") return key;
  if (grain === "month") {
    const [y, m] = key.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("en-IN", {
      month: "short",
      year: "numeric",
    });
  }
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
}

function enumerateKeys(from: Date, to: Date, grain: SeriesGrain): string[] {
  const keys: string[] = [];
  if (grain === "year") {
    for (let y = from.getFullYear(); y <= to.getFullYear(); y += 1) {
      keys.push(`${y}`);
    }
    return keys;
  }

  if (grain === "month") {
    const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
    const end = new Date(to.getFullYear(), to.getMonth(), 1);
    while (cursor <= end) {
      keys.push(periodKey(cursor, "month"));
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return keys;
  }

  let cursor = startOfDay(from);
  const end = startOfDay(to);
  while (cursor <= end) {
    keys.push(localDateKey(cursor));
    cursor = addDays(cursor, 1);
  }
  return keys;
}

function resolveBounds(
  range: DateRange,
  events: Date[],
  grain: SeriesGrain
): { from: Date; to: Date } {
  if (range.from && range.to) {
    return { from: startOfDay(range.from), to: startOfDay(range.to) };
  }

  const now = startOfDay(new Date());
  if (events.length === 0) {
    if (grain === "year") {
      return { from: new Date(now.getFullYear() - 2, 0, 1), to: now };
    }
    if (grain === "month") {
      return { from: new Date(now.getFullYear(), 0, 1), to: now };
    }
    return { from: addDays(now, -6), to: now };
  }

  const times = events.map((d) => d.getTime());
  return {
    from: startOfDay(new Date(Math.min(...times))),
    to: startOfDay(new Date(Math.max(...times, now.getTime()))),
  };
}

function trimKeys(keys: string[], grain: SeriesGrain) {
  if (grain === "day" && keys.length > 31) return keys.slice(-31);
  if (grain === "month" && keys.length > 24) return keys.slice(-24);
  if (grain === "year" && keys.length > 8) return keys.slice(-8);
  return keys;
}

function fillSeries(
  keys: string[],
  grain: SeriesGrain,
  amounts: { date: Date; amount: number }[]
): SeriesPoint[] {
  const totals = new Map(keys.map((key) => [key, 0]));
  for (const row of amounts) {
    const key = periodKey(row.date, grain);
    if (!totals.has(key)) continue;
    totals.set(key, (totals.get(key) || 0) + row.amount);
  }
  return keys.map((key) => ({
    key,
    label: periodLabel(key, grain),
    value: Number((totals.get(key) || 0).toFixed(2)),
  }));
}

export function parseSeriesGrain(
  value: string | null | undefined,
  fallback: SeriesGrain
): SeriesGrain {
  if (value === "day" || value === "month" || value === "year") return value;
  return fallback;
}

export function buildSeriesForGrain(
  range: DateRange,
  amounts: { date: Date; amount: number }[],
  grain: SeriesGrain
): SeriesPoint[] {
  const bounds = resolveBounds(
    range,
    amounts.map((row) => row.date),
    grain
  );
  const keys = trimKeys(enumerateKeys(bounds.from, bounds.to, grain), grain);
  return fillSeries(keys, grain, amounts);
}

export function seriesKeysForRange(
  range: DateRange,
  eventDates: Date[] = [],
  grainOverride?: SeriesGrain
) {
  const grain = grainOverride || seriesGrainForRange(range);
  const bounds = resolveBounds(range, eventDates, grain);
  const keys = trimKeys(enumerateKeys(bounds.from, bounds.to, grain), grain);
  return {
    grain,
    bounds,
    keys,
    labelFor(key: string) {
      return periodLabel(key, grain);
    },
    keyFor(date: Date) {
      return periodKey(date, grain);
    },
  };
}

export function buildAlignedMetricSeries(
  range: DateRange,
  sales: { date: Date; amount: number }[],
  purchases: { date: Date; amount: number }[],
  expenses: { date: Date; amount: number }[],
  grainOverride?: SeriesGrain
) {
  const grain = grainOverride || seriesGrainForRange(range);
  const allDates = [
    ...sales.map((row) => row.date),
    ...purchases.map((row) => row.date),
    ...expenses.map((row) => row.date),
  ];
  const bounds = resolveBounds(range, allDates, grain);
  const keys = trimKeys(enumerateKeys(bounds.from, bounds.to, grain), grain);

  const saleSeries = fillSeries(keys, grain, sales);
  const purchaseSeries = fillSeries(keys, grain, purchases);
  const expenseSeries = fillSeries(keys, grain, expenses);
  const profitLossSeries = saleSeries.map((sale, index) => {
    const value =
      sale.value - purchaseSeries[index].value - expenseSeries[index].value;
    return {
      key: sale.key,
      label: sale.label,
      value: Number(value.toFixed(2)),
    };
  });

  return {
    grain,
    saleSeries,
    purchaseSeries,
    expenseSeries,
    profitLossSeries,
  };
}

export function seriesTouchHint(preset: DateRangePreset, grain: SeriesGrain) {
  if (preset === "today") return "Tap the graph for today’s value";
  if (grain === "year") return "Tap a point for that year’s total";
  if (grain === "month") return "Tap a point for that month’s total";
  return "Tap a point for that day’s total";
}
