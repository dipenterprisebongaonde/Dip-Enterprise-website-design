import { NextResponse } from "next/server";
import { z } from "zod";
import { InventoryCategory, Role } from "@prisma/client";
import { getSession } from "@/lib/auth";
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

const createSchema = z.object({
  sku: z.string().min(2),
  name: z.string().min(2),
  category: z.enum([
    "ELECTRONICS",
    "SPARE_PARTS",
    "SECURITY_GEAR",
    "FLEET_SUPPLIES",
    "OFFICE",
    "OTHER",
  ]),
  description: z.string().optional(),
  quantity: z.number().int().nonnegative(),
  reorderLevel: z.number().int().nonnegative(),
  unitCost: z.number().nonnegative(),
  location: z.string().optional(),
  branchId: z.string().optional(),
});

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

    const item = await prisma.inventoryItem.create({
      data: {
        sku: data.sku.toUpperCase(),
        name: data.name,
        category: data.category,
        description: data.description || null,
        quantity: data.quantity,
        reorderLevel: data.reorderLevel,
        unitCost: data.unitCost,
        location: data.location || null,
        branchId,
        movements:
          data.quantity > 0
            ? {
                create: {
                  type: "IN",
                  quantity: data.quantity,
                  note: "Opening stock",
                },
              }
            : undefined,
      },
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid inventory data" }, { status: 400 });
    }
    return NextResponse.json({ error: "Could not create inventory item" }, { status: 400 });
  }
}
