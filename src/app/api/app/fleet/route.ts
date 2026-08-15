
import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { canAccessFleet } from "@/lib/access";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session || !canAccessFleet(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const branchFilter =
    session.role === Role.STAFF && session.branchId ? { branchId: session.branchId } : {};

  const vehicles = await prisma.vehicle.findMany({
    where: branchFilter,
    include: {
      branch: true,
      routePoints: { orderBy: { recordedAt: "asc" } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ vehicles });
}
