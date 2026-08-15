import { prisma } from "@/lib/prisma";
import {
  formatInvoiceNumber,
  getIndianFinancialYear,
  invoiceDocPrefix,
  isAutoInvoiceNumber,
  parseInvoiceSequence,
  type InvoiceNumberKind,
} from "@/lib/invoice-number-format";

export type { InvoiceNumberKind } from "@/lib/invoice-number-format";
export {
  applyFinancialYearToInvoiceNumber,
  formatInvoiceNumber,
  getIndianFinancialYear,
  invoiceDocPrefix,
  isAutoInvoiceNumber,
  parseDateInput,
  parseInvoiceSequence,
} from "@/lib/invoice-number-format";

async function listInvoiceNos(
  kind: InvoiceNumberKind,
  where: { invoiceNo?: { startsWith: string }; NOT?: { id: string } }
) {
  if (kind === "sale") {
    return prisma.sale.findMany({ where, select: { invoiceNo: true, id: true } });
  }
  return prisma.purchase.findMany({ where, select: { invoiceNo: true, id: true } });
}

export async function findInvoiceByNumber(
  kind: InvoiceNumberKind,
  invoiceNo: string,
  options?: { excludeId?: string | null }
) {
  const normalized = invoiceNo.trim();
  if (!normalized) return null;
  if (kind === "sale") {
    return prisma.sale.findFirst({
      where: {
        invoiceNo: normalized,
        ...(options?.excludeId ? { NOT: { id: options.excludeId } } : {}),
      },
      select: { id: true, invoiceNo: true },
    });
  }
  return prisma.purchase.findFirst({
    where: {
      invoiceNo: normalized,
      ...(options?.excludeId ? { NOT: { id: options.excludeId } } : {}),
    },
    select: { id: true, invoiceNo: true },
  });
}

export async function assertInvoiceNoAvailable(
  kind: InvoiceNumberKind,
  invoiceNo: string,
  options?: { excludeId?: string | null }
) {
  const existing = await findInvoiceByNumber(kind, invoiceNo, options);
  if (existing) {
    throw new Error("INVOICE_NO_TAKEN");
  }
}

export async function nextInvoiceNumber(
  kind: InvoiceNumberKind,
  options?: { branchId?: string | null; date?: Date; excludeId?: string | null }
) {
  const date = options?.date || new Date();
  const fy = getIndianFinancialYear(date).label;
  const prefix = invoiceDocPrefix(kind);
  const startsWith = `${prefix} ${fy}/`;
  const where = {
    invoiceNo: { startsWith },
    ...(options?.excludeId ? { NOT: { id: options.excludeId } } : {}),
  };

  const rows = await listInvoiceNos(kind, where);

  let max = 0;
  for (const row of rows) {
    const seq = parseInvoiceSequence(row.invoiceNo, kind, fy);
    if (seq && seq > max) max = seq;
  }

  for (let attempt = 1; attempt <= 500; attempt += 1) {
    const candidate = formatInvoiceNumber(kind, max + attempt, date);
    const taken = await findInvoiceByNumber(kind, candidate, {
      excludeId: options?.excludeId,
    });
    if (!taken) return candidate;
  }

  return formatInvoiceNumber(kind, max + 1, date);
}

/** Prefer the requested number when free; otherwise allocate the next free auto number. */
export async function resolveInvoiceNumber(
  kind: InvoiceNumberKind,
  requested: string,
  options?: { date?: Date; excludeId?: string | null; allowReuseCurrent?: boolean }
) {
  const normalized = requested.trim();
  if (!normalized) {
    return nextInvoiceNumber(kind, {
      date: options?.date,
      excludeId: options?.excludeId,
    });
  }

  const taken = await findInvoiceByNumber(kind, normalized, {
    excludeId: options?.excludeId,
  });
  if (!taken) return normalized;

  if (isAutoInvoiceNumber(normalized, kind)) {
    return nextInvoiceNumber(kind, {
      date: options?.date || new Date(),
      excludeId: options?.excludeId,
    });
  }

  throw new Error("INVOICE_NO_TAKEN");
}

export function invoiceNoTakenMessage(kind: InvoiceNumberKind, invoiceNo: string) {
  const label = kind === "sale" ? "Sale" : "Purchase";
  return `${label} invoice number "${invoiceNo}" already exists. Use a different number.`;
}
