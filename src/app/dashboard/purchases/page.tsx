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

export default async function PurchasesPage({
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

  const purchases = await prisma.purchase.findMany({
    where,
    include: {
      vendor: true,
      branch: true,
      payments: { orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }], take: 10 },
    },
    orderBy: [{ invoiceNo: "desc" }, { invoiceDate: "desc" }, { createdAt: "desc" }],
  });

  const total = purchases.reduce((sum, purchase) => sum + purchase.amount, 0);

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
            <th>Vendor</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {purchases.map((purchase) => {
            const due = dueAmount(purchase.amount, purchase.paidAmount);
            const latestPayment = purchase.payments[0] || null;
            const latestProof =
              purchase.payments.find((payment) => payment.proofUrl) || latestPayment;
            return (
              <tr key={purchase.id}>
                {allowBulkPdf ? (
                  <td>
                    <BulkPdfCheckbox id={purchase.id} label={purchase.invoiceNo} />
                  </td>
                ) : null}
                <td>{purchase.invoiceNo}</td>
                <td>{purchase.invoiceDate.toLocaleDateString()}</td>
                <td>{purchase.item}</td>
                <td>{purchase.quantity}</td>
                <td>₹{purchase.amount.toLocaleString()}</td>
                <td>
                  <div className="space-y-2">
                    <span
                      className={`status-pill ${statusClass(purchase.paymentStatus)}`}
                    >
                      {purchase.paymentStatus}
                    </span>
                    <AddPaymentButton
                      kind="purchases"
                      id={purchase.id}
                      paidAmount={purchase.paidAmount}
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
                <td>{purchase.vendor?.name || "—"}</td>
                <td>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/dashboard/purchases/${purchase.id}/edit`}
                      className="btn btn-ghost"
                      style={{ padding: "0.35rem 0.7rem", fontSize: "0.8rem" }}
                    >
                      Edit
                    </Link>
                    <InvoicePdfActions kind="purchases" id={purchase.id} />
                    {allowDelete ? (
                      <DeleteRecordButton
                        kind="purchases"
                        id={purchase.id}
                        label={purchase.invoiceNo}
                      />
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
          {purchases.length === 0 && (
            <tr>
              <td
                colSpan={allowBulkPdf ? 9 : 8}
                className="text-[var(--muted)]"
              >
                No purchases in this date range.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const body = allowBulkPdf ? (
    <BulkPdfProvider kind="purchases" ids={purchases.map((purchase) => purchase.id)}>
      <div className="space-y-4">
        <BulkPdfToolbar label="Purchase invoices" />
        {table}
      </div>
    </BulkPdfProvider>
  ) : (
    table
  );

  return (
    <div className="space-y-4">
      <DateRangeFilter
        basePath="/dashboard/purchases"
        currentRange={dateRange.preset}
        fromValue={inputs.from}
        toValue={inputs.to}
      />
      <p className="date-range-label">
        Showing <strong>{purchases.length}</strong> purchase
        {purchases.length === 1 ? "" : "s"} for <strong>{dateRange.label}</strong>
        {" · "}
        Total ₹{total.toLocaleString("en-IN")}
      </p>
      {body}
    </div>
  );
}
