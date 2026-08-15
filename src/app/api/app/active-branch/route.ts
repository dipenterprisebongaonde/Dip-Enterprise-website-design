
import { NextResponse } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { getActiveBranchId, setActiveBranchId } from "@/lib/active-branch";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (session.role === Role.STAFF) {
    const branch = session.branchId
      ? await prisma.branch.findUnique({ where: { id: session.branchId } })
      : null;
    return NextResponse.json({
      branchId: session.branchId,
      branch,
      locked: true,
    });
  }

  const branchId = await getActiveBranchId();
  const branch = branchId
    ? await prisma.branch.findUnique({ where: { id: branchId } })
    : null;
  return NextResponse.json({ branchId, branch, locked: false });
}

const schema = z.object({
  branchId: z.string().nullable(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== Role.SUPER_ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const data = schema.parse(await request.json());
    if (data.branchId) {
      const exists = await prisma.branch.findUnique({ where: { id: data.branchId } });
      if (!exists) {
        return NextResponse.json({ error: "Branch not found." }, { status: 404 });
      }
      await setActiveBranchId(data.branchId);
      return NextResponse.json({ branchId: data.branchId, branch: exists });
    }

    await setActiveBranchId(null);
    return NextResponse.json({ branchId: null, branch: null });
  } catch {
    return NextResponse.json({ error: "Invalid branch selection." }, { status: 400 });
  }
}
