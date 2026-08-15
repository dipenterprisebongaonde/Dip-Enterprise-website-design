import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession, verifyPassword } from "@/lib/auth";
import { Role } from "@prisma/client";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse({
      email: typeof body?.email === "string" ? body.email.trim().toLowerCase() : body?.email,
      password: typeof body?.password === "string" ? body.password.trim() : body?.password,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
    }
    const data = parsed.data;

    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const ok = await verifyPassword(data.password, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    await createSession({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      branchId: user.branchId,
    });

    const redirectTo = user.role === Role.SUPER_ADMIN ? "/choose-path" : "/dashboard";

    return NextResponse.json({
      ok: true,
      redirectTo,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        branchId: user.branchId,
      },
    });
  } catch (error) {
    console.error("login failed", error);
    return NextResponse.json({ error: "Login failed. Please try again." }, { status: 500 });
  }
}
