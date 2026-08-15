import { notFound, redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { PartyLedgerView } from "@/components/PartyLedgerView";
import { canDeleteInvoices } from "@/lib/access";
import { getSession } from "@/lib/auth";
import { buildPartyLedger } from "@/lib/party-ledger";
import { summarizePartyInvoices } from "@/lib/party-payments";
import { prisma } from "@/lib/prisma";

export default async function CustomerLedgerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      branch: true,
      payments: { orderBy: { paidAt: "asc" } },
      sales: {
        include: { payments: { orderBy: { paidAt: "asc" } } },
        orderBy: { invoiceDate: "asc" },
      },
    },
  });

  if (!customer) notFound();
  if (session.role === Role.STAFF && customer.branchId !== session.branchId) {
    redirect("/dashboard/customers");
  }

  const summary = summarizePartyInvoices(customer.sales, customer.advanceBalance);
  const { entries } = buildPartyLedger({
    invoices: customer.sales,
    partyPayments: customer.payments,
    invoiceHrefBase: "/dashboard/sales",
    invoiceProofSource: "sale",
    partyProofSource: "customer",
    partyId: customer.id,
    allowDeleteInvoices: canDeleteInvoices(session),
  });

  return (
    <PartyLedgerView
      kind="customers"
      backHref="/dashboard/customers"
      title={customer.name}
      subtitle="Customer ledger · invoices, payments, and advances"
      partyId={customer.id}
      contact={{
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        branchName: customer.branch.name,
      }}
      summary={summary}
      entries={entries}
      invoices={customer.sales.map((sale) => ({
        id: sale.id,
        invoiceNo: sale.invoiceNo,
        invoiceDate: sale.invoiceDate,
        item: sale.item,
        amount: sale.amount,
        paidAmount: sale.paidAmount,
        paymentStatus: sale.paymentStatus,
        href: `/dashboard/sales/${sale.id}/edit`,
      }))}
    />
  );
}
