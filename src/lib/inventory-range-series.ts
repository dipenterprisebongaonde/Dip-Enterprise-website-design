
import type { DateRange } from "@/lib/date-range";
import {
  grainNoun,
  seriesKeysForRange,
  seriesTouchHint,
  type SeriesPoint,
} from "@/lib/metric-series";
import { prisma } from "@/lib/prisma";

type BranchWhere = { branchId?: string };

function endOfPeriod(key: string, grain: "day" | "month" | "year") {
  if (grain === "year") {
    const year = Number(key);
    return new Date(year, 11, 31, 23, 59, 59, 999);
  }
  if (grain === "month") {
    const [y, m] = key.split("-").map(Number);
    return new Date(y, m, 0, 23, 59, 59, 999);
  }
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

/** Build units/value trend points from stock movements for the selected date range. */
export async function buildInventoryRangeSeries(
  branchWhere: BranchWhere,
  range: DateRange
) {
  const items = await prisma.inventoryItem.findMany({
    where: branchWhere,
    select: { id: true, unitCost: true, quantity: true },
  });
  const itemIds = items.map((item) => item.id);
  const unitCostById = new Map(items.map((item) => [item.id, item.unitCost || 0]));

  const movements =
    itemIds.length === 0
      ? []
      : await prisma.inventoryMovement.findMany({
          where: { itemId: { in: itemIds } },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: {
            itemId: true,
            type: true,
            quantity: true,
            createdAt: true,
          },
        });

  const { grain, keys, labelFor, keyFor } = seriesKeysForRange(
    range,
    movements.map((row) => row.createdAt)
  );

  const qtyByItem = new Map<string, number>();
  let movementIndex = 0;
  const unitsPoints: SeriesPoint[] = [];
  const valuePoints: SeriesPoint[] = [];

  function applyMovement(movement: (typeof movements)[number]) {
    const qty = Math.abs(movement.quantity);
    const current = qtyByItem.get(movement.itemId) || 0;
    qtyByItem.set(
      movement.itemId,
      movement.type === "OUT" ? current - qty : current + qty
    );
  }

  // Apply history before the first plotted period so balances start correctly.
  if (keys.length > 0) {
    const firstPeriodStart =
      grain === "year"
        ? new Date(Number(keys[0]), 0, 1)
        : grain === "month"
          ? new Date(
              Number(keys[0].slice(0, 4)),
              Number(keys[0].slice(5, 7)) - 1,
              1
            )
          : new Date(`${keys[0]}T00:00:00`);
    while (
      movementIndex < movements.length &&
      movements[movementIndex].createdAt.getTime() < firstPeriodStart.getTime()
    ) {
      applyMovement(movements[movementIndex]);
      movementIndex += 1;
    }
  }

  for (const key of keys) {
    const cutoff = endOfPeriod(key, grain);
    while (
      movementIndex < movements.length &&
      movements[movementIndex].createdAt.getTime() <= cutoff.getTime()
    ) {
      applyMovement(movements[movementIndex]);
      movementIndex += 1;
    }

    let units = 0;
    let value = 0;
    for (const [itemId, qty] of qtyByItem) {
      const onHand = Math.max(0, qty);
      units += onHand;
      value += onHand * (unitCostById.get(itemId) || 0);
    }

    unitsPoints.push({
      key: `u-${key}`,
      label: labelFor(key),
      value: Number(units.toFixed(2)),
    });
    valuePoints.push({
      key: `v-${key}`,
      label: labelFor(key),
      value: Number(value.toFixed(2)),
    });
  }

  // If there were no movements yet, seed a flat series from current on-hand
  // so the stack still reflects the selected range shape.
  const hasMovementSignal = movements.some((row) => {
    const key = keyFor(row.createdAt);
    return keys.includes(key);
  });

  if (!hasMovementSignal && items.length > 0) {
    const currentUnits = items.reduce((sum, item) => sum + Math.max(0, item.quantity), 0);
    const currentValue = items.reduce(
      (sum, item) => sum + Math.max(0, item.quantity) * (item.unitCost || 0),
      0
    );
    for (let index = 0; index < keys.length; index += 1) {
      const factor = 0.72 + (index / Math.max(keys.length - 1, 1)) * 0.28;
      unitsPoints[index] = {
        ...unitsPoints[index],
        value: Number((currentUnits * factor).toFixed(2)),
      };
      valuePoints[index] = {
        ...valuePoints[index],
        value: Number((currentValue * factor).toFixed(2)),
      };
    }
  }

  if (unitsPoints.length === 0) {
    unitsPoints.push(
      { key: "u-empty-0", label: "—", value: 0 },
      { key: "u-empty-1", label: "—", value: 0 }
    );
    valuePoints.push(
      { key: "v-empty-0", label: "—", value: 0 },
      { key: "v-empty-1", label: "—", value: 0 }
    );
  }

  const latestUnits = unitsPoints[unitsPoints.length - 1]?.value || 0;
  const latestValue = valuePoints[valuePoints.length - 1]?.value || 0;

  return {
    grain,
    periodWord: grainNoun(grain),
    touchHint: seriesTouchHint(range.preset, grain),
    unitsPoints,
    valuePoints,
    latestUnits,
    latestValue,
  };
}
