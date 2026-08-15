
import { getIndianFinancialYear } from "@/lib/invoice-number-format";

export type DateRangePreset =
  | "today"
  | "week"
  | "month"
  | "year"
  | "fy"
  | "all"
  | "custom";

export type DateRange = {
  preset: DateRangePreset;
  from: Date | null;
  to: Date | null;
  label: string;
};

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function toInputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function parseDateInput(value?: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function resolveDateRange(options: {
  range?: string | null;
  from?: string | null;
  to?: string | null;
}): DateRange {
  const now = new Date();
  const preset = (options.range || "month") as DateRangePreset;

  if (preset === "all") {
    return { preset, from: null, to: null, label: "All time" };
  }

  if (preset === "today") {
    return {
      preset,
      from: startOfDay(now),
      to: endOfDay(now),
      label: "Today",
    };
  }

  if (preset === "week") {
    const from = startOfDay(now);
    from.setDate(from.getDate() - 6);
    return {
      preset,
      from,
      to: endOfDay(now),
      label: "Last 7 days",
    };
  }

  if (preset === "year") {
    const from = startOfDay(new Date(now.getFullYear(), 0, 1));
    return {
      preset,
      from,
      to: endOfDay(now),
      label: "This year",
    };
  }

  if (preset === "fy") {
    const fy = getIndianFinancialYear(now);
    const from = startOfDay(new Date(fy.startYear, 3, 1)); // 1 Apr
    return {
      preset,
      from,
      to: endOfDay(now),
      label: `FY ${fy.label}`,
    };
  }

  if (preset === "custom") {
    const from = parseDateInput(options.from);
    const to = parseDateInput(options.to);
    if (from && to) {
      return {
        preset,
        from: startOfDay(from),
        to: endOfDay(to),
        label: `${toInputDate(from)} → ${toInputDate(to)}`,
      };
    }
    if (from) {
      return {
        preset,
        from: startOfDay(from),
        to: endOfDay(now),
        label: `From ${toInputDate(from)}`,
      };
    }
    if (to) {
      return {
        preset,
        from: null,
        to: endOfDay(to),
        label: `Until ${toInputDate(to)}`,
      };
    }
  }

  const from = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
  return {
    preset: preset === "custom" ? "month" : preset === "month" ? "month" : "month",
    from,
    to: endOfDay(now),
    label: "This month",
  };
}

export function dateRangeQuery(range: DateRange) {
  if (!range.from && !range.to) return undefined;
  return {
    ...(range.from ? { gte: range.from } : {}),
    ...(range.to ? { lte: range.to } : {}),
  };
}

export function rangeInputValues(range: DateRange) {
  return {
    from: range.from ? toInputDate(range.from) : "",
    to: range.to ? toInputDate(range.to) : "",
  };
}
