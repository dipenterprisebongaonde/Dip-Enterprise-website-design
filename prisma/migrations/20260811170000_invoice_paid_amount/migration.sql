
-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN "paidAmount" REAL NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN "paidAmount" REAL NOT NULL DEFAULT 0;

-- Backfill paid amounts from existing payment status
UPDATE "Sale" SET "paidAmount" = "amount" WHERE "paymentStatus" = 'PAID';
UPDATE "Purchase" SET "paidAmount" = "amount" WHERE "paymentStatus" = 'PAID';
UPDATE "Sale" SET "paidAmount" = ROUND("amount" * 0.5, 2) WHERE "paymentStatus" = 'PARTIAL' AND "paidAmount" = 0;
UPDATE "Purchase" SET "paidAmount" = ROUND("amount" * 0.5, 2) WHERE "paymentStatus" = 'PARTIAL' AND "paidAmount" = 0;

-- CreateTable
CREATE TABLE "SalePayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saleId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "note" TEXT,
    "paidAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalePayment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PurchasePayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "purchaseId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "note" TEXT,
    "paidAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PurchasePayment_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
