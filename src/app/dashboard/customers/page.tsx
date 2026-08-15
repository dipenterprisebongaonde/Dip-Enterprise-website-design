import Link from "next/link";

import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { DataForm } from "@/components/DataForm";
import { PartyEditForm } from "@/components/PartyEditForm";
import { PartyPaymentActions } from "@/components/PartyPaymentActions";
import { getBranchScope } from "@/lib/active-branch";
import { getSession } from "@/lib/auth";
import { summarizePartyInvoices } from "@/lib/party-payments";
import { prisma } from "@/lib/prisma";

export default async function CustomersPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const { where, branchId: activeBranchId } = await getBranchScope(session);

  const [customers, branches] = await Promise.all([
    prisma.customer.findMany({
      where,
      include: {
        branch: true,
        sales: { select: { amount: true, paidAmount: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.branch.findMany({
      where: activeBranchId ? { id: activeBranchId } : {},
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="brand-display text-3xl">Customers</h2>
        <p className="text-[var(--muted)]">
          Track balance due, record payments, and store advance amounts.
        </p>
      </div>

      <DataForm
        action="/api/app/customers"
        submitLabel="Add customer"
        fields={[
          { name: "name", label: "Name", required: true },
          { name: "email", label: "Email", type: "email" },
          { name: "phone", label: "Phone" },
          { name: "address", label: "Address" },
          ...(session.role === Role.SUPER_ADMIN
            ? activeBranchId
              ? [
                  {
                    name: "branchId",
                    label: "Branch",
                    type: "hidden",
                    defaultValue: activeBranchId,
                  },
                ]
              : [
                  {
                    name: "branchId",
                    label: "Branch",
                    required: true,
                    options: branches.map((b) => ({ label: b.name, value: b.id })),
                  },
                ]
            : []),
        ]}
      />

      <div className="panel overflow-x-auto rounded-sm">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Branch</th>
              <th>Invoices</th>
              <th>Total billed</th>
              <th>Balance / Actions</th>
              <th>Edit</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => {
              const summary = summarizePartyInvoices(
                customer.sales,
                customer.advanceBalance
              );
              return (
                <tr key={customer.id}>
                  <td>
                    <Link href={`/dashboard/customers/${customer.id}`} className="party-link">
                      {customer.name}
                    </Link>
                    <div className="text-xs text-[var(--muted)]">{customer.email || "—"}</div>
                  </td>
                  <td>{customer.phone || "—"}</td>
                  <td>{customer.branch.name}</td>
                  <td>{summary.invoiceCount}</td>
                  <td>₹{summary.totalBilled.toLocaleString()}</td>
                  <td>
                    <PartyPaymentActions
                      kind="customers"
                      id={customer.id}
                      balance={summary.balance}
                      advanceBalance={summary.advanceBalance}
                      invoiceDue={summary.invoiceDue}
                    />
                  </td>
                  <td>
                    <PartyEditForm
                      kind="customers"
                      compact
                      party={{
                        id: customer.id,
                        name: customer.name,
                        email: customer.email,
                        phone: customer.phone,
                        address: customer.address,
                      }}
                    />
                  </td>
                </tr>
              );
            })}
            {customers.length === 0 && (
              <tr>
                <td colSpan={7} className="text-[var(--muted)]">
                  No customers yet. Add a customer to start tracking balances.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
