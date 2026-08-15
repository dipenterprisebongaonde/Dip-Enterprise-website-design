
import { NextResponse } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  itemId: z.string().min(1),
  type: z.enum(["IN", "OUT", "ADJUST"]),
  quantity: z.number().int().positive(),
  note: z.string().optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const data = schema.parse(await request.json());
    const item = await prisma.inventoryItem.findUnique({ where: { id: data.itemId } });
    if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

    if (session.role === Role.STAFF && item.branchId !== session.branchId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let nextQty = item.quantity;
    if (data.type === "IN") nextQty += data.quantity;
    if (data.type === "OUT") nextQty -= data.quantity;
    if (data.type === "ADJUST") nextQty = data.quantity;

    if (nextQty < 0) {
      return NextResponse.json({ error: "Insufficient stock for this outward movement" }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const movement = await tx.inventoryMovement.create({
        data: {
          itemId: item.id,
          type: data.type,
          quantity: data.quantity,
          note: data.note || null,
        },
      });

      const inventoryItem = await tx.inventoryItem.update({
        where: { id: item.id },
        data: { quantity: nextQty },
      });

      return { inventoryItem, movement };
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid adjustment payload" }, { status: 400 });
    }
    return NextResponse.json({ error: "Stock adjustment failed" }, { status: 500 });
  }
}
