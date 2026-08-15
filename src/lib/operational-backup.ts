
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import {
  InventoryCategory,
  PartyPaymentType,
  PaymentStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deletePaymentProofFile, proofFilenameFromUrl } from "@/lib/uploads";

export const BACKUP_KIND = "dip-operational-backup";
export const BACKUP_VERSION = 1;

type ProofFileBackup = {
  filename: string;
  mimeType: string;
  base64: string;
};

export type OperationalBackup = {
  kind: typeof BACKUP_KIND;
  version: typeof BACKUP_VERSION;
  createdAt: string;
  data: {
    customers: Array<Record<string, unknown>>;
    vendors: Array<Record<string, unknown>>;
    customerPayments: Array<Record<string, unknown>>;
    vendorPayments: Array<Record<string, unknown>>;
    sales: Array<Record<string, unknown>>;
    saleLines: Array<Record<string, unknown>>;
    salePayments: Array<Record<string, unknown>>;
    purchases: Array<Record<string, unknown>>;
    purchaseLines: Array<Record<string, unknown>>;
    purchasePayments: Array<Record<string, unknown>>;
    inventoryItems: Array<Record<string, unknown>>;
    inventoryMovements: Array<Record<string, unknown>>;
    proofFiles: ProofFileBackup[];
  };
};

export type OperationalBackupCounts = {
  customers: number;
  vendors: number;
  customerPayments: number;
  vendorPayments: number;
  sales: number;
  saleLines: number;
  salePayments: number;
  purchases: number;
  purchaseLines: number;
  purchasePayments: number;
  inventoryItems: number;
  inventoryMovements: number;
  proofFiles: number;
};

const PROOF_DIR = path.join(process.cwd(), "public", "uploads", "payment-proofs");

