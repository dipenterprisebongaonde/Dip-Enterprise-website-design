
-- CreateTable
CREATE TABLE "SaleLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saleId" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" REAL NOT NULL DEFAULT 0,
    "amount" REAL NOT NULL,
    CONSTRAINT "SaleLine_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PurchaseLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "purchaseId" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" REAL NOT NULL DEFAULT 0,
    "amount" REAL NOT NULL,
    CONSTRAINT "PurchaseLine_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Backfill one line for each existing invoice
INSERT INTO "SaleLine" ("id", "saleId", "item", "quantity", "unitPrice", "amount")
SELECT lower(hex(randomblob(8))) || lower(hex(randomblob(8))), "id", "item", "quantity", "unitPrice", "amount"
FROM "Sale";

INSERT INTO "PurchaseLine" ("id", "purchaseId", "item", "quantity", "unitPrice", "amount")
SELECT lower(hex(randomblob(8))) || lower(hex(randomblob(8))), "id", "item", "quantity", "unitPrice", "amount"
FROM "Purchase";
