import { NextResponse } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { normalizeProductUnit } from "@/lib/product-unit";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  unit: z.string().min(1).max(24).optional(),
  name: z.string().min(2).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const data = updateSchema.parse(await request.json());
    const item = await prisma.inventoryItem.findUnique({ where: { id } });
    if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

    if (session.role === Role.STAFF && item.branchId !== session.branchId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updated = await prisma.inventoryItem.update({
      where: { id },
      data: {
        ...(data.unit !== undefined ? { unit: normalizeProductUnit(data.unit) } : {}),
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      },
    });

    return NextResponse.json({ item: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid product update" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const item = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  if (session.role === Role.STAFF && item.branchId !== session.branchId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.inventoryItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
