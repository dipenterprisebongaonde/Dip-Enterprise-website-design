import Link from "next/link";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { BranchBankCard } from "@/components/BranchBankCard";
import { getActiveBranchRecord } from "@/lib/active-branch";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function BankSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== Role.SUPER_ADMIN) redirect("/dashboard");

  const { branch } = await getActiveBranchRecord(session);
  const branchCounts = branch
    ? await prisma.branch.findUnique({
        where: { id: branch.id },
        include: {
          _count: { select: { users: true, customers: true, vendors: true } },
        },
      })
    : null;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-[var(--muted)]">
          <Link href="/dashboard/settings" className="underline-offset-2 hover:underline">
            Settings
          </Link>
          <span aria-hidden="true"> · </span>
          Bank Details
        </p>
        <h2 className="brand-display text-3xl">Bank Details</h2>
        <p className="text-[var(--muted)]">
          Switch branch in the top bar to edit that branch bank account used on PDF footers.
        </p>
      </div>

      {branch && branchCounts ? (
        <div className="space-y-3">
          <div>
            <h3 className="text-lg font-semibold text-[var(--navy)]">
              Active branch bank · {branch.name}
            </h3>
            <p className="text-sm text-[var(--muted)]">
              Invoice PDFs for this branch use these bank details.
            </p>
          </div>
          <BranchBankCard
            branch={{
              id: branch.id,
              name: branch.name,
              region: branch.region,
              address: branch.address,
              bankName: branch.bankName,
              accountNo: branch.accountNo,
              ifsc: branch.ifsc,
              bankBranch: branch.bankBranch,
              upi: branch.upi,
              users: branchCounts._count.users,
              customers: branchCounts._count.customers,
              vendors: branchCounts._count.vendors,
            }}
          />
        </div>
      ) : (
        <div className="panel rounded-sm p-4 text-sm text-[var(--muted)]">
          Select a branch in the top bar to view and edit that branch’s bank account.
        </div>
      )}
    </div>
  );
}
