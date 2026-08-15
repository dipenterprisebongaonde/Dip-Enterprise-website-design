
-- CreateTable
CREATE TABLE "SaleCharge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saleId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    CONSTRAINT "SaleCharge_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PurchaseCharge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "purchaseId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    CONSTRAINT "PurchaseCharge_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
