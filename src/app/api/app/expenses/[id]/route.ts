
import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { canDeleteInvoices } from "@/lib/access";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canDeleteInvoices(session)) {
    return NextResponse.json(
      { error: "Staff can create expenses but cannot delete them." },
      { status: 403 }
    );
  }

  const { id } = await context.params;
  const existing = await prisma.expense.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Expense not found" }, { status: 404 });

  if (session.role === Role.STAFF && existing.branchId !== session.branchId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.expense.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
