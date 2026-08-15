
import { prisma } from "@/lib/prisma";
import { deletePaymentProofFile } from "@/lib/uploads";

export type OperationalResetResult = {
  sales: number;
  purchases: number;
  customers: number;
  vendors: number;
  inventoryItems: number;
  inventoryMovements: number;
  paymentProofs: number;
};

async function collectProofUrls() {
  const [saleProofs, purchaseProofs, customerProofs, vendorProofs] = await Promise.all([
    prisma.salePayment.findMany({
      where: { proofUrl: { not: null } },
      select: { proofUrl: true },
    }),
    prisma.purchasePayment.findMany({
      where: { proofUrl: { not: null } },
      select: { proofUrl: true },
    }),
    prisma.customerPayment.findMany({
      where: { proofUrl: { not: null } },
      select: { proofUrl: true },
    }),
    prisma.vendorPayment.findMany({
      where: { proofUrl: { not: null } },
      select: { proofUrl: true },
    }),
  ]);

  return [
    ...saleProofs,
    ...purchaseProofs,
    ...customerProofs,
    ...vendorProofs,
  ]
    .map((row) => row.proofUrl)
    .filter((url): url is string => Boolean(url));
}

/** Wipe sales, purchases, inventory, customers, and vendors (and related payments/proofs). */
export async function resetOperationalData(): Promise<OperationalResetResult> {
  const proofUrls = await collectProofUrls();

  const result = await prisma.$transaction(async (tx) => {
    const sales = await tx.sale.deleteMany();
    const purchases = await tx.purchase.deleteMany();
    const customers = await tx.customer.deleteMany();
    const vendors = await tx.vendor.deleteMany();
    const inventoryMovements = await tx.inventoryMovement.deleteMany();
    const inventoryItems = await tx.inventoryItem.deleteMany();

    return {
      sales: sales.count,
      purchases: purchases.count,
      customers: customers.count,
      vendors: vendors.count,
      inventoryItems: inventoryItems.count,
      inventoryMovements: inventoryMovements.count,
    };
  });

  let paymentProofs = 0;
  for (const url of proofUrls) {
    await deletePaymentProofFile(url);
    paymentProofs += 1;
  }

  return { ...result, paymentProofs };
}
