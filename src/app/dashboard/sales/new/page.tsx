import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { InvoiceEntryForm } from "@/components/InvoiceEntryForm";
import { getBranchScope } from "@/lib/active-branch";
import { getSession } from "@/lib/auth";
import { nextInvoiceNumber } from "@/lib/invoice-number";
import { prisma } from "@/lib/prisma";

export default async function NewSalePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const { where, branchId: activeBranchId } = await getBranchScope(session);

  const [products, customers, branches, invoiceNo] = await Promise.all([
    prisma.inventoryItem.findMany({
      where,
      orderBy: { name: "asc" },
      select: { name: true, quantity: true, unitCost: true, unit: true },
    }),
    prisma.customer.findMany({ where, orderBy: { name: "asc" } }),
    prisma.branch.findMany({
      where: activeBranchId ? { id: activeBranchId } : {},
      orderBy: { name: "asc" },
    }),
    nextInvoiceNumber("sale", { branchId: activeBranchId }),
  ]);

  const showBranch = session.role === Role.SUPER_ADMIN && !activeBranchId;

  return (
    <InvoiceEntryForm
      mode="sale"
      action="/api/app/sales"
      backHref="/dashboard/sales"
      invoiceNo={invoiceNo}
      products={products.map((p) => ({
        label: `${p.name} (${p.quantity} ${p.unit || "pcs"} in stock)`,
        value: p.name,
        unitPrice: p.unitCost,
        unit: p.unit || "pcs",
      }))}
      parties={customers.map((c) => ({ label: c.name, value: c.id }))}
      branches={branches.map((b) => ({ label: b.name, value: b.id }))}
      showBranch={showBranch}
      initialValues={{
        branchId: activeBranchId || undefined,
      }}
    />
  );
}
