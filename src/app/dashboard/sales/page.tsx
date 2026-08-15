import Link from "next/link";
import { redirect } from "next/navigation";
import { AddPaymentButton } from "@/components/AddPaymentButton";
import {
  BulkPdfCheckbox,
  BulkPdfProvider,
  BulkPdfSelectAll,
  BulkPdfToolbar,
} from "@/components/BulkPdfControls";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { DeleteRecordButton } from "@/components/DeleteRecordButton";
import { InvoicePdfActions } from "@/components/InvoicePdfActions";
import { canBulkDownloadInvoices, canDeleteInvoices } from "@/lib/access";
import { getBranchScope } from "@/lib/active-branch";
import { getSession } from "@/lib/auth";
import { dateRangeQuery, rangeInputValues, resolveDateRange } from "@/lib/date-range";
import { dueAmount } from "@/lib/payments";
import { prisma } from "@/lib/prisma";

function statusClass(status: string) {
  if (status === "PAID") return "ok";
  if (status === "PARTIAL") return "accent";
  return "warn";
}

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const params = await searchParams;
  const { where: branchWhere } = await getBranchScope(session);
  const allowDelete = canDeleteInvoices(session);
  const allowBulkPdf = canBulkDownloadInvoices(session);

  const dateRange = resolveDateRange({
    range: params.range,
    from: params.from,
    to: params.to,
  });
  const invoiceDateFilter = dateRangeQuery(dateRange);
  const where = {
    ...branchWhere,
    ...(invoiceDateFilter ? { invoiceDate: invoiceDateFilter } : {}),
  };
  const inputs = rangeInputValues(dateRange);

  const sales = await prisma.sale.findMany({
    where,
    include: {
      customer: true,
      branch: true,
      payments: { orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }], take: 10 },
    },
    orderBy: [{ invoiceNo: "desc" }, { invoiceDate: "desc" }, { createdAt: "desc" }],
  });

  const total = sales.reduce((sum, sale) => sum + sale.amount, 0);

  const table = (
    <div className="panel overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            {allowBulkPdf ? (
              <th style={{ width: "2.5rem" }}>
                <BulkPdfSelectAll />
              </th>
            ) : null}
            <th>Inv No</th>
            <th>Date</th>
            <th>Product</th>
            <th>Qty</th>
            <th>Total</th>
            <th>Payment</th>
            <th>Customer</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sales.map((sale) => {
            const due = dueAmount(sale.amount, sale.paidAmount);
            const latestPayment = sale.payments[0] || null;
            const latestProof =
              sale.payments.find((payment) => payment.proofUrl) || latestPayment;
            return (
              <tr key={sale.id}>
                {allowBulkPdf ? (
                  <td>
                    <BulkPdfCheckbox id={sale.id} label={sale.invoiceNo} />
                  </td>
                ) : null}
                <td>{sale.invoiceNo}</td>
                <td>{sale.invoiceDate.toLocaleDateString()}</td>
                <td>{sale.item}</td>
                <td>{sale.quantity}</td>
                <td>₹{sale.amount.toLocaleString()}</td>
                <td>
                  <div className="space-y-2">
                    <span className={`status-pill ${statusClass(sale.paymentStatus)}`}>
                      {sale.paymentStatus}
                    </span>
                    <AddPaymentButton
                      kind="sales"
                      id={sale.id}
                      paidAmount={sale.paidAmount}
                      dueAmount={due}
                      lastPaidAt={latestPayment?.paidAt?.toISOString() || null}
                      lastPaymentMethod={
                        latestProof?.paymentMethod || latestPayment?.paymentMethod || null
                      }
                      lastProofUrl={latestProof?.proofUrl || null}
                      lastProofName={latestProof?.proofFileName || null}
                      lastProofMime={latestProof?.proofMimeType || null}
                      lastProofPaymentId={latestProof?.proofUrl ? latestProof.id : null}
                    />
                  </div>
                </td>
                <td>{sale.customer?.name || "—"}</td>
                <td>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/dashboard/sales/${sale.id}/edit`}
                      className="btn btn-ghost"
                      style={{ padding: "0.35rem 0.7rem", fontSize: "0.8rem" }}
                    >
                      Edit
                    </Link>
                    <InvoicePdfActions kind="sales" id={sale.id} />
                    {allowDelete ? (
                      <DeleteRecordButton
                        kind="sales"
                        id={sale.id}
                        label={sale.invoiceNo}
                      />
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
          {sales.length === 0 && (
            <tr>
              <td
                colSpan={allowBulkPdf ? 9 : 8}
                className="text-[var(--muted)]"
              >
                No sales in this date range.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const body = allowBulkPdf ? (
    <BulkPdfProvider kind="sales" ids={sales.map((sale) => sale.id)}>
      <div className="space-y-4">
        <BulkPdfToolbar label="Sales invoices" />
        {table}
      </div>
    </BulkPdfProvider>
  ) : (
    table
  );

  return (
    <div className="space-y-4">
      <DateRangeFilter
        basePath="/dashboard/sales"
        currentRange={dateRange.preset}
        fromValue={inputs.from}
        toValue={inputs.to}
      />
      <p className="date-range-label">
        Showing <strong>{sales.length}</strong> sale
        {sales.length === 1 ? "" : "s"} for <strong>{dateRange.label}</strong>
        {" · "}
        Total ₹{total.toLocaleString("en-IN")}
      </p>
      {body}
    </div>
  );
}
