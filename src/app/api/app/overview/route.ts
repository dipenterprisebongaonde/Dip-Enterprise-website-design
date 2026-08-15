
import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const branchFilter =
    session.role === Role.STAFF && session.branchId
      ? { branchId: session.branchId }
      : {};

  const [sales, purchases, customers, vendors, branches, users, vehicles, cameras, inventoryItems] =
    await Promise.all([
      prisma.sale.aggregate({ where: branchFilter, _sum: { amount: true }, _count: true }),
      prisma.purchase.aggregate({ where: branchFilter, _sum: { amount: true }, _count: true }),
      prisma.customer.count({ where: branchFilter }),
      prisma.vendor.count({ where: branchFilter }),
      session.role === Role.SUPER_ADMIN ? prisma.branch.count() : Promise.resolve(1),
      session.role === Role.SUPER_ADMIN
        ? prisma.user.count()
        : prisma.user.count({ where: { branchId: session.branchId || undefined } }),
      prisma.vehicle.count({ where: branchFilter }),
      prisma.camera.count({ where: branchFilter }),
      prisma.inventoryItem.findMany({ where: branchFilter }),
    ]);

  const lowStock = inventoryItems.filter((item) => item.quantity <= item.reorderLevel).length;
  const stockValue = inventoryItems.reduce(
    (sum, item) => sum + item.quantity * item.unitCost,
    0
  );

  return NextResponse.json({
    role: session.role,
    metrics: {
      salesTotal: sales._sum.amount || 0,
      salesCount: sales._count,
      purchasesTotal: purchases._sum.amount || 0,
      purchasesCount: purchases._count,
      customers,
      vendors,
      branches,
      users,
      vehicles,
      cameras,
      inventorySkus: inventoryItems.length,
      lowStock,
      stockValue,
    },
  });
}
