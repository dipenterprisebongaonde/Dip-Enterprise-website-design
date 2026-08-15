
export const INVOICE_SORT_KEYS = [
  "invoiceNo",
  "invoiceDate",
  "item",
  "quantity",
  "amount",
  "paymentStatus",
  "party",
] as const;

export type InvoiceSortKey = (typeof INVOICE_SORT_KEYS)[number];
export type SortDir = "asc" | "desc";

const DEFAULT_SORT: InvoiceSortKey = "invoiceNo";
const DEFAULT_DIR: SortDir = "desc";

export function parseInvoiceSort(params: {
  sort?: string;
  dir?: string;
}): { sort: InvoiceSortKey; dir: SortDir } {
  const sort = INVOICE_SORT_KEYS.includes(params.sort as InvoiceSortKey)
    ? (params.sort as InvoiceSortKey)
    : DEFAULT_SORT;
  const dir = params.dir === "asc" || params.dir === "desc" ? params.dir : DEFAULT_DIR;
  return { sort, dir };
}

export function nextSortDir(
  currentSort: InvoiceSortKey,
  currentDir: SortDir,
  clicked: InvoiceSortKey
): SortDir {
  if (currentSort !== clicked) {
    // New column: invoice numbers / dates / totals prefer newest/highest first.
    if (clicked === "invoiceNo" || clicked === "invoiceDate" || clicked === "amount") {
      return "desc";
    }
    return "asc";
  }
  return currentDir === "asc" ? "desc" : "asc";
}

export function invoiceOrderBy(
  kind: "sale" | "purchase",
  sort: InvoiceSortKey,
  dir: SortDir
) {
  const secondary =
    sort === "invoiceNo"
      ? [{ invoiceDate: dir }, { createdAt: dir }]
      : [{ invoiceNo: "desc" as const }, { createdAt: "desc" as const }];

  if (sort === "party") {
    if (kind === "sale") {
      return [{ customer: { name: dir } }, ...secondary];
    }
    return [{ vendor: { name: dir } }, ...secondary];
  }

  return [{ [sort]: dir }, ...secondary];
}

export function buildSortHref(
  basePath: string,
  current: Record<string, string | undefined | null>,
  sort: InvoiceSortKey,
  dir: SortDir
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(current)) {
    if (!value || key === "sort" || key === "dir") continue;
    params.set(key, value);
  }
  params.set("sort", sort);
  params.set("dir", dir);
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}
