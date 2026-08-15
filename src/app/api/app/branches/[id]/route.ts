
import { NextResponse } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function emptyToNull(value?: string | null) {
  const trimmed = (value || "").trim();
  return trimmed.length ? trimmed : null;
}

const updateSchema = z.object({
  name: z.string().min(2),
  region: z.string().min(2),
  address: z.string().optional().nullable(),
  bankName: z.string().optional().nullable(),
  accountNo: z.string().optional().nullable(),
  ifsc: z.string().optional().nullable(),
  bankBranch: z.string().optional().nullable(),
  upi: z.string().optional().nullable(),
});

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const session = await getSession();
  if (!session || session.role !== Role.SUPER_ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.branch.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Branch not found" }, { status: 404 });
  }

  try {
    const data = updateSchema.parse(await request.json());
    const branch = await prisma.branch.update({
      where: { id },
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
    return NextResponse.json({ branch });
  } catch {
    return NextResponse.json({ error: "Invalid branch data" }, { status: 400 });
  }
}
