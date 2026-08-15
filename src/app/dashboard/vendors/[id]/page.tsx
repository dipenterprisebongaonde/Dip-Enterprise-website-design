import { notFound, redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { PartyLedgerView } from "@/components/PartyLedgerView";
import { canDeleteInvoices } from "@/lib/access";
import { getSession } from "@/lib/auth";
import { buildPartyLedger } from "@/lib/party-ledger";
import { summarizePartyInvoices } from "@/lib/party-payments";
import { prisma } from "@/lib/prisma";

export default async function VendorLedgerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const vendor = await prisma.vendor.findUnique({
    where: { id },
    include: {
      branch: true,
      payments: { orderBy: { paidAt: "asc" } },
      purchases: {
        include: { payments: { orderBy: { paidAt: "asc" } } },
        orderBy: { invoiceDate: "asc" },
      },
    },
  });

  if (!vendor) notFound();
  if (session.role === Role.STAFF && vendor.branchId !== session.branchId) {
    redirect("/dashboard/vendors");
  }

  const summary = summarizePartyInvoices(vendor.purchases, vendor.advanceBalance);
  const { entries } = buildPartyLedger({
    invoices: vendor.purchases,
    partyPayments: vendor.payments,
    invoiceHrefBase: "/dashboard/purchases",
    invoiceProofSource: "purchase",
    partyProofSource: "vendor",
    partyId: vendor.id,
    allowDeleteInvoices: canDeleteInvoices(session),
  });

  return (
    <PartyLedgerView
      kind="vendors"
      backHref="/dashboard/vendors"
      title={vendor.name}
      subtitle="Vendor ledger · bills, payments, and advances"
      partyId={vendor.id}
      contact={{
        phone: vendor.phone,
        email: vendor.email,
        address: vendor.address,
        branchName: vendor.branch.name,
      }}
      summary={summary}
      entries={entries}
      invoices={vendor.purchases.map((purchase) => ({
        id: purchase.id,
        invoiceNo: purchase.invoiceNo,
        invoiceDate: purchase.invoiceDate,
        item: purchase.item,
        amount: purchase.amount,
        paidAmount: purchase.paidAmount,
        paymentStatus: purchase.paymentStatus,
        href: `/dashboard/purchases/${purchase.id}/edit`,
      }))}
    />
  );
}
