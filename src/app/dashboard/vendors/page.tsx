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

export default async function VendorsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const { where, branchId: activeBranchId } = await getBranchScope(session);

  const [vendors, branches] = await Promise.all([
    prisma.vendor.findMany({
      where,
      include: {
        branch: true,
        purchases: { select: { amount: true, paidAmount: true } },
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
        <h2 className="brand-display text-3xl">Vendors</h2>
        <p className="text-[var(--muted)]">
          Track balance due, record payments, and store advance amounts.
        </p>
      </div>

      <DataForm
        action="/api/app/vendors"
        submitLabel="Add vendor"
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

      <div className="panel party-table-wrap rounded-sm">
        <table className="table party-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Branch</th>
              <th>Bills</th>
              <th>Total billed</th>
              <th className="party-actions-col">Balance / Actions</th>
              <th>Edit</th>
            </tr>
          </thead>
          <tbody>
            {vendors.map((vendor) => {
              const summary = summarizePartyInvoices(
                vendor.purchases,
                vendor.advanceBalance
              );
              return (
                <tr key={vendor.id}>
                  <td>
                    <Link href={`/dashboard/vendors/${vendor.id}`} className="party-link">
                      {vendor.name}
                    </Link>
                    <div className="text-xs text-[var(--muted)]">{vendor.email || "—"}</div>
                  </td>
                  <td className="party-phone-cell">{vendor.phone || "—"}</td>
                  <td>{vendor.branch.name}</td>
                  <td>{summary.invoiceCount}</td>
                  <td>₹{summary.totalBilled.toLocaleString()}</td>
                  <td className="party-actions-cell">
                    <PartyPaymentActions
                      kind="vendors"
                      id={vendor.id}
                      balance={summary.balance}
                      advanceBalance={summary.advanceBalance}
                      invoiceDue={summary.invoiceDue}
                    />
                  </td>
                  <td>
                    <PartyEditForm
                      kind="vendors"
                      compact
                      party={{
                        id: vendor.id,
                        name: vendor.name,
                        email: vendor.email,
                        phone: vendor.phone,
                        address: vendor.address,
                      }}
                    />
                  </td>
                </tr>
              );
            })}
            {vendors.length === 0 && (
              <tr>
                <td colSpan={7} className="text-[var(--muted)]">
                  No vendors yet. Add a vendor to start tracking balances.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
