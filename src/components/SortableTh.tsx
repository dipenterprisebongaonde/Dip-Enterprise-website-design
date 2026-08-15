
import Link from "next/link";
import {
  buildSortHref,
  nextSortDir,
  type InvoiceSortKey,
  type SortDir,
} from "@/lib/invoice-table-sort";

export function SortableTh({
  label,
  column,
  activeSort,
  activeDir,
  basePath,
  query,
}: {
  label: string;
  column: InvoiceSortKey;
  activeSort: InvoiceSortKey;
  activeDir: SortDir;
  basePath: string;
  query: Record<string, string | undefined | null>;
}) {
  const active = activeSort === column;
  const nextDir = nextSortDir(activeSort, activeDir, column);
  const href = buildSortHref(basePath, query, column, nextDir);
  const hint = active
    ? activeDir === "asc"
      ? "Sorted ascending. Click for descending."
      : "Sorted descending. Click for ascending."
    : `Sort by ${label}`;

  return (
    <th aria-sort={active ? (activeDir === "asc" ? "ascending" : "descending") : "none"}>
      <Link href={href} className={`sort-th${active ? " is-active" : ""}`} title={hint}>
        <span>{label}</span>
        <span className="sort-th-icons" aria-hidden>
          <i className={active && activeDir === "asc" ? "on" : undefined}>▲</i>
          <i className={active && activeDir === "desc" ? "on" : undefined}>▼</i>
        </span>
      </Link>
    </th>
  );
}
