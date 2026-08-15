
import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { canAccessCctv } from "@/lib/access";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session || !canAccessCctv(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const branchFilter =
    session.role === Role.STAFF && session.branchId ? { branchId: session.branchId } : {};

  const [cameras, settings] = await Promise.all([
    prisma.camera.findMany({
      where: branchFilter,
      include: { branch: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.setting.findUnique({ where: { id: "global" } }),
  ]);

  return NextResponse.json({
    cameras,
    cctvLoginUrl: settings?.cctvLoginUrl || "https://example.com/cctv-login",
  });
}
