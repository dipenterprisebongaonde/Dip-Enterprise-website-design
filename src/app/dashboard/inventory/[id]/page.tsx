
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { DeleteRecordButton } from "@/components/DeleteRecordButton";
import { InventoryNameEditor } from "@/components/InventoryNameEditor";
import { canDeleteInventory } from "@/lib/access";
import { getSession } from "@/lib/auth";
import { getProductTimeline } from "@/lib/stock";
import { prisma } from "@/lib/prisma";

function fmtDateTime(date: Date) {
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ProductTimelinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const existing = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!existing) notFound();
  if (session.role === Role.STAFF && existing.branchId !== session.branchId) {
    redirect("/dashboard/inventory");
  }

  const timeline = await getProductTimeline(id);
  if (!timeline) notFound();

  const { item, summary, entries } = timeline;
  const allowDelete = canDeleteInventory(session);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/dashboard/inventory"
            className="btn btn-ghost"
            style={{ padding: "0.3rem 0.7rem" }}
          >
            ← Back
          </Link>
          <h2 className="brand-display mt-3 text-3xl">{item.name}</h2>
          <p className="text-[var(--muted)]">Product timeline · stock in and out</p>
          <div className="mt-2 flex flex-wrap gap-2 text-sm text-[var(--muted)]">
            <span>
              {item.branchName} ({item.branchRegion})
            </span>
            <span>·</span>
            <span>SKU {item.sku}</span>
            <span>·</span>
            <span>Unit {item.unit}</span>
          </div>
          <div className="mt-3">
            <InventoryNameEditor itemId={item.id} name={item.name} />
          </div>
        </div>
        {allowDelete ? (
          <DeleteRecordButton
            kind="inventory"
            id={item.id}
            label={item.name}
            redirectTo="/dashboard/inventory"
          />
        ) : null}
      </div>

      <div className="ledger-summary">
        <div>
          <p>On hand</p>
          <strong>
            {summary.onHand} {item.unit}
          </strong>
        </div>
        <div>
          <p>Purchased / in</p>
          <strong>
            {summary.purchased} {item.unit}
          </strong>
        </div>
        <div>
          <p>Sold / out</p>
          <strong>
            {summary.sold} {item.unit}
          </strong>
        </div>
        <div>
          <p>Stock value</p>
          <strong>₹{summary.stockValue.toLocaleString("en-IN")}</strong>
        </div>
      </div>

      <div className="panel rounded-sm p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h3 className="text-lg font-bold text-[var(--navy)]">Timeline</h3>
          <span className="text-sm text-[var(--muted)]">
            {summary.movementCount} movement{summary.movementCount === 1 ? "" : "s"}
          </span>
        </div>

        {entries.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No stock movements yet for this product.</p>
        ) : (
          <ol className="product-timeline">
            {entries.map((entry) => {
              const isOut = entry.type === "OUT";
              return (
                <li key={entry.id} className={isOut ? "out" : "in"}>
                  <div className="product-timeline-dot" aria-hidden />
                  <div className="product-timeline-card">
                    <div className="product-timeline-head">
                      <span className={`status-pill ${isOut ? "warn" : "ok"}`}>
                        {isOut ? "OUT" : "IN"}
                      </span>
                      <time dateTime={entry.createdAt.toISOString()}>
                        {fmtDateTime(entry.createdAt)}
                      </time>
                    </div>
                    <p className="product-timeline-qty">
                      {isOut ? "−" : "+"}
                      {entry.quantity} {item.unit}
                    </p>
                    <p className="product-timeline-note">
                      {entry.note || (isOut ? "Stock out" : "Stock in")}
                    </p>
                    <p className="product-timeline-balance">
                      Balance after:{" "}
                      <strong>
                        {entry.balanceAfter} {item.unit}
                      </strong>
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
