import { NextResponse } from "next/server";
import { z } from "zod";
import { InventoryCategory, Role } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { normalizeProductUnit } from "@/lib/product-unit";
import { prisma } from "@/lib/prisma";

function branchWhere(session: { role: Role; branchId: string | null }, branchId?: string | null) {
  if (session.role === Role.STAFF) {
    return session.branchId ? { branchId: session.branchId } : { branchId: "__none__" };
  }
  return branchId ? { branchId } : {};
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view");
  const category = searchParams.get("category");
  const branchId = searchParams.get("branchId");

  const where = {
    ...branchWhere(session, branchId),
    ...(category && category !== "ALL"
      ? { category: category as InventoryCategory }
      : {}),
  };

  const items = await prisma.inventoryItem.findMany({
    where,
    include: {
      branch: true,
      movements: { orderBy: { createdAt: "desc" }, take: 5 },
    },
    orderBy: { updatedAt: "desc" },
  });

  const filtered =
    view === "low" ? items.filter((item) => item.quantity <= item.reorderLevel) : items;

  const summary = {
    totalSkus: items.length,
    totalUnits: items.reduce((sum, item) => sum + item.quantity, 0),
    lowStock: items.filter((item) => item.quantity <= item.reorderLevel).length,
    stockValue: items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0),
  };

  return NextResponse.json({ items: filtered, summary });
}

/** Matches the inventory page form: name + optional opening qty + unit. */
const createSchema = z.object({
  name: z.string().trim().min(1, "Product name is required"),
  quantity: z.coerce.number().int().nonnegative().optional().default(0),
  unit: z.string().optional(),
  branchId: z.string().optional(),
  sku: z.string().trim().min(2).optional(),
  category: z
    .enum([
      "ELECTRONICS",
      "SPARE_PARTS",
      "SECURITY_GEAR",
      "FLEET_SUPPLIES",
      "OFFICE",
      "OTHER",
    ])
    .optional(),
  description: z.string().optional(),
  reorderLevel: z.coerce.number().int().nonnegative().optional(),
  unitCost: z.coerce.number().nonnegative().optional(),
  location: z.string().optional(),
});

function skuFromName(name: string) {
  const base =
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "")
      .slice(0, 10) || "ITEM";
  const suffix = Date.now().toString(36).slice(-5).toUpperCase();
  return `${base}-${suffix}`;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const data = createSchema.parse(await request.json());
    const branchId =
      session.role === Role.STAFF ? session.branchId : data.branchId || session.branchId;

    if (!branchId) {
      return NextResponse.json({ error: "Branch is required" }, { status: 400 });
    }

    const quantity = data.quantity ?? 0;
    const unit = normalizeProductUnit(data.unit);
    const sku = (data.sku || skuFromName(data.name)).toUpperCase();

    const item = await prisma.inventoryItem.create({
      data: {
        sku,
        name: data.name,
        category: data.category || "OTHER",
        description: data.description || null,
        quantity,
        unit,
        reorderLevel: data.reorderLevel ?? 0,
        unitCost: data.unitCost ?? 0,
        location: data.location || null,
        branchId,
        movements:
          quantity > 0
            ? {
                create: {
                  type: "IN",
                  quantity,
                  note: "Opening stock",
                },
              }
            : undefined,
      },
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.issues[0]?.message || "Invalid inventory data";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("inventory create", error);
    return NextResponse.json({ error: "Could not create inventory item" }, { status: 400 });
  }
}
