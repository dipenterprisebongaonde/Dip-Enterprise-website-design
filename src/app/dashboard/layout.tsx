import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { AppShell } from "@/components/AppShell";
import { getActiveBranchRecord } from "@/lib/active-branch";
import { getSession } from "@/lib/auth";
import { getCompanyProfile } from "@/lib/company";
import { prisma } from "@/lib/prisma";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const adminNav = [
    { href: "/dashboard", label: "Overview" },
    { href: "/dashboard/inventory", label: "Inventory" },
    { href: "/dashboard/purchases", label: "Purchases" },
    { href: "/dashboard/sales", label: "Sales" },
    { href: "/dashboard/expenses", label: "Expenses" },
    { href: "/dashboard/vendors", label: "Vendors" },
    { href: "/dashboard/customers", label: "Customers" },
    { href: "/dashboard/users", label: "Users" },
    { href: "/dashboard/branches", label: "Branches" },
    { href: "/choose-path", label: "Paths" },
  ];

  const staffNav = [
    { href: "/dashboard", label: "Overview" },
    { href: "/dashboard/inventory", label: "Inventory" },
    { href: "/dashboard/purchases", label: "Purchases" },
    { href: "/dashboard/sales", label: "Sales" },
    { href: "/dashboard/expenses", label: "Expenses" },
    { href: "/dashboard/vendors", label: "Vendors" },
    { href: "/dashboard/customers", label: "Customers" },
  ];


  const [company, { scope, branch }, branches] = await Promise.all([
    getCompanyProfile(),
    getActiveBranchRecord(session),
    session.role === Role.SUPER_ADMIN
      ? prisma.branch.findMany({ orderBy: { name: "asc" } })
      : session.branchId
        ? prisma.branch.findMany({ where: { id: session.branchId } })
        : Promise.resolve([]),
  ]);

  return (
    <AppShell
      role={session.role}
      userName={session.name}
      nav={session.role === Role.SUPER_ADMIN ? adminNav : staffNav}
      companyName={company.companyName}
      logoUrl={company.logoUrl}
      companyMotto={company.companyMotto}
      branches={branches.map((item) => ({
        id: item.id,
        name: item.name,
        region: item.region,
      }))}
      activeBranchId={scope.branchId}
      activeBranchName={branch?.name || null}
      branchLocked={scope.locked}
    >
      {children}
    </AppShell>
  );
}
