import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createSession,
  getSession,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";
import { normalizePhone } from "@/lib/phone-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    include: { branch: true },
  });

  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      phone: user.phone,
      name: user.name,
      role: user.role,
      branchId: user.branchId,
      authProvider: user.authProvider,
      hasPassword: Boolean(user.passwordHash),
      branch: user.branch
        ? { id: user.branch.id, name: user.branch.name, region: user.branch.region }
        : null,
    },
  });
}

const updateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  phone: z.string().trim().max(20).optional().nullable(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6).optional().nullable(),
});

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = updateSchema.parse(body);
    const email = data.email.toLowerCase();

    const existing = await prisma.user.findUnique({ where: { id: session.id } });
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (email !== existing.email) {
      const taken = await prisma.user.findUnique({ where: { email } });
      if (taken) {
        return NextResponse.json({ error: "Email already in use" }, { status: 409 });
      }
    }

    let phone: string | null = null;
    if (data.phone && data.phone.trim()) {
      phone = normalizePhone(data.phone);
      if (!phone) {
        return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });
      }
      const phoneTaken = await prisma.user.findFirst({
        where: { phone, NOT: { id: session.id } },
      });
      if (phoneTaken) {
        return NextResponse.json({ error: "Phone number already in use" }, { status: 409 });
      }
    }

    const wantsPasswordChange = Boolean(data.newPassword && data.newPassword.trim());
    let passwordHash = existing.passwordHash;

    if (wantsPasswordChange) {
      if (!existing.passwordHash) {
        // Google/phone-only accounts can set a first password without current password.
        passwordHash = await hashPassword(data.newPassword!);
      } else {
        if (!data.currentPassword) {
          return NextResponse.json(
            { error: "Enter your current password to set a new one." },
            { status: 400 }
          );
        }
        const ok = await verifyPassword(data.currentPassword, existing.passwordHash);
        if (!ok) {
          return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
        }
        passwordHash = await hashPassword(data.newPassword!);
      }
    }

    const user = await prisma.user.update({
      where: { id: session.id },
      data: {
        name: data.name,
        email,
        phone,
        passwordHash,
        authProvider:
          wantsPasswordChange && !existing.passwordHash
            ? existing.authProvider === "google" || existing.authProvider === "phone"
              ? existing.authProvider
              : "password"
            : existing.authProvider,
      },
      include: { branch: true },
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
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        name: user.name,
        role: user.role,
        branchId: user.branchId,
        authProvider: user.authProvider,
        hasPassword: Boolean(user.passwordHash),
        branch: user.branch
          ? { id: user.branch.id, name: user.branch.name, region: user.branch.region }
          : null,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid profile data" }, { status: 400 });
    }
    console.error("profile update failed", error);
    return NextResponse.json({ error: "Could not update profile" }, { status: 500 });
  }
}
