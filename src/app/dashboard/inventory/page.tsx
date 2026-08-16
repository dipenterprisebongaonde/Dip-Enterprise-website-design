import { redirect } from "next/navigation";
import Link from "next/link";
import { DataForm } from "@/components/DataForm";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { DeleteRecordButton } from "@/components/DeleteRecordButton";
import { InventoryAdjustForm } from "@/components/InventoryAdjustForm";
import { InventoryNameEditor } from "@/components/InventoryNameEditor";
import { InventoryUnitEditor } from "@/components/InventoryUnitEditor";
import { MetricGrid } from "@/components/MetricGrid";
import { canAdjustInventory, canDeleteInventory } from "@/lib/access";
import { getBranchScope } from "@/lib/active-branch";
import { getSession } from "@/lib/auth";
import { rangeInputValues, resolveDateRange } from "@/lib/date-range";
import { buildInventoryRangeSeries } from "@/lib/inventory-range-series";
import { productUnitOptions } from "@/lib/product-unit";
import { getInventoryActivityTimeline, getInventoryLedger } from "@/lib/stock";

function fmtDateTime(date: Date) {
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function movementLabel(type: string) {
  if (type === "OUT") return "OUT";
  if (type === "ADJUST") return "SET";
  return "IN";
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const params = await searchParams;
  const { where: branchFilter, branchId: activeBranchId } = await getBranchScope(session);
  const allowDelete = canDeleteInventory(session);
  const allowAdjust = canAdjustInventory(session);

  const dateRange = resolveDateRange({
    range: params.range,
    from: params.from,
    to: params.to,
  });
  const inputs = rangeInputValues(dateRange);

  const [items, trend, activity] = await Promise.all([
    getInventoryLedger(branchFilter),
    buildInventoryRangeSeries(branchFilter, dateRange),
    getInventoryActivityTimeline(branchFilter, 25),
  ]);

  function money(value: number) {
    return `₹${Math.round(value).toLocaleString("en-IN")}`;
  }

  return (
    <div className="space-y-4">
      <DateRangeFilter
        basePath="/dashboard/inventory"
        currentRange={dateRange.preset}
        fromValue={inputs.from}
        toValue={inputs.to}
      />
      <p className="date-range-label">
        Stock trend for <strong>{dateRange.label}</strong>
        {" · "}
        by <strong>{trend.periodWord}</strong>
      </p>

      <MetricGrid
        className="metric-row-two"
        items={[
          {
            label: "Units on hand",
            value: Math.round(trend.latestUnits).toLocaleString("en-IN"),
            hint: `${dateRange.label} · by ${trend.periodWord}`,
            tone: "green",
            variant: "trend",
            pill: "UNITS",
            points: trend.unitsPoints,
            touchHint: trend.touchHint,
          },
          {
            label: "Stock value",
            value: money(trend.latestValue),
            hint: `${dateRange.label} · by ${trend.periodWord}`,
            tone: "purple",
            variant: "trend",
            pill: "VALUE",
            points: trend.valuePoints,
            touchHint: trend.touchHint,
          },
        ]}
      />

      <DataForm
        action="/api/app/inventory"
        submitLabel="Add product"
        fields={[
          { name: "name", label: "Product name", required: true, placeholder: "Product name" },
          {
            name: "quantity",
            label: "Opening quantity",
            type: "number",
            required: false,
            placeholder: "Optional",
            defaultValue: "",
          },
          {
            name: "unit",
            label: "Unit",
            required: true,
            defaultValue: "pcs",
            options: productUnitOptions(),
          },
          ...(activeBranchId
            ? [
                {
                  name: "branchId",
                  label: "Branch",
                  type: "hidden",
                  defaultValue: activeBranchId,
                },
              ]
            : []),
        ]}
      />

      {allowAdjust && items.length > 0 ? (
        <InventoryAdjustForm
          items={items.map((item) => ({
            id: item.id,
            label: `${item.name} (${item.quantity} ${item.unit})`,
          }))}
        />
      ) : null}

      <div className="panel inventory-timeline-panel">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3>Inventory timeline</h3>
            <p className="text-sm text-[var(--muted)]">
              Recent stock in / out across products. Open a product for its full timeline.
            </p>
          </div>
          <span className="text-sm text-[var(--muted)]">
            {activity.length} recent move{activity.length === 1 ? "" : "s"}
          </span>
        </div>

        {activity.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            No stock movements yet. Purchases, sales, and adjustments will appear here.
          </p>
        ) : (
          <ol className="product-timeline">
            {activity.map((entry) => {
              const kind =
                entry.type === "OUT" ? "out" : entry.type === "ADJUST" ? "adjust" : "in";
              return (
                <li key={entry.id} className={kind}>
                  <div className="product-timeline-dot" aria-hidden />
                  <div className="product-timeline-card">
                    <div className="product-timeline-head">
                      <span
                        className={`status-pill ${
                          kind === "out" ? "warn" : kind === "adjust" ? "accent" : "ok"
                        }`}
                      >
                        {movementLabel(entry.type)}
                      </span>
                      <time dateTime={entry.createdAt.toISOString()}>
                        {fmtDateTime(entry.createdAt)}
                      </time>
                    </div>
                    <p className="product-timeline-qty">
                      <Link href={`/dashboard/inventory/${entry.itemId}`} className="party-link">
                        {entry.itemName}
                      </Link>
                      <span className="product-timeline-delta">
                        {" "}
                        · {entry.type === "OUT" ? "−" : entry.type === "ADJUST" ? "→" : "+"}
                        {entry.quantity} {entry.unit}
                      </span>
                    </p>
                    <p className="product-timeline-note">
                      {entry.note ||
                        (entry.type === "OUT"
                          ? "Stock out"
                          : entry.type === "ADJUST"
                            ? "Quantity set"
                            : "Stock in")}
                      {" · "}
                      {entry.branchName}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="panel overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Product name</th>
              <th>Unit</th>
              <th>Quantity</th>
              <th>Stock value</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <Link href={`/dashboard/inventory/${item.id}`} className="party-link">
                    {item.name}
                  </Link>
                </td>
                <td>
                  <InventoryUnitEditor itemId={item.id} unit={item.unit} />
                </td>
                <td>
                  <strong>
                    {item.quantity} {item.unit}
                  </strong>
                </td>
                <td>₹{item.stockValue.toLocaleString("en-IN")}</td>
                <td>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/dashboard/inventory/${item.id}`}
                      className="btn btn-ghost"
                      style={{ padding: "0.35rem 0.7rem", fontSize: "0.8rem" }}
                    >
                      Timeline
                    </Link>
                    <InventoryNameEditor itemId={item.id} name={item.name} compact />
                    {allowDelete ? (
                      <DeleteRecordButton kind="inventory" id={item.id} label={item.name} />
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="text-[var(--muted)]">
                  No products yet. Add a product, then record purchases and sales.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
