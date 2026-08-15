
-- AlterTable
ALTER TABLE "CustomerPayment" ADD COLUMN "proofUrl" TEXT;
ALTER TABLE "CustomerPayment" ADD COLUMN "proofFileName" TEXT;
ALTER TABLE "CustomerPayment" ADD COLUMN "proofMimeType" TEXT;

-- AlterTable
ALTER TABLE "VendorPayment" ADD COLUMN "proofUrl" TEXT;
ALTER TABLE "VendorPayment" ADD COLUMN "proofFileName" TEXT;
ALTER TABLE "VendorPayment" ADD COLUMN "proofMimeType" TEXT;

-- AlterTable
ALTER TABLE "SalePayment" ADD COLUMN "proofUrl" TEXT;
ALTER TABLE "SalePayment" ADD COLUMN "proofFileName" TEXT;
ALTER TABLE "SalePayment" ADD COLUMN "proofMimeType" TEXT;

-- AlterTable
ALTER TABLE "PurchasePayment" ADD COLUMN "proofUrl" TEXT;
ALTER TABLE "PurchasePayment" ADD COLUMN "proofFileName" TEXT;
ALTER TABLE "PurchasePayment" ADD COLUMN "proofMimeType" TEXT;
