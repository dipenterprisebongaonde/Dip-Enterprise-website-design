
import { NextResponse } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { getBranchScope } from "@/lib/active-branch";
import { getSession, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== Role.SUPER_ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { branchId: activeBranchId } = await getBranchScope(session);
  const users = await prisma.user.findMany({
    where: activeBranchId
      ? {
          OR: [{ branchId: activeBranchId }, { role: Role.SUPER_ADMIN }],
        }
      : {},
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      branchId: true,
      createdAt: true,
      branch: true,
    },
  });

  return NextResponse.json({ users });
}

const createSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["SUPER_ADMIN", "STAFF"]),
  branchId: z.string().optional().nullable(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== Role.SUPER_ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const data = createSchema.parse(await request.json());
    const email = data.email.toLowerCase();
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }

    if (data.role === "STAFF" && !data.branchId) {
      return NextResponse.json({ error: "Staff must be assigned to a branch" }, { status: 400 });
    }

    const passwordHash = await hashPassword(data.password);
    const user = await prisma.user.create({
      data: {
        name: data.name,
        email,
        passwordHash,
        role: data.role as Role,
        branchId: data.role === "STAFF" ? data.branchId || null : data.branchId || null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        branchId: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid user data" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session || session.role !== Role.SUPER_ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  if (id === session.id) {
    return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
  }

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
