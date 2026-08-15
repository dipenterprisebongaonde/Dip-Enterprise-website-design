import { NextResponse } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { summarizePartyInvoices } from "@/lib/payments";
import { prisma } from "@/lib/prisma";

function branchWhere(session: { role: Role; branchId: string | null }) {
  return session.role === Role.STAFF && session.branchId
    ? { branchId: session.branchId }
    : {};
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const vendors = await prisma.vendor.findMany({
    where: branchWhere(session),
    include: {
      branch: true,
      purchases: { select: { amount: true, paidAmount: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    vendors: vendors.map(({ purchases, ...vendor }) => ({
      ...vendor,
      ...summarizePartyInvoices(purchases),
    })),
  });
}

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  branchId: z.string().optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const data = schema.parse(await request.json());
    const branchId =
      session.role === Role.STAFF ? session.branchId : data.branchId || session.branchId;

    if (!branchId) {
      return NextResponse.json({ error: "Branch is required" }, { status: 400 });
    }

    const vendor = await prisma.vendor.create({
      data: {
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null,
        branchId,
      },
    });
    return NextResponse.json({ vendor }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid vendor data" }, { status: 400 });
  }
}
