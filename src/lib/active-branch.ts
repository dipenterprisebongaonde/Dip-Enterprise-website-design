
import { cookies } from "next/headers";
import { Role } from "@prisma/client";
import type { SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const ACTIVE_BRANCH_COOKIE = "dip_active_branch";

export async function getActiveBranchId(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(ACTIVE_BRANCH_COOKIE)?.value?.trim();
  return value || null;
}

export async function setActiveBranchId(branchId: string | null) {
  const store = await cookies();
  if (!branchId) {
    store.delete(ACTIVE_BRANCH_COOKIE);
    return;
  }
  store.set(ACTIVE_BRANCH_COOKIE, branchId, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

/** Resolve which branch data should be scoped to for the current session. */
export async function getBranchScope(session: SessionUser) {
  if (session.role === Role.STAFF) {
    const branchId = session.branchId;
    return {
      branchId,
      where: branchId ? { branchId } : ({} as { branchId?: string }),
      locked: true as const,
    };
  }

  const branchId = await getActiveBranchId();
  return {
    branchId,
    where: branchId ? { branchId } : ({} as { branchId?: string }),
    locked: false as const,
  };
}

export async function getActiveBranchRecord(session: SessionUser) {
  const scope = await getBranchScope(session);
  if (!scope.branchId) return { scope, branch: null };

  const branch = await prisma.branch.findUnique({ where: { id: scope.branchId } });
  return { scope, branch };
}

/** Prefer active branch when creating records as super admin. */
export async function resolveCreateBranchId(
  session: SessionUser,
  requestedBranchId?: string | null
) {
  if (session.role === Role.STAFF) {
    return session.branchId;
  }
  if (requestedBranchId) return requestedBranchId;
  const active = await getActiveBranchId();
  if (active) return active;
  if (session.branchId) return session.branchId;
  const first = await prisma.branch.findFirst({ orderBy: { createdAt: "asc" } });
  return first?.id || null;
}
