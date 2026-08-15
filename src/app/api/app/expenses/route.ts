
import { NextResponse } from "next/server";
import { z } from "zod";
import { getBranchScope, resolveCreateBranchId } from "@/lib/active-branch";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { where } = await getBranchScope(session);
  const expenses = await prisma.expense.findMany({
    where,
    include: { branch: true },
    orderBy: { expenseDate: "desc" },
  });
  return NextResponse.json({ expenses });
}

const entrySchema = z.object({
  title: z.string().min(2),
  amount: z.coerce.number().positive(),
  expenseDate: z.string().min(4).optional(),
});

const singleSchema = entrySchema.extend({
  branchId: z.string().optional(),
});

const batchSchema = z.object({
  branchId: z.string().optional(),
  expenseDate: z.string().min(4).optional(),
  entries: z.array(entrySchema).min(1),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const branchId = await resolveCreateBranchId(
      session,
      typeof body?.branchId === "string" ? body.branchId : undefined
    );

    if (!branchId) {
      return NextResponse.json({ error: "Branch is required" }, { status: 400 });
    }

    if (Array.isArray(body?.entries)) {
      const data = batchSchema.parse(body);
      const fallbackDate = data.expenseDate || new Date().toISOString().slice(0, 10);

      const rows = data.entries.map((entry) => ({
        title: entry.title.trim(),
        category: "General",
        amount: Number(entry.amount.toFixed(2)),
        expenseDate: new Date(entry.expenseDate || fallbackDate),
        notes: null,
        branchId,
        createdById: session.id,
      }));

      const result = await prisma.expense.createMany({ data: rows });
      return NextResponse.json(
        { ok: true, count: result.count, expenses: rows.length },
        { status: 201 }
      );
    }

    const data = singleSchema.parse(body);
    const expense = await prisma.expense.create({
      data: {
        title: data.title.trim(),
        category: "General",
        amount: Number(data.amount.toFixed(2)),
        expenseDate: new Date(data.expenseDate || new Date().toISOString().slice(0, 10)),
        notes: null,
        branchId,
        createdById: session.id,
      },
    });

    return NextResponse.json({ expense }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid expense data" }, { status: 400 });
    }
    return NextResponse.json({ error: "Could not save expense" }, { status: 400 });
  }
}
