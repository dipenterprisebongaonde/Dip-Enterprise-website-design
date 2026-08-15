import { NextResponse } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSession, hashPassword } from "@/lib/auth";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  companyName: z.string().min(2).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = schema.parse(body);
    const email = data.email.toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }

    const branch = await prisma.branch.create({
      data: {
        name: data.companyName || `${data.name}'s Workspace`,
        region: "Primary",
        address: "SaaS Workspace",
      },
    });

    const passwordHash = await hashPassword(data.password);
    const user = await prisma.user.create({
      data: {
        name: data.name,
        email,
        passwordHash,
        role: Role.SUPER_ADMIN,
        branchId: branch.id,
      },
    });

    await createSession({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      branchId: user.branchId,
    });

    return NextResponse.json({
      ok: true,
      redirectTo: "/choose-path",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        branchId: user.branchId,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid signup payload" }, { status: 400 });
    }
    return NextResponse.json({ error: "Signup failed" }, { status: 500 });
  }
}
