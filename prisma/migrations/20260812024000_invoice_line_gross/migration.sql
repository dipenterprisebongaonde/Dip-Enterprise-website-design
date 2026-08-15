
-- AlterTable
ALTER TABLE "SaleLine" ADD COLUMN "gross" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "PurchaseLine" ADD COLUMN "gross" INTEGER NOT NULL DEFAULT 0;

-- Backfill: existing bills used quantity for both stock and billing
UPDATE "SaleLine" SET "gross" = "quantity" WHERE "gross" = 0;
UPDATE "PurchaseLine" SET "gross" = "quantity" WHERE "gross" = 0;
