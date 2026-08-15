
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
  email: z.string().email().optional().or(z.literal("")).or(z.null()),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: { branch: true },
  });
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  if (session.role === Role.STAFF && customer.branchId !== session.branchId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ customer });
}

export async function PUT(request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  if (session.role === Role.STAFF && existing.branchId !== session.branchId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const data = updateSchema.parse(await request.json());
    const customer = await prisma.customer.update({
      where: { id },
      data: {
        name: data.name.trim(),
        email: emptyToNull(data.email),
        phone: emptyToNull(data.phone),
        address: emptyToNull(data.address),
      },
    });
    return NextResponse.json({ customer });
  } catch {
    return NextResponse.json({ error: "Invalid customer data" }, { status: 400 });
  }
}
