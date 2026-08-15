
import Link from "next/link";
import { INVENTORY_OPTIONS } from "@/lib/inventory";

export function InventoryOptions({
  activeView,
}: {
  activeView?: string | null;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {INVENTORY_OPTIONS.map((option) => {
        const view = new URL(option.href, "http://local").searchParams.get("view");
        const active =
          (!activeView && option.href === "/dashboard/inventory") ||
          (activeView && view === activeView);

        return (
          <Link
            key={option.href}
            href={option.href}
            className={`option-card ${active ? "active" : ""}`}
          >
            <p className="brand-display text-xl text-[var(--navy)]">{option.title}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">{option.copy}</p>
          </Link>
        );
      })}
    </div>
  );
}
