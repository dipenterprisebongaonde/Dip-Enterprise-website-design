import Link from "next/link";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { BranchBankCard } from "@/components/BranchBankCard";
import { DefaultBankCard } from "@/components/DefaultBankCard";
import { getActiveBranchRecord } from "@/lib/active-branch";
import { getSession } from "@/lib/auth";
import { getCompanyProfile } from "@/lib/company";
import { prisma } from "@/lib/prisma";

export default async function BankSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== Role.SUPER_ADMIN) redirect("/dashboard");

  const [company, { branch }] = await Promise.all([
    getCompanyProfile(),
    getActiveBranchRecord(session),
  ]);

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
          Set a company default for all branches, or switch branch in the top bar to override one
          branch.
        </p>
      </div>

      <DefaultBankCard
        initial={{
          bankName: company.bankName,
          accountNo: company.accountNo,
          ifsc: company.ifsc,
          bankBranch: company.bankBranch,
          upi: company.upi,
        }}
      />

      {branch && branchCounts ? (
        <div className="space-y-3">
          <div>
            <h3 className="text-lg font-semibold text-[var(--navy)]">
              Branch override · {branch.name}
            </h3>
            <p className="text-sm text-[var(--muted)]">
              Optional. When filled, this branch’s PDFs use these details instead of the company
              default.
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
          Select a branch in the top bar to set a branch-specific bank override. With{" "}
          <strong>All branches</strong>, only the default bank above is used.
        </div>
      )}
    </div>
  );
}
