
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { BranchBankCard } from "@/components/BranchBankCard";
import { DataForm } from "@/components/DataForm";
import { getBranchScope } from "@/lib/active-branch";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function BranchesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== Role.SUPER_ADMIN) redirect("/dashboard");

  const { branchId: activeBranchId } = await getBranchScope(session);

  const branches = await prisma.branch.findMany({
    where: activeBranchId ? { id: activeBranchId } : {},
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { users: true, customers: true, vendors: true } },
    },
  });
  const totalBranches = await prisma.branch.count();
  const canRemove = totalBranches > 1;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="brand-display text-3xl">Branches</h2>
        <p className="text-[var(--muted)]">
          {activeBranchId
            ? "Showing the selected branch bank account. Switch branch in the top bar to change."
            : "Create branches and set a separate bank account for each one."}
        </p>
      </div>

      <DataForm
        action="/api/app/branches"
        submitLabel="Add branch"
        fields={[
          { name: "name", label: "Branch name", required: true },
          { name: "region", label: "Region", required: true },
          { name: "address", label: "Address" },
          { name: "bankName", label: "Bank name", placeholder: "Optional" },
          { name: "accountNo", label: "Account number", placeholder: "Optional" },
          { name: "ifsc", label: "IFSC", placeholder: "Optional" },
          { name: "bankBranch", label: "Bank branch", placeholder: "Optional" },
          { name: "upi", label: "UPI", placeholder: "Optional" },
        ]}
      />

      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-[var(--ink)]">Branch bank accounts</h3>
          <p className="text-sm text-[var(--muted)]">
            Invoice PDFs use the branch bank account. If empty, company Settings bank details are
            used.
          </p>
        </div>
        {branches.map((branch) => (
          <BranchBankCard
            key={branch.id}
            canRemove={canRemove}
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
              users: branch._count.users,
              customers: branch._count.customers,
              vendors: branch._count.vendors,
            }}
          />
        ))}
      </div>
    </div>
  );
}
