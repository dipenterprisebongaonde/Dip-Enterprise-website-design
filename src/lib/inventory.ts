
export const INVENTORY_CATEGORIES = [
  { value: "ELECTRONICS", label: "Electronics" },
  { value: "SPARE_PARTS", label: "Spare Parts" },
  { value: "SECURITY_GEAR", label: "Security Gear" },
  { value: "FLEET_SUPPLIES", label: "Fleet Supplies" },
  { value: "OFFICE", label: "Office" },
  { value: "OTHER", label: "Other" },
] as const;

export const INVENTORY_OPTIONS = [
  {
    href: "/dashboard/inventory",
    title: "All stock",
    copy: "Browse every SKU across your branch scope.",
  },
  {
    href: "/dashboard/inventory?view=low",
    title: "Low stock alerts",
    copy: "Items at or below reorder level that need restocking.",
  },
  {
    href: "/dashboard/inventory?view=add",
    title: "Add inventory item",
    copy: "Create a new SKU with category, cost, and location.",
  },
  {
    href: "/dashboard/inventory?view=adjust",
    title: "Adjust stock",
    copy: "Stock in, stock out, or set corrections with movement history.",
  },
  {
    href: "/dashboard/inventory?view=categories",
    title: "By category",
    copy: "Filter inventory by electronics, spare parts, security, fleet, and more.",
  },
] as const;

export function categoryLabel(value: string) {
  return INVENTORY_CATEGORIES.find((c) => c.value === value)?.label || value;
}
