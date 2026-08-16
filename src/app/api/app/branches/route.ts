
import { NextResponse } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { canManageBranches } from "@/lib/access";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function emptyToNull(value?: string | null) {
  const trimmed = (value || "").trim();
  return trimmed.length ? trimmed : null;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (session.role === Role.STAFF) {
    const branch = session.branchId
      ? await prisma.branch.findUnique({ where: { id: session.branchId } })
      : null;
    return NextResponse.json({ branches: branch ? [branch] : [] });
  }

  const branches = await prisma.branch.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ branches });
}

const createSchema = z.object({
  name: z.string().min(2),
  region: z.string().min(2),
  address: z.string().optional(),
  bankName: z.string().optional(),
  accountNo: z.string().optional(),
  ifsc: z.string().optional(),
  bankBranch: z.string().optional(),
  upi: z.string().optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !canManageBranches(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const data = createSchema.parse(await request.json());
    const branch = await prisma.branch.create({
      data: {
        name: data.name.trim(),
        region: data.region.trim(),
        address: emptyToNull(data.address),
        bankName: emptyToNull(data.bankName),
        accountNo: emptyToNull(data.accountNo),
        ifsc: emptyToNull(data.ifsc),
        bankBranch: emptyToNull(data.bankBranch),
        upi: emptyToNull(data.upi),
      },
    });
    return NextResponse.json({ branch }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid branch data" }, { status: 400 });
  }
}