function iso(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function asDate(value: unknown, fallback = new Date()) {
  if (typeof value === "string" || value instanceof Date) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return fallback;
}

function asOptionalDate(value: unknown) {
  if (value == null || value === "") return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asOptionalString(value: unknown) {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function asNumber(value: unknown, fallback = 0) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asInt(value: unknown, fallback = 0) {
  return Math.trunc(asNumber(value, fallback));
}

async function createManyChunked<T extends object>(
  createMany: (data: T[]) => Promise<unknown>,
  rows: T[],
  size = 80
) {
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    if (chunk.length) await createMany(chunk);
  }
}

function collectProofMeta(
  rows: Array<{ proofUrl?: string | null; proofMimeType?: string | null }>
) {
  const map = new Map<string, string>();
  for (const row of rows) {
    const filename = proofFilenameFromUrl(row.proofUrl);
    if (!filename) continue;
    map.set(filename, row.proofMimeType || "application/octet-stream");
  }
  return map;
}

async function readProofFiles(
  meta: Map<string, string>
): Promise<ProofFileBackup[]> {
  const files: ProofFileBackup[] = [];
  for (const [filename, mimeType] of meta) {
    try {
      const buffer = await readFile(path.join(PROOF_DIR, filename));
      files.push({
        filename,
        mimeType,
        base64: buffer.toString("base64"),
      });
    } catch {
      // Missing file — skip; DB fields still restored.
    }
  }
  return files;
}

async function writeProofFiles(files: ProofFileBackup[]) {
  await mkdir(PROOF_DIR, { recursive: true });
  let written = 0;
  for (const file of files) {
    if (!file.filename || !file.base64) continue;
    if (!/^[a-zA-Z0-9._-]+$/.test(file.filename)) continue;
    try {
      await writeFile(path.join(PROOF_DIR, file.filename), Buffer.from(file.base64, "base64"));
      written += 1;
    } catch {
      // Continue restoring other files.
    }
  }
  return written;
}

export async function buildOperationalBackup(): Promise<OperationalBackup> {
  const [
    customers,
    vendors,
    customerPayments,
    vendorPayments,
    sales,
    saleLines,
    salePayments,
    purchases,
    purchaseLines,
    purchasePayments,
    inventoryItems,
    inventoryMovements,
  ] = await Promise.all([
    prisma.customer.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.vendor.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.customerPayment.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.vendorPayment.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.sale.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.saleLine.findMany(),
    prisma.salePayment.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.purchase.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.purchaseLine.findMany(),
    prisma.purchasePayment.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.inventoryItem.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.inventoryMovement.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  const proofMeta = collectProofMeta([
    ...salePayments,
    ...purchasePayments,
    ...customerPayments,
    ...vendorPayments,
  ]);
  const proofFiles = await readProofFiles(proofMeta);

  const serializeDates = <T extends Record<string, unknown>>(row: T, keys: string[]) => {
    const next: Record<string, unknown> = { ...row };
    for (const key of keys) {
      if (key in next) next[key] = iso(next[key] as Date | string | null);
    }
    return next;
  };

  return {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    data: {
      customers: customers.map((row) => serializeDates({ ...row }, ["createdAt"])),
      vendors: vendors.map((row) => serializeDates({ ...row }, ["createdAt"])),
      customerPayments: customerPayments.map((row) =>
        serializeDates({ ...row }, ["paidAt", "createdAt"])
      ),
      vendorPayments: vendorPayments.map((row) =>
        serializeDates({ ...row }, ["paidAt", "createdAt"])
      ),
      sales: sales.map((row) => serializeDates({ ...row }, ["invoiceDate", "createdAt"])),
      saleLines: saleLines.map((row) => ({ ...row })),
      salePayments: salePayments.map((row) =>
        serializeDates({ ...row }, ["paidAt", "createdAt"])
      ),
      purchases: purchases.map((row) =>
        serializeDates({ ...row }, ["invoiceDate", "createdAt"])
      ),
      purchaseLines: purchaseLines.map((row) => ({ ...row })),
      purchasePayments: purchasePayments.map((row) =>
        serializeDates({ ...row }, ["paidAt", "createdAt"])
      ),
      inventoryItems: inventoryItems.map((row) =>
        serializeDates({ ...row }, ["createdAt", "updatedAt"])
      ),
      inventoryMovements: inventoryMovements.map((row) =>
        serializeDates({ ...row }, ["createdAt"])
      ),
      proofFiles,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord);
}

export function parseOperationalBackup(raw: unknown): OperationalBackup {
  if (!isRecord(raw)) throw new Error("INVALID_BACKUP");
  if (raw.kind !== BACKUP_KIND) throw new Error("INVALID_KIND");
  if (raw.version !== BACKUP_VERSION) throw new Error("INVALID_VERSION");
  if (!isRecord(raw.data)) throw new Error("INVALID_DATA");

  const data = raw.data;
  return {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    createdAt: asString(raw.createdAt, new Date().toISOString()),
    data: {
      customers: asArray(data.customers),
      vendors: asArray(data.vendors),
      customerPayments: asArray(data.customerPayments),
      vendorPayments: asArray(data.vendorPayments),
      sales: asArray(data.sales),
      saleLines: asArray(data.saleLines),
      salePayments: asArray(data.salePayments),
      purchases: asArray(data.purchases),
      purchaseLines: asArray(data.purchaseLines),
      purchasePayments: asArray(data.purchasePayments),
      inventoryItems: asArray(data.inventoryItems),
      inventoryMovements: asArray(data.inventoryMovements),
      proofFiles: Array.isArray(data.proofFiles)
        ? data.proofFiles
            .filter(isRecord)
            .map((file) => ({
              filename: asString(file.filename),
              mimeType: asString(file.mimeType, "application/octet-stream"),
              base64: asString(file.base64),
            }))
            .filter((file) => file.filename && file.base64)
        : [],
    },
  };
}

const PAYMENT_STATUSES = new Set(Object.values(PaymentStatus));
const PARTY_PAYMENT_TYPES = new Set(Object.values(PartyPaymentType));
const INVENTORY_CATEGORIES = new Set(Object.values(InventoryCategory));

function paymentStatus(value: unknown): PaymentStatus {
  const text = asString(value, PaymentStatus.UNPAID);
  return PAYMENT_STATUSES.has(text as PaymentStatus)
    ? (text as PaymentStatus)
    : PaymentStatus.UNPAID;
}

function partyPaymentType(value: unknown): PartyPaymentType {
  const text = asString(value, PartyPaymentType.PAY);
  return PARTY_PAYMENT_TYPES.has(text as PartyPaymentType)
    ? (text as PartyPaymentType)
    : PartyPaymentType.PAY;
}

function inventoryCategory(value: unknown): InventoryCategory {
  const text = asString(value, InventoryCategory.OTHER);
  return INVENTORY_CATEGORIES.has(text as InventoryCategory)
    ? (text as InventoryCategory)
    : InventoryCategory.OTHER;
}

export async function recoverOperationalBackup(
  backup: OperationalBackup
): Promise<OperationalBackupCounts> {
  const branchIds = new Set(
    (await prisma.branch.findMany({ select: { id: true } })).map((b) => b.id)
  );
  const userIds = new Set(
    (await prisma.user.findMany({ select: { id: true } })).map((u) => u.id)
  );

  const requireBranch = (branchId: unknown, label: string) => {
    const id = asString(branchId);
    if (!id || !branchIds.has(id)) {
      throw new Error(`MISSING_BRANCH:${label}`);
    }
    return id;
  };

  const optionalUser = (userId: unknown) => {
    const id = asOptionalString(userId);
    if (!id) return null;
    return userIds.has(id) ? id : null;
  };

  const customers = backup.data.customers.map((row) => ({
    id: asString(row.id),
    name: asString(row.name, "Customer"),
    email: asOptionalString(row.email),
    phone: asOptionalString(row.phone),
    address: asOptionalString(row.address),
    branchId: requireBranch(row.branchId, "customer"),
    advanceBalance: asNumber(row.advanceBalance),
    createdAt: asDate(row.createdAt),
  }));

  const vendors = backup.data.vendors.map((row) => ({
    id: asString(row.id),
    name: asString(row.name, "Vendor"),
    email: asOptionalString(row.email),
    phone: asOptionalString(row.phone),
    address: asOptionalString(row.address),
    branchId: requireBranch(row.branchId, "vendor"),
    advanceBalance: asNumber(row.advanceBalance),
    createdAt: asDate(row.createdAt),
  }));

  const customerIds = new Set(customers.map((row) => row.id));
  const vendorIds = new Set(vendors.map((row) => row.id));

  const customerPayments = backup.data.customerPayments
    .filter((row) => customerIds.has(asString(row.customerId)))
    .map((row) => ({
      id: asString(row.id),
      customerId: asString(row.customerId),
      amount: asNumber(row.amount),
      type: partyPaymentType(row.type),
      note: asOptionalString(row.note),
      proofUrl: asOptionalString(row.proofUrl),
      proofFileName: asOptionalString(row.proofFileName),
      proofMimeType: asOptionalString(row.proofMimeType),
      paidAt: asDate(row.paidAt),
      createdAt: asDate(row.createdAt),
    }));

  const vendorPayments = backup.data.vendorPayments
    .filter((row) => vendorIds.has(asString(row.vendorId)))
    .map((row) => ({
      id: asString(row.id),
      vendorId: asString(row.vendorId),
      amount: asNumber(row.amount),
      type: partyPaymentType(row.type),
      note: asOptionalString(row.note),
      proofUrl: asOptionalString(row.proofUrl),
      proofFileName: asOptionalString(row.proofFileName),
      proofMimeType: asOptionalString(row.proofMimeType),
      paidAt: asDate(row.paidAt),
      createdAt: asDate(row.createdAt),
    }));

  const sales = backup.data.sales.map((row) => {
    const customerId = asOptionalString(row.customerId);
    return {
      id: asString(row.id),
      invoiceNo: asString(row.invoiceNo, "SALE"),
      invoiceDate: asDate(row.invoiceDate),
      item: asString(row.item, "Item"),
      quantity: asInt(row.quantity, 1),
      unitPrice: asNumber(row.unitPrice),
      amount: asNumber(row.amount),
      paidAmount: asNumber(row.paidAmount),
      paymentStatus: paymentStatus(row.paymentStatus),
      notes: asOptionalString(row.notes),
      branchId: requireBranch(row.branchId, "sale"),
      customerId: customerId && customerIds.has(customerId) ? customerId : null,
      createdById: optionalUser(row.createdById),
      createdAt: asDate(row.createdAt),
    };
  });

  const saleIds = new Set(sales.map((row) => row.id));

  const saleLines = backup.data.saleLines
    .filter((row) => saleIds.has(asString(row.saleId)))
    .map((row) => ({
      id: asString(row.id),
      saleId: asString(row.saleId),
      item: asString(row.item, "Item"),
      quantity: asInt(row.quantity, 1),
      unitPrice: asNumber(row.unitPrice),
      amount: asNumber(row.amount),
    }));

  const salePayments = backup.data.salePayments
    .filter((row) => saleIds.has(asString(row.saleId)))
    .map((row) => ({
      id: asString(row.id),
      saleId: asString(row.saleId),
      amount: asNumber(row.amount),
      note: asOptionalString(row.note),
      paymentMethod: asOptionalString(row.paymentMethod),
      proofUrl: asOptionalString(row.proofUrl),
      proofFileName: asOptionalString(row.proofFileName),
      proofMimeType: asOptionalString(row.proofMimeType),
      paidAt: asDate(row.paidAt),
      createdAt: asDate(row.createdAt),
    }));

  const purchases = backup.data.purchases.map((row) => {
    const vendorId = asOptionalString(row.vendorId);
    return {
      id: asString(row.id),
      invoiceNo: asString(row.invoiceNo, "PUR"),
      invoiceDate: asDate(row.invoiceDate),
      item: asString(row.item, "Item"),
      quantity: asInt(row.quantity, 1),
      unitPrice: asNumber(row.unitPrice),
      amount: asNumber(row.amount),
      paidAmount: asNumber(row.paidAmount),
      paymentStatus: paymentStatus(row.paymentStatus),
      notes: asOptionalString(row.notes),
      branchId: requireBranch(row.branchId, "purchase"),
      vendorId: vendorId && vendorIds.has(vendorId) ? vendorId : null,
      createdById: optionalUser(row.createdById),
      createdAt: asDate(row.createdAt),
    };
  });

  const purchaseIds = new Set(purchases.map((row) => row.id));

  const purchaseLines = backup.data.purchaseLines
    .filter((row) => purchaseIds.has(asString(row.purchaseId)))
    .map((row) => ({
      id: asString(row.id),
      purchaseId: asString(row.purchaseId),
      item: asString(row.item, "Item"),
      quantity: asInt(row.quantity, 1),
      unitPrice: asNumber(row.unitPrice),
      amount: asNumber(row.amount),
    }));

  const purchasePayments = backup.data.purchasePayments
    .filter((row) => purchaseIds.has(asString(row.purchaseId)))
    .map((row) => ({
      id: asString(row.id),
      purchaseId: asString(row.purchaseId),
      amount: asNumber(row.amount),
      note: asOptionalString(row.note),
      paymentMethod: asOptionalString(row.paymentMethod),
      proofUrl: asOptionalString(row.proofUrl),
      proofFileName: asOptionalString(row.proofFileName),
      proofMimeType: asOptionalString(row.proofMimeType),
      paidAt: asDate(row.paidAt),
      createdAt: asDate(row.createdAt),
    }));

  const inventoryItems = backup.data.inventoryItems.map((row) => ({
    id: asString(row.id),
    sku: asString(row.sku, "SKU"),
    name: asString(row.name, "Item"),
    category: inventoryCategory(row.category),
    description: asOptionalString(row.description),
    quantity: asInt(row.quantity),
    unit: asString(row.unit, "pcs"),
    reorderLevel: asInt(row.reorderLevel, 5),
    unitCost: asNumber(row.unitCost),
    location: asOptionalString(row.location),
    branchId: requireBranch(row.branchId, "inventory"),
    createdAt: asDate(row.createdAt),
    updatedAt: asOptionalDate(row.updatedAt) || asDate(row.createdAt),
  }));

  const inventoryItemIds = new Set(inventoryItems.map((row) => row.id));

  const inventoryMovements = backup.data.inventoryMovements
    .filter((row) => inventoryItemIds.has(asString(row.itemId)))
    .map((row) => ({
      id: asString(row.id),
      itemId: asString(row.itemId),
      type: asString(row.type, "IN"),
      quantity: asInt(row.quantity),
      note: asOptionalString(row.note),
      createdAt: asDate(row.createdAt),
    }));

  // Replace current operational data, then restore backup rows.
  const existingProofUrls = [
    ...(await prisma.salePayment.findMany({
      where: { proofUrl: { not: null } },
      select: { proofUrl: true },
    })),
    ...(await prisma.purchasePayment.findMany({
      where: { proofUrl: { not: null } },
      select: { proofUrl: true },
    })),
    ...(await prisma.customerPayment.findMany({
      where: { proofUrl: { not: null } },
      select: { proofUrl: true },
    })),
    ...(await prisma.vendorPayment.findMany({
      where: { proofUrl: { not: null } },
      select: { proofUrl: true },
    })),
  ]
    .map((row) => row.proofUrl)
    .filter((url): url is string => Boolean(url));

  await prisma.$transaction(
    async (tx) => {
      await tx.sale.deleteMany();
      await tx.purchase.deleteMany();
      await tx.customer.deleteMany();
      await tx.vendor.deleteMany();
      await tx.inventoryMovement.deleteMany();
      await tx.inventoryItem.deleteMany();

      await createManyChunked(
        (data) => tx.customer.createMany({ data }),
        customers
      );
      await createManyChunked((data) => tx.vendor.createMany({ data }), vendors);
      await createManyChunked(
        (data) => tx.customerPayment.createMany({ data }),
        customerPayments
      );
      await createManyChunked(
        (data) => tx.vendorPayment.createMany({ data }),
        vendorPayments
      );
      await createManyChunked(
        (data) => tx.inventoryItem.createMany({ data }),
        inventoryItems
      );
      await createManyChunked(
        (data) => tx.inventoryMovement.createMany({ data }),
        inventoryMovements
      );
      await createManyChunked((data) => tx.sale.createMany({ data }), sales);
      await createManyChunked((data) => tx.saleLine.createMany({ data }), saleLines);
      await createManyChunked(
        (data) => tx.salePayment.createMany({ data }),
        salePayments
      );
      await createManyChunked((data) => tx.purchase.createMany({ data }), purchases);
      await createManyChunked(
        (data) => tx.purchaseLine.createMany({ data }),
        purchaseLines
      );
      await createManyChunked(
        (data) => tx.purchasePayment.createMany({ data }),
        purchasePayments
      );
    },
    { timeout: 60_000 }
  );

  for (const url of existingProofUrls) {
    await deletePaymentProofFile(url);
  }

  const proofFiles = await writeProofFiles(backup.data.proofFiles);

  return {
    customers: customers.length,
    vendors: vendors.length,
    customerPayments: customerPayments.length,
    vendorPayments: vendorPayments.length,
    sales: sales.length,
    saleLines: saleLines.length,
    salePayments: salePayments.length,
    purchases: purchases.length,
    purchaseLines: purchaseLines.length,
    purchasePayments: purchasePayments.length,
    inventoryItems: inventoryItems.length,
    inventoryMovements: inventoryMovements.length,
    proofFiles,
  };
}

export function backupErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.startsWith("MISSING_BRANCH:")) {
    return "Backup references a branch that no longer exists. Restore branches first, then recover.";
  }
  if (message === "INVALID_KIND" || message === "INVALID_VERSION" || message === "INVALID_BACKUP") {
    return "Invalid backup file. Use a DIP operational backup JSON export.";
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return "Could not recover backup into the database.";
  }
  return "Could not recover backup.";
}
