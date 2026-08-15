
import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { z } from "zod";
import { getSession, hashPassword } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone-auth";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  phone: z.string().trim().max(20).optional().nullable(),
  role: z.enum(["SUPER_ADMIN", "STAFF"]),
  branchId: z.string().optional().nullable(),
  password: z.string().min(6).optional().nullable(),
});

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== Role.SUPER_ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  try {
    const data = updateSchema.parse(await request.json());
    const email = data.email.toLowerCase();

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (email !== existing.email) {
      const taken = await prisma.user.findUnique({ where: { email } });
      if (taken) {
        return NextResponse.json({ error: "Email already in use" }, { status: 409 });
      }
    }

    if (data.role === "STAFF" && !data.branchId) {
      return NextResponse.json({ error: "Staff must be assigned to a branch" }, { status: 400 });
    }

    let phone: string | null = null;
    if (data.phone && data.phone.trim()) {
      phone = normalizePhone(data.phone);
      if (!phone) {
        return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });
      }
      const phoneTaken = await prisma.user.findFirst({
        where: { phone, NOT: { id } },
      });
      if (phoneTaken) {
        return NextResponse.json({ error: "Phone number already in use" }, { status: 409 });
      }
    }

    // Prevent demoting yourself away from admin accidentally without a branch.
    if (id === session.id && data.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "You cannot change your own role away from Super Admin." },
        { status: 400 }
      );
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        name: data.name,
        email,
        phone,
        role: data.role as Role,
        branchId: data.role === "STAFF" ? data.branchId || null : data.branchId || null,
        ...(data.password
          ? {
              passwordHash: await hashPassword(data.password),
              authProvider: existing.passwordHash ? existing.authProvider : "password",
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        branchId: true,
      },
    });

    return NextResponse.json({ ok: true, user });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid user data" }, { status: 400 });
    }
    console.error("user update failed", error);
    return NextResponse.json({ error: "Could not update user" }, { status: 500 });
  }
}
