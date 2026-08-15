
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { DeleteRecordButton } from "@/components/DeleteRecordButton";
import { canDeleteInvoices } from "@/lib/access";
import { getBranchScope } from "@/lib/active-branch";
import { getSession } from "@/lib/auth";
import { parseDateInput } from "@/lib/date-range";
import { prisma } from "@/lib/prisma";

function dayBounds(date: Date) {
  const from = new Date(date);
  from.setHours(0, 0, 0, 0);
  const to = new Date(date);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

export default async function ExpenseDayPage({
  params,
  searchParams,
}: {
  params: Promise<{ date: string }>;
  searchParams: Promise<{ branchId?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { date: dateParam } = await params;
  const { branchId: queryBranchId } = await searchParams;
  const day = parseDateInput(dateParam);
  if (!day) notFound();

  const { where, branchId: activeBranchId } = await getBranchScope(session);
  const allowDelete = canDeleteInvoices(session);
  const showBranch = session.role === Role.SUPER_ADMIN && !activeBranchId;

  let branchFilter = where.branchId as string | undefined;
  if (showBranch && queryBranchId) {
    branchFilter = queryBranchId;
  }

  const { from, to } = dayBounds(day);

  const expenses = await prisma.expense.findMany({
    where: {
      ...(branchFilter ? { branchId: branchFilter } : {}),
      expenseDate: { gte: from, lte: to },
    },
    include: { branch: true },
    orderBy: [{ createdAt: "asc" }, { title: "asc" }],
  });

  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const branchLabel =
    expenses[0]?.branch.name ||
    (branchFilter
      ? (await prisma.branch.findUnique({ where: { id: branchFilter } }))?.name
      : null);

  const dateLabel = day.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/dashboard/expenses"
            className="btn btn-ghost"
            style={{ padding: "0.3rem 0.7rem" }}
          >
            ← Back
          </Link>
          <h2 className="brand-display mt-3 text-3xl">{dateLabel}</h2>
          <p className="text-[var(--muted)]">
            Expense details for this day
            {branchLabel ? ` · ${branchLabel}` : ""}
          </p>
        </div>
        <span className="payment-chip due">Total ₹{total.toLocaleString("en-IN")}</span>
      </div>

      <div className="panel overflow-x-auto rounded-sm">
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              {showBranch ? <th>Branch</th> : null}
              <th>Amount</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((expense) => (
              <tr key={expense.id}>
                <td className="font-semibold text-[var(--navy)]">{expense.title}</td>
                {showBranch ? <td>{expense.branch.name}</td> : null}
                <td>₹{expense.amount.toLocaleString("en-IN")}</td>
                <td>
                  {allowDelete ? (
                    <DeleteRecordButton
                      kind="expenses"
                      id={expense.id}
                      label={expense.title}
                      redirectTo={
                        queryBranchId
                          ? `/dashboard/expenses/day/${dateParam}?branchId=${queryBranchId}`
                          : `/dashboard/expenses/day/${dateParam}`
                      }
                    />
                  ) : (
                    <span className="text-xs text-[var(--muted)]">—</span>
                  )}
                </td>
              </tr>
            ))}
            {expenses.length === 0 && (
              <tr>
                <td colSpan={showBranch ? 4 : 3} className="text-[var(--muted)]">
                  No expenses on this day.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
