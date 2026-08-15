
import type { DateRange } from "@/lib/date-range";
import {
  grainNoun,
  seriesGrainForRange,
  seriesTouchHint,
  type SeriesGrain,
  type SeriesPoint,
} from "@/lib/metric-series";

export type InventoryDemoStack = {
  key: string;
  label: string;
  value: string;
  hint: string;
  tone: "blue" | "green" | "purple";
  pill: string;
  points: SeriesPoint[];
};

function hashSeed(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  let state = seed || 1;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let next = Math.imul(state ^ (state >>> 15), 1 | state);
    next ^= next + Math.imul(next ^ (next >>> 7), 61 | next);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function labelsForGrain(grain: SeriesGrain, count: number): string[] {
  const now = new Date();
  if (grain === "year") {
    const start = now.getFullYear() - (count - 1);
    return Array.from({ length: count }, (_, index) => `${start + index}`);
  }
  if (grain === "month") {
    return Array.from({ length: count }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (count - 1 - index), 1);
      return date.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
    });
  }
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (count - 1 - index));
    return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  });
}

function pointCount(grain: SeriesGrain, range: DateRange) {
  if (grain === "year") return 4;
  if (grain === "month") {
    if (range.preset === "fy") return 5;
    if (range.preset === "year") return 12;
    return 6;
  }
  if (range.preset === "today") return 8;
  if (range.preset === "week") return 7;
  if (range.preset === "month") return 14;
  return 12;
}

function buildSeries(
  rand: () => number,
  labels: string[],
  grain: SeriesGrain,
  prefix: string,
  opts: { base: number; swing: number; drift: number; floor: number }
): SeriesPoint[] {
  let running = opts.base + Math.round(rand() * opts.swing);
  return labels.map((label, index) => {
    running +=
      Math.round((rand() - 0.42) * opts.swing * 0.35) +
      Math.round(opts.drift * (rand() - 0.25));
    if (index === labels.length - 1) {
      running += Math.round(opts.swing * (0.28 + rand() * 0.4));
    }
    running = Math.max(opts.floor, Math.round(running));
    return {
      key: `${prefix}-${grain}-${index}`,
      label,
      value: running,
    };
  });
}

function formatCount(value: number) {
  return Math.round(value).toLocaleString("en-IN");
}

function formatMoney(value: number) {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

/** Deterministic fictional inventory stacks that change with date ranges. */
export function buildInventoryDemoStacks(range: DateRange): {
  grain: SeriesGrain;
  periodWord: string;
  touchHint: string;
  stacks: InventoryDemoStack[];
} {
  const grain = seriesGrainForRange(range);
  const seed = hashSeed(
    `inventory|${range.preset}|${range.label}|${range.from?.toISOString() || ""}|${range.to?.toISOString() || ""}|${grain}`
  );
  const rand = mulberry32(seed);
  const count = pointCount(grain, range);
  const labels = labelsForGrain(grain, count);
  const periodWord = grainNoun(grain);
  const touchHint = seriesTouchHint(range.preset, grain);
  const sampleNote = `${range.label} · by ${periodWord}`;

  const productPoints = buildSeries(rand, labels, grain, "products", {
    base: grain === "year" ? 18 : grain === "month" ? 10 : 6,
    swing: grain === "year" ? 8 : grain === "month" ? 5 : 3,
    drift: grain === "year" ? 2 : 1,
    floor: 3,
  });
  const unitsPoints = buildSeries(rand, labels, grain, "units", {
    base: grain === "year" ? 520 : grain === "month" ? 260 : 140,
    swing: grain === "year" ? 180 : grain === "month" ? 90 : 45,
    drift: grain === "year" ? 40 : grain === "month" ? 18 : 8,
    floor: 40,
  });
  const valuePoints = buildSeries(rand, labels, grain, "value", {
    base: grain === "year" ? 2_80_000 : grain === "month" ? 1_45_000 : 95_000,
    swing: grain === "year" ? 95_000 : grain === "month" ? 42_000 : 18_000,
    drift: grain === "year" ? 28_000 : grain === "month" ? 9_500 : 2_400,
    floor: grain === "day" ? 12_000 : 48_000,
  });

  const productsTotal = productPoints[productPoints.length - 1]?.value || 0;
  const unitsTotal = unitsPoints[unitsPoints.length - 1]?.value || 0;
  const stockTotal = valuePoints[valuePoints.length - 1]?.value || 0;

  return {
    grain,
    periodWord,
    touchHint,
    stacks: [
      {
        key: "products",
        label: "Products",
        value: formatCount(productsTotal),
        hint: sampleNote,
        tone: "blue",
        pill: "PRODUCTS",
        points: productPoints,
      },
      {
        key: "units",
        label: "Units on hand",
        value: formatCount(unitsTotal),
        hint: sampleNote,
        tone: "green",
        pill: "UNITS",
        points: unitsPoints,
      },
      {
        key: "value",
        label: "Stock value",
        value: formatMoney(stockTotal),
        hint: sampleNote,
        tone: "purple",
        pill: "VALUE",
        points: valuePoints,
      },
    ],
  };
}
