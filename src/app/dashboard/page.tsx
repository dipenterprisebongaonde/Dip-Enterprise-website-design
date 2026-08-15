
import Link from "next/link";
import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { MetricGrid } from "@/components/MetricGrid";
import { OverviewCharts } from "@/components/OverviewCharts";
import { getBranchScope, setActiveBranchId } from "@/lib/active-branch";
import { getSession } from "@/lib/auth";
import { dateRangeQuery, rangeInputValues, resolveDateRange } from "@/lib/date-range";
import {
  buildAlignedMetricSeries,
  grainNoun,
  seriesTouchHint,
} from "@/lib/metric-series";
import { prisma } from "@/lib/prisma";

function chartLabel(date: Date, index: number, prefix: string) {
  const day = date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  return day || `${prefix}${index + 1}`;
}

export default async function DashboardOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string; range?: string; from?: string; to?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const params = await searchParams;

  // Sync overview ?branch= into the global active-branch cookie for SUPER_ADMIN.
  if (session.role === Role.SUPER_ADMIN && params.branch) {
    await setActiveBranchId(params.branch);
  }

  const { where: branchWhere } = await getBranchScope(session);

  const dateRange = resolveDateRange({
    range: params.range,
    from: params.from,
    to: params.to,
  });
  const invoiceDateFilter = dateRangeQuery(dateRange);
  const invoiceWhere = {
    ...branchWhere,
    ...(invoiceDateFilter ? { invoiceDate: invoiceDateFilter } : {}),
  };
  const expenseWhere = {
    ...branchWhere,
    ...(invoiceDateFilter ? { expenseDate: invoiceDateFilter } : {}),
  };

  const [
    salesAgg,
    purchasesAgg,
    expensesAgg,
    recentSales,
    recentPurchases,
    chartSales,
    chartPurchases,
    chartExpenses,
  ] = await Promise.all([
    prisma.sale.aggregate({ where: invoiceWhere, _sum: { amount: true }, _count: true }),
    prisma.purchase.aggregate({
      where: invoiceWhere,
      _sum: { amount: true },
      _count: true,
    }),
    prisma.expense.aggregate({
      where: expenseWhere,
      _sum: { amount: true },
      _count: true,
    }),
    prisma.sale.findMany({
      where: invoiceWhere,
      include: { customer: true },
      orderBy: [{ invoiceNo: "desc" }, { invoiceDate: "desc" }, { createdAt: "desc" }],
      take: 6,
    }),
    prisma.purchase.findMany({
      where: invoiceWhere,
      include: { vendor: true },
      orderBy: [{ invoiceNo: "desc" }, { invoiceDate: "desc" }, { createdAt: "desc" }],
      take: 6,
    }),
    prisma.sale.findMany({
      where: invoiceWhere,
      orderBy: [{ invoiceDate: "asc" }, { createdAt: "asc" }],
      select: { invoiceDate: true, amount: true, invoiceNo: true },
    }),
    prisma.purchase.findMany({
      where: invoiceWhere,
      orderBy: [{ invoiceDate: "asc" }, { createdAt: "asc" }],
      select: { invoiceDate: true, amount: true, invoiceNo: true },
    }),
    prisma.expense.findMany({
      where: expenseWhere,
      orderBy: [{ expenseDate: "asc" }, { createdAt: "asc" }],
      select: { expenseDate: true, amount: true, title: true },
    }),
  ]);

  const totalSale = salesAgg._sum.amount || 0;
  const totalPurchase = purchasesAgg._sum.amount || 0;
  const totalExpense = expensesAgg._sum.amount || 0;
  const profitLoss = totalSale - totalPurchase - totalExpense;
  const inputs = rangeInputValues(dateRange);

  const {
    grain,
    saleSeries,
    purchaseSeries,
    expenseSeries,
    profitLossSeries,
  } = buildAlignedMetricSeries(
    dateRange,
    chartSales.map((sale) => ({ date: sale.invoiceDate, amount: sale.amount })),
    chartPurchases.map((purchase) => ({
      date: purchase.invoiceDate,
      amount: purchase.amount,
    })),
    chartExpenses.map((expense) => ({
      date: expense.expenseDate,
      amount: expense.amount,
    }))
  );

  const touchHint = seriesTouchHint(dateRange.preset, grain);
  const periodWord = grainNoun(grain);

  // Recent activity charts still show latest individual documents.
  const salesPoints = [...chartSales]
    .slice(-8)
    .map((sale, index) => ({
      label: chartLabel(sale.invoiceDate, index, "S"),
      value: sale.amount,
      sublabel: sale.invoiceNo,
    }));
  const purchasePoints = [...chartPurchases]
    .slice(-8)
    .map((purchase, index) => ({
      label: chartLabel(purchase.invoiceDate, index, "P"),
      value: purchase.amount,
      sublabel: purchase.invoiceNo,
    }));
  const expensePoints = [...chartExpenses]
    .slice(-8)
    .map((expense, index) => ({
      label: chartLabel(expense.expenseDate, index, "E"),
      value: expense.amount,
      sublabel: expense.title,
    }));

  function money(value: number) {
    const formatted = Math.abs(value).toLocaleString("en-IN");
    return value < 0 ? `-₹${formatted}` : `₹${formatted}`;
  }

  const saleRows = recentSales.map((sale) => ({
    id: sale.id,
    title: sale.item,
    ref: sale.invoiceNo,
    party: sale.customer?.name || "Customer",
    partyHref: sale.customerId ? `/dashboard/customers/${sale.customerId}` : null,
    amount: sale.amount,
    status: sale.paymentStatus,
    href: `/dashboard/sales/${sale.id}/edit`,
  }));

  const purchaseRows = recentPurchases.map((purchase) => ({
    id: purchase.id,
    title: purchase.item,
    ref: purchase.invoiceNo,
    party: purchase.vendor?.name || "Vendor",
    partyHref: purchase.vendorId ? `/dashboard/vendors/${purchase.vendorId}` : null,
    amount: purchase.amount,
    status: purchase.paymentStatus,
    href: `/dashboard/purchases/${purchase.id}/edit`,
  }));

  return (
    <div className="overview-page">
      <DateRangeFilter
        currentRange={dateRange.preset}
        fromValue={inputs.from}
        toValue={inputs.to}
      />

      <p className="date-range-label">
        Showing totals for <strong>{dateRange.label}</strong>
      </p>

      <MetricGrid
        items={[
          {
            label: "Total sale",
            value: money(totalSale),
            hint: `${salesAgg._count} invoices · ${dateRange.label} · by ${periodWord}`,
            tone: "blue",
            variant: "trend",
            pill: "SALE",
            points: saleSeries,
            touchHint,
          },
          {
            label: "Total purchase",
            value: money(totalPurchase),
            hint: `${purchasesAgg._count} bills · ${dateRange.label} · by ${periodWord}`,
            tone: "green",
            variant: "trend",
            pill: "PURCHASE",
            points: purchaseSeries,
            touchHint,
          },
          {
            label: "Expenses",
            value: money(totalExpense),
            hint: `${expensesAgg._count} entries · ${dateRange.label} · by ${periodWord}`,
            tone: "red",
            variant: "trend",
            pill: "EXPENSE",
            points: expenseSeries,
            touchHint,
          },
          {
            label: profitLoss >= 0 ? "Profit" : "Loss",
            value: money(profitLoss),
            hint: `Sales − purchases − expenses · ${dateRange.label} · by ${periodWord}`,
            tone: profitLoss >= 0 ? "green" : "red",
            variant: "trend",
            pill: profitLoss >= 0 ? "PROFIT" : "LOSS",
            points: profitLossSeries,
            touchHint,
          },
        ]}
      />

      <OverviewCharts
        salesTotal={totalSale}
        purchasesTotal={totalPurchase}
        expensesTotal={totalExpense}
        salesPoints={salesPoints}
        purchasePoints={purchasePoints}
        expensePoints={expensePoints}
      />

      <div className="overview-lists">
        <section className="overview-list panel">
          <div className="overview-list-head">
            <div>
              <h3>Recent sales invoices</h3>
              <p>Sales in selected date range</p>
            </div>
            <Link href="/dashboard/sales/new" className="btn btn-primary">
              + New invoice
            </Link>
          </div>

          <div className="overview-table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Inv No</th>
                  <th>Product</th>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {saleRows.map((row) => (
                  <tr key={`sale-${row.id}`}>
                    <td>
                      <Link href={row.href} className="text-[var(--accent)] font-semibold">
                        {row.ref}
                      </Link>
                    </td>
                    <td>{row.title}</td>
                    <td>
                      {row.partyHref ? (
                        <Link href={row.partyHref} className="party-link">
                          {row.party}
                        </Link>
                      ) : (
                        row.party
                      )}
                    </td>
                    <td>₹{row.amount.toLocaleString()}</td>
                    <td>
                      <span
                        className={`status-pill ${
                          row.status === "PAID"
                            ? "ok"
                            : row.status === "PARTIAL"
                              ? "accent"
                              : "warn"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {saleRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-[var(--muted)]">
                      No sales invoices in this date range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="overview-list panel">
          <div className="overview-list-head">
            <div>
              <h3>Recent purchase invoices</h3>
              <p>Purchases in selected date range</p>
            </div>
            <Link href="/dashboard/purchases/new" className="btn btn-primary">
              + New bill
            </Link>
          </div>

          <div className="overview-table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Inv No</th>
                  <th>Product</th>
                  <th>Vendor</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {purchaseRows.map((row) => (
                  <tr key={`purchase-${row.id}`}>
                    <td>
                      <Link href={row.href} className="text-[var(--accent)] font-semibold">
                        {row.ref}
                      </Link>
                    </td>
                    <td>{row.title}</td>
                    <td>
                      {row.partyHref ? (
                        <Link href={row.partyHref} className="party-link">
                          {row.party}
                        </Link>
                      ) : (
                        row.party
                      )}
                    </td>
                    <td>₹{row.amount.toLocaleString()}</td>
                    <td>
                      <span
                        className={`status-pill ${
                          row.status === "PAID"
                            ? "ok"
                            : row.status === "PARTIAL"
                              ? "accent"
                              : "warn"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {purchaseRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-[var(--muted)]">
                      No purchase invoices in this date range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
