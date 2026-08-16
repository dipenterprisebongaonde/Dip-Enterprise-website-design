import { NextResponse } from "next/server";
import { z } from "zod";
import { canDeleteBranches, canManageBranches } from "@/lib/access";
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
  if (!session || !canManageBranches(session)) {
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

export async function DELETE(_request: Request, { params }: Params) {
  const session = await getSession();
  if (!session || !canDeleteBranches(session)) {
    return NextResponse.json(
      { error: "Only Super Admin can delete branches." },
      { status: 403 }
    );
  }

  const { id } = await params;
  const existing = await prisma.branch.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          users: true,
          customers: true,
          vendors: true,
          sales: true,
          purchases: true,
          inventoryItems: true,
          expenses: true,
          vehicles: true,
          cameras: true,
        },
      },
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Branch not found" }, { status: 404 });
  }

  const totalBranches = await prisma.branch.count();
  if (totalBranches <= 1) {
    return NextResponse.json(
      { error: "Cannot remove the only remaining branch." },
      { status: 400 }
    );
  }

  const counts = existing._count;
  const blockers = [
    counts.users && `${counts.users} user${counts.users === 1 ? "" : "s"}`,
    counts.customers && `${counts.customers} customer${counts.customers === 1 ? "" : "s"}`,
    counts.vendors && `${counts.vendors} vendor${counts.vendors === 1 ? "" : "s"}`,
    counts.sales && `${counts.sales} sale${counts.sales === 1 ? "" : "s"}`,
    counts.purchases && `${counts.purchases} purchase${counts.purchases === 1 ? "" : "s"}`,
    counts.inventoryItems &&
      `${counts.inventoryItems} inventory item${counts.inventoryItems === 1 ? "" : "s"}`,
    counts.expenses && `${counts.expenses} expense${counts.expenses === 1 ? "" : "s"}`,
    counts.vehicles && `${counts.vehicles} vehicle${counts.vehicles === 1 ? "" : "s"}`,
    counts.cameras && `${counts.cameras} camera${counts.cameras === 1 ? "" : "s"}`,
  ].filter(Boolean);

  if (blockers.length) {
    return NextResponse.json(
      {
        error: `Cannot remove "${existing.name}" while it still has ${blockers.join(", ")}. Move or delete that data first.`,
      },
      { status: 400 }
    );
  }

  await prisma.branch.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
