import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { BranchBankCard } from "@/components/BranchBankCard";
import { CompanySettingsForm } from "@/components/CompanySettingsForm";
import { OperationalBackupCard } from "@/components/OperationalBackupCard";
import { OperationalResetCard } from "@/components/OperationalResetCard";
import { SettingsMenu } from "@/components/SettingsMenu";
import { getActiveBranchRecord } from "@/lib/active-branch";
import { getSession } from "@/lib/auth";
import { getCompanyProfile } from "@/lib/company";
import { prisma } from "@/lib/prisma";

export default async function SettingsPage() {
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
        <h2 className="brand-display text-3xl">Settings</h2>
        <p className="text-[var(--muted)]">
          Company defaults stay here. Switch branch in the top bar to edit that branch bank
          account and scoped data.
        </p>
      </div>

      <SettingsMenu />

      <div id="branch-bank" className="space-y-3 scroll-mt-24">
        {branch && branchCounts ? (
          <>
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
          </>
        ) : (
          <div className="panel rounded-sm p-4 text-sm text-[var(--muted)]">
            Select a branch in the top bar to view and edit that branch’s bank account.
          </div>
        )}
      </div>

      <div id="company-details" className="scroll-mt-24">
        <CompanySettingsForm initial={company} />
      </div>

      <div id="ops-backup" className="space-y-6 scroll-mt-24">
        <OperationalBackupCard />
        <OperationalResetCard />
      </div>
    </div>
  );
}
