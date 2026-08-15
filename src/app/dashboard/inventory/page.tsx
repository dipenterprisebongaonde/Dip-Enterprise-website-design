import Link from "next/link";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { DataForm } from "@/components/DataForm";
import { InventoryAdjustForm } from "@/components/InventoryAdjustForm";
import { InventoryOptions } from "@/components/InventoryOptions";
import { MetricGrid } from "@/components/MetricGrid";
import { getSession } from "@/lib/auth";
import { INVENTORY_CATEGORIES, categoryLabel } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; category?: string; branch?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const params = await searchParams;
  const view = params.view || null;
  const category = params.category || "ALL";

  const branchId =
    session.role === Role.STAFF ? session.branchId : params.branch || null;

  const where = {
    ...(branchId ? { branchId } : {}),
    ...(category !== "ALL" ? { category: category as never } : {}),
  };

  const [items, branches] = await Promise.all([
    prisma.inventoryItem.findMany({
      where,
      include: {
        branch: true,
        movements: { orderBy: { createdAt: "desc" }, take: 4 },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.branch.findMany({ orderBy: { name: "asc" } }),
  ]);

  const visibleItems =
    view === "low" ? items.filter((item) => item.quantity <= item.reorderLevel) : items;

  const summary = {
    totalSkus: items.length,
    totalUnits: items.reduce((sum, item) => sum + item.quantity, 0),
    lowStock: items.filter((item) => item.quantity <= item.reorderLevel).length,
    stockValue: items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0),
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[var(--navy)]">Inventory management</h2>
        <p className="text-[var(--muted)]">
          Track SKUs, reorder levels, stock movements, and category filters by branch.
        </p>
      </div>

      <InventoryOptions activeView={view} />

      <MetricGrid
        items={[
          { label: "Total SKUs", value: String(summary.totalSkus) },
          { label: "Units on hand", value: String(summary.totalUnits) },
          { label: "Low stock alerts", value: String(summary.lowStock) },
          {
            label: "Stock value",
            value: `₹${summary.stockValue.toLocaleString()}`,
          },
        ]}
      />

      {(view === "categories" || category !== "ALL") && (
        <div className="filter-bar">
          <Link
            href="/dashboard/inventory?view=categories"
            className={`filter-chip ${category === "ALL" ? "active" : ""}`}
          >
            All categories
          </Link>
          {INVENTORY_CATEGORIES.map((cat) => (
            <Link
              key={cat.value}
              href={`/dashboard/inventory?view=categories&category=${cat.value}`}
              className={`filter-chip ${category === cat.value ? "active" : ""}`}
            >
              {cat.label}
            </Link>
          ))}
        </div>
      )}

      {(view === "add" || view === null) && (
        <DataForm
          action="/api/app/inventory"
          submitLabel="Add inventory item"
          fields={[
            { name: "sku", label: "SKU", required: true, placeholder: "CCTV-KIT-01" },
            { name: "name", label: "Item name", required: true },
            {
              name: "category",
              label: "Category",
              required: true,
              options: INVENTORY_CATEGORIES.map((c) => ({ label: c.label, value: c.value })),
            },
            { name: "quantity", label: "Opening quantity", type: "number", required: true },
            { name: "reorderLevel", label: "Reorder level", type: "number", required: true },
            { name: "unitCost", label: "Unit cost", type: "number", required: true },
            { name: "location", label: "Storage location" },
            { name: "description", label: "Description" },
            ...(session.role === Role.SUPER_ADMIN
              ? [
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
      )}

      {(view === "adjust" || view === null) && (
        <InventoryAdjustForm
          items={items.map((item) => ({
            id: item.id,
            label: `${item.sku} · ${item.name} (${item.quantity} on hand)`,
          }))}
        />
      )}

      <div className="content-dark overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Name</th>
              <th>Category</th>
              <th>Qty</th>
              <th>Reorder</th>
              <th>Unit cost</th>
              <th>Location</th>
              <th>Branch</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((item) => {
              const low = item.quantity <= item.reorderLevel;
              return (
                <tr key={item.id}>
                  <td>{item.sku}</td>
                  <td>{item.name}</td>
                  <td>{categoryLabel(item.category)}</td>
                  <td>{item.quantity}</td>
                  <td>{item.reorderLevel}</td>
                  <td>₹{item.unitCost.toLocaleString()}</td>
                  <td>{item.location || "—"}</td>
                  <td>{item.branch.name}</td>
                  <td>
                    <span className={`status-pill ${low ? "danger" : "ok"}`}>
                      {low ? "Low stock" : "In stock"}
                    </span>
                  </td>
                </tr>
              );
            })}
            {visibleItems.length === 0 && (
              <tr>
                <td colSpan={9} className="muted">
                  No inventory items match this view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {view === "adjust" && (
        <div className="grid gap-4 md:grid-cols-2">
          {items.slice(0, 4).map((item) => (
            <div key={item.id} className="panel p-4">
              <h3 className="text-lg font-bold text-[var(--navy)]">{item.sku} movements</h3>
              <ul className="mt-3 space-y-2 text-sm text-[var(--muted)]">
                {item.movements.map((movement) => (
                  <li key={movement.id}>
                    {movement.createdAt.toLocaleString()} · {movement.type} · {movement.quantity}
                    {movement.note ? ` · ${movement.note}` : ""}
                  </li>
                ))}
                {item.movements.length === 0 && <li>No movements yet.</li>}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
