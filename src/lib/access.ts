import { Role } from "@prisma/client";
import { SessionUser } from "./auth";

export function canAccessPathChooser(user: SessionUser) {
  return user.role === Role.SUPER_ADMIN;
}

export function canAccessCctv(user: SessionUser) {
  return user.role === Role.SUPER_ADMIN;
}

export function canAccessFleet(user: SessionUser) {
  return user.role === Role.SUPER_ADMIN;
}

export function canManageUsers(user: SessionUser) {
  return user.role === Role.SUPER_ADMIN;
}

export function canManageBranches(user: SessionUser) {
  return user.role === Role.SUPER_ADMIN;
}

export function canDeleteBranches(user: SessionUser) {
  return user.role === Role.SUPER_ADMIN;
}

export function canDeleteInvoices(user: SessionUser) {
  return user.role === Role.SUPER_ADMIN;
}

export function canDeleteInventory(user: SessionUser) {
  return user.role === Role.SUPER_ADMIN;
}

export function canAdjustInventory(user: SessionUser) {
  return user.role === Role.SUPER_ADMIN;
}

export function canBulkDownloadInvoices(user: SessionUser) {
  return user.role === Role.SUPER_ADMIN;
}

export function canResetOperationalData(user: SessionUser) {
  return user.role === Role.SUPER_ADMIN;
}

export function canBackupOperationalData(user: SessionUser) {
  return user.role === Role.SUPER_ADMIN;
}

export function resolveBranchScope(user: SessionUser, requestedBranchId?: string | null) {
  if (user.role === Role.STAFF) {
    return user.branchId;
  }
  return requestedBranchId || null;
}
