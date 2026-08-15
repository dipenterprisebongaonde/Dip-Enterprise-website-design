import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

type Tx = Prisma.TransactionClient;

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

async function findItemByName(tx: Tx, branchId: string, name: string) {
  const items = await tx.inventoryItem.findMany({ where: { branchId } });
  const target = normalizeName(name).toLowerCase();
  return items.find((item) => normalizeName(item.name).toLowerCase() === target) || null;
}

async function createItem(tx: Tx, branchId: string, name: string, quantity: number, note: string) {
  const cleanName = normalizeName(name);
  const skuBase = cleanName
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 16);
  const sku = `${skuBase || "PROD"}-${Date.now().toString().slice(-6)}`;

  return tx.inventoryItem.create({
    data: {
      sku,
      name: cleanName,
      category: "OTHER",
      quantity,
      unit: "pcs",
      reorderLevel: 0,
      unitCost: 0,
      branchId,
      movements:
        quantity > 0
          ? {
              create: {
                type: "IN",
                quantity,
                note,
              },
            }
          : undefined,
    },
  });
}

export async function applyPurchaseToStock(input: {
  branchId: string;
  productName: string;
  quantity: number;
  note?: string;
}) {
  const quantity = Math.abs(input.quantity);
  if (quantity <= 0) return null;

  return prisma.$transaction(async (tx) => {
    const existing = await findItemByName(tx, input.branchId, input.productName);
    if (!existing) {
      return createItem(
        tx,
        input.branchId,
        input.productName,
        quantity,
        input.note || "Stock in from purchase"
      );
    }

    await tx.inventoryMovement.create({
      data: {
        itemId: existing.id,
        type: "IN",
        quantity,
        note: input.note || "Stock in from purchase",
      },
    });

    return tx.inventoryItem.update({
      where: { id: existing.id },
      data: { quantity: existing.quantity + quantity },
    });
  });
}

export async function applySaleToStock(input: {
  branchId: string;
  productName: string;
  quantity: number;
  note?: string;
}) {
  const quantity = Math.abs(input.quantity);
  if (quantity <= 0) throw new Error("INVALID_QTY");

  return prisma.$transaction(async (tx) => {
    const existing = await findItemByName(tx, input.branchId, input.productName);
    if (!existing) throw new Error("PRODUCT_NOT_FOUND");
    if (existing.quantity < quantity) throw new Error("INSUFFICIENT_STOCK");

    await tx.inventoryMovement.create({
      data: {
        itemId: existing.id,
        type: "OUT",
        quantity,
        note: input.note || "Stock out from sale",
      },
    });

    return tx.inventoryItem.update({
      where: { id: existing.id },
      data: { quantity: existing.quantity - quantity },
    });
  });
}

/** Undo a previous sale by putting quantity back into stock. */
export async function reverseSaleFromStock(input: {
  branchId: string;
  productName: string;
  quantity: number;
  note?: string;
}) {
  return applyPurchaseToStock({
    branchId: input.branchId,
    productName: input.productName,
    quantity: input.quantity,
    note: input.note || "Stock restored from sale edit",
  });
}

/** Undo a previous purchase by removing quantity from stock. */
export async function reversePurchaseFromStock(input: {
  branchId: string;
  productName: string;
  quantity: number;
  note?: string;
}) {
  return applySaleToStock({
    branchId: input.branchId,
    productName: input.productName,
    quantity: input.quantity,
    note: input.note || "Stock adjusted from purchase edit",
  });
}

export async function getInventoryLedger(branchFilter: { branchId?: string } | Record<string, never>) {
  const [items, purchases, sales] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: branchFilter,
      orderBy: { name: "asc" },
    }),
    prisma.purchase.findMany({
      where: branchFilter,
      select: {
        item: true,
        quantity: true,
        branchId: true,
        lines: { select: { item: true, quantity: true } },
      },
    }),
    prisma.sale.findMany({
      where: branchFilter,
      select: {
        item: true,
        quantity: true,
        branchId: true,
        lines: { select: { item: true, quantity: true } },
      },
    }),
  ]);

  return items.map((item) => {
    const key = normalizeName(item.name).toLowerCase();
    const purchased = purchases.reduce((sum, row) => {
      if (row.branchId !== item.branchId) return sum;
      const lineRows =
        row.lines.length > 0
          ? row.lines
          : [{ item: row.item, quantity: row.quantity }];
      return (
        sum +
        lineRows
          .filter((line) => normalizeName(line.item).toLowerCase() === key)
          .reduce((lineSum, line) => lineSum + line.quantity, 0)
      );
    }, 0);
    const sold = sales.reduce((sum, row) => {
      if (row.branchId !== item.branchId) return sum;
      const lineRows =
        row.lines.length > 0
          ? row.lines
          : [{ item: row.item, quantity: row.quantity }];
      return (
        sum +
        lineRows
          .filter((line) => normalizeName(line.item).toLowerCase() === key)
          .reduce((lineSum, line) => lineSum + line.quantity, 0)
      );
    }, 0);

    // Opening stock inferred from current qty so:
    // quantity = opening + purchased - sold
    const opening = item.quantity - purchased + sold;
    const onHand = Math.max(opening, 0) + purchased - sold;

    const unitCost = item.unitCost || 0;

    return {
      id: item.id,
      name: item.name,
      purchased,
      sold,
      quantity: onHand,
      unit: item.unit || "pcs",
      unitCost,
      stockValue: onHand * unitCost,
    };
  });
}

export type ProductTimelineEntry = {
  id: string;
  type: string;
  quantity: number;
  note: string | null;
  createdAt: Date;
  balanceAfter: number;
};

export async function getProductTimeline(itemId: string) {
  const item = await prisma.inventoryItem.findUnique({
    where: { id: itemId },
    include: {
      branch: true,
      movements: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
    },
  });
  if (!item) return null;

  let balance = 0;
  const entries: ProductTimelineEntry[] = item.movements.map((movement) => {
    const qty = Math.abs(movement.quantity);
    if (movement.type === "OUT") {
      balance -= qty;
    } else {
      balance += qty;
    }
    return {
      id: movement.id,
      type: movement.type,
      quantity: qty,
      note: movement.note,
      createdAt: movement.createdAt,
      balanceAfter: balance,
    };
  });

  const purchased = entries
    .filter((entry) => entry.type !== "OUT")
    .reduce((sum, entry) => sum + entry.quantity, 0);
  const sold = entries
    .filter((entry) => entry.type === "OUT")
    .reduce((sum, entry) => sum + entry.quantity, 0);

  return {
    item: {
      id: item.id,
      name: item.name,
      sku: item.sku,
      unit: item.unit || "pcs",
      quantity: item.quantity,
      unitCost: item.unitCost || 0,
      branchName: item.branch.name,
      branchRegion: item.branch.region,
      createdAt: item.createdAt,
    },
    summary: {
      purchased,
      sold,
      onHand: item.quantity,
      stockValue: item.quantity * (item.unitCost || 0),
      movementCount: entries.length,
    },
    entries: [...entries].reverse(),
  };
}
