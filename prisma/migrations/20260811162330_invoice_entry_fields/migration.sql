-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Purchase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceNo" TEXT NOT NULL,
    "invoiceDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "item" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" REAL NOT NULL DEFAULT 0,
    "amount" REAL NOT NULL,
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "notes" TEXT,
    "branchId" TEXT NOT NULL,
    "vendorId" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Purchase_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Purchase_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Purchase_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Purchase" (
  "id", "invoiceNo", "invoiceDate", "item", "quantity", "unitPrice", "amount",
  "paymentStatus", "notes", "branchId", "vendorId", "createdById", "createdAt"
)
SELECT
  "id",
  'PUR-' || substr("id", -6),
  "createdAt",
  "item",
  "quantity",
  CASE WHEN "quantity" > 0 THEN "amount" * 1.0 / "quantity" ELSE 0 END,
  "amount",
  'PAID',
  "notes",
  "branchId",
  "vendorId",
  "createdById",
  "createdAt"
FROM "Purchase";
DROP TABLE "Purchase";
ALTER TABLE "new_Purchase" RENAME TO "Purchase";

CREATE TABLE "new_Sale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceNo" TEXT NOT NULL,
    "invoiceDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "item" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" REAL NOT NULL DEFAULT 0,
    "amount" REAL NOT NULL,
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "notes" TEXT,
    "branchId" TEXT NOT NULL,
    "customerId" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Sale_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Sale_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Sale" (
  "id", "invoiceNo", "invoiceDate", "item", "quantity", "unitPrice", "amount",
  "paymentStatus", "notes", "branchId", "customerId", "createdById", "createdAt"
)
SELECT
  "id",
  'INV-' || substr("id", -6),
  "createdAt",
  "item",
  "quantity",
  CASE WHEN "quantity" > 0 THEN "amount" * 1.0 / "quantity" ELSE 0 END,
  "amount",
  'PAID',
  "notes",
  "branchId",
  "customerId",
  "createdById",
  "createdAt"
FROM "Sale";
DROP TABLE "Sale";
ALTER TABLE "new_Sale" RENAME TO "Sale";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
