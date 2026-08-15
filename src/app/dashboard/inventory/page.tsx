import { redirect } from "next/navigation";
import Link from "next/link";
import { Role } from "@prisma/client";
import { DataForm } from "@/components/DataForm";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { DeleteRecordButton } from "@/components/DeleteRecordButton";
import { InventoryNameEditor } from "@/components/InventoryNameEditor";
import { InventoryUnitEditor } from "@/components/InventoryUnitEditor";
import { MetricGrid } from "@/components/MetricGrid";
import { canDeleteInventory } from "@/lib/access";
import { getBranchScope } from "@/lib/active-branch";
import { getSession } from "@/lib/auth";
import { rangeInputValues, resolveDateRange } from "@/lib/date-range";
import { buildInventoryRangeSeries } from "@/lib/inventory-range-series";
import { productUnitOptions } from "@/lib/product-unit";
import { getInventoryLedger } from "@/lib/stock";

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

  const dateRange = resolveDateRange({
    range: params.range,
    from: params.from,
    to: params.to,
  });
  const inputs = rangeInputValues(dateRange);

  const [items, trend] = await Promise.all([
    getInventoryLedger(branchFilter),
    buildInventoryRangeSeries(branchFilter, dateRange),
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
                    <InventoryNameEditor itemId={item.id} name={item.name} compact />
                    {allowDelete ? (
                      <DeleteRecordButton kind="inventory" id={item.id} label={item.name} />
                    ) : (
                      <span className="text-xs text-[var(--muted)]">—</span>
                    )}
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
