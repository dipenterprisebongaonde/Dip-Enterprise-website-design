import { PartyPaymentType, PaymentStatus, Prisma } from "@prisma/client";
import { dueAmount, resolvePaymentStatus, roundMoney } from "@/lib/payments";
import { prisma } from "@/lib/prisma";
import type { PaymentProofMeta } from "@/lib/uploads";

type Tx = Prisma.TransactionClient;

export function summarizePartyInvoices(
  invoices: Array<{ amount: number; paidAmount: number }>,
  advanceBalance = 0
) {
  const totalBilled = roundMoney(invoices.reduce((sum, invoice) => sum + invoice.amount, 0));
  const invoicePaid = roundMoney(invoices.reduce((sum, invoice) => sum + invoice.paidAmount, 0));
  const invoiceDue = roundMoney(Math.max(0, totalBilled - invoicePaid));
  const advance = roundMoney(Math.max(0, advanceBalance));
  const balance = roundMoney(Math.max(0, invoiceDue - advance));

  return {
    totalBilled,
    invoiceDue,
    advanceBalance: advance,
    balance,
    invoiceCount: invoices.length,
  };
}

async function allocateToSaleInvoices(
  tx: Tx,
  customerId: string,
  paymentAmount: number,
  paidAt: Date,
  note?: string | null,
  proof?: PaymentProofMeta | null
) {
  let remaining = roundMoney(paymentAmount);
  const invoices = await tx.sale.findMany({
    where: {
      customerId,
      OR: [{ paymentStatus: PaymentStatus.UNPAID }, { paymentStatus: PaymentStatus.PARTIAL }],
    },
    orderBy: [{ invoiceDate: "asc" }, { createdAt: "asc" }],
  });

  for (const invoice of invoices) {
    if (remaining <= 0) break;
    const due = dueAmount(invoice.amount, invoice.paidAmount);
    if (due <= 0) continue;

    const apply = roundMoney(Math.min(due, remaining));
    const nextPaid = roundMoney(invoice.paidAmount + apply);
    const paymentStatus = resolvePaymentStatus(invoice.amount, nextPaid);

    await tx.salePayment.create({
      data: {
        saleId: invoice.id,
        amount: apply,
        note: note || "Party payment",
        paidAt,
        proofUrl: proof?.proofUrl || null,
        proofFileName: proof?.proofFileName || null,
        proofMimeType: proof?.proofMimeType || null,
      },
    });
    await tx.sale.update({
      where: { id: invoice.id },
      data: { paidAmount: nextPaid, paymentStatus },
    });
    remaining = roundMoney(remaining - apply);
  }

  return remaining;
}

async function allocateToPurchaseInvoices(
  tx: Tx,
  vendorId: string,
  paymentAmount: number,
  paidAt: Date,
  note?: string | null,
  proof?: PaymentProofMeta | null
) {
  let remaining = roundMoney(paymentAmount);
  const invoices = await tx.purchase.findMany({
    where: {
      vendorId,
      OR: [{ paymentStatus: PaymentStatus.UNPAID }, { paymentStatus: PaymentStatus.PARTIAL }],
    },
    orderBy: [{ invoiceDate: "asc" }, { createdAt: "asc" }],
  });

  for (const invoice of invoices) {
    if (remaining <= 0) break;
    const due = dueAmount(invoice.amount, invoice.paidAmount);
    if (due <= 0) continue;

    const apply = roundMoney(Math.min(due, remaining));
    const nextPaid = roundMoney(invoice.paidAmount + apply);
    const paymentStatus = resolvePaymentStatus(invoice.amount, nextPaid);

    await tx.purchasePayment.create({
      data: {
        purchaseId: invoice.id,
        amount: apply,
        note: note || "Party payment",
        paidAt,
        proofUrl: proof?.proofUrl || null,
        proofFileName: proof?.proofFileName || null,
        proofMimeType: proof?.proofMimeType || null,
      },
    });
    await tx.purchase.update({
      where: { id: invoice.id },
      data: { paidAmount: nextPaid, paymentStatus },
    });
    remaining = roundMoney(remaining - apply);
  }

  return remaining;
}

export async function recordCustomerPartyPayment(options: {
  customerId: string;
  amount: number;
  type: PartyPaymentType;
  paidAt: Date;
  note?: string | null;
  proof?: PaymentProofMeta | null;
}) {
  const amount = roundMoney(options.amount);
  if (amount <= 0) throw new Error("INVALID_AMOUNT");

  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findUnique({
      where: { id: options.customerId },
      include: { sales: { select: { amount: true, paidAmount: true } } },
    });
    if (!customer) throw new Error("CUSTOMER_NOT_FOUND");

    let advanceBalance = roundMoney(customer.advanceBalance);
    let recordedAmount = amount;
    let note = options.note || null;
    let proof = options.proof || null;

    if (options.type === PartyPaymentType.ADVANCE) {
      advanceBalance = roundMoney(advanceBalance + amount);
    } else if (options.type === PartyPaymentType.APPLY) {
      const invoiceDue = summarizePartyInvoices(customer.sales, 0).invoiceDue;
      if (advanceBalance <= 0) throw new Error("NO_ADVANCE");
      if (invoiceDue <= 0) throw new Error("NO_DUE");

      const applyAmount = roundMoney(Math.min(amount, advanceBalance, invoiceDue));
      if (applyAmount <= 0) throw new Error("INVALID_AMOUNT");

      const leftover = await allocateToSaleInvoices(
        tx,
        options.customerId,
        applyAmount,
        options.paidAt,
        note || "Settled from advance",
        null
      );
      const applied = roundMoney(applyAmount - leftover);
      if (applied <= 0) throw new Error("NO_DUE");

      advanceBalance = roundMoney(advanceBalance - applied);
      recordedAmount = applied;
      note = note || "Settled from advance";
      proof = null;
    } else {
      const leftover = await allocateToSaleInvoices(
        tx,
        options.customerId,
        amount,
        options.paidAt,
        options.note,
        options.proof
      );
      if (leftover > 0) {
        advanceBalance = roundMoney(advanceBalance + leftover);
      }
    }

    const payment = await tx.customerPayment.create({
      data: {
        customerId: options.customerId,
        amount: recordedAmount,
        type: options.type,
        note,
        paidAt: options.paidAt,
        proofUrl: proof?.proofUrl || null,
        proofFileName: proof?.proofFileName || null,
        proofMimeType: proof?.proofMimeType || null,
      },
    });

    const updated = await tx.customer.update({
      where: { id: options.customerId },
      data: { advanceBalance },
      include: {
        sales: { select: { amount: true, paidAmount: true } },
      },
    });

    return {
      payment,
      customer: updated,
      summary: summarizePartyInvoices(updated.sales, updated.advanceBalance),
    };
  });
}

export async function recordVendorPartyPayment(options: {
  vendorId: string;
  amount: number;
  type: PartyPaymentType;
  paidAt: Date;
  note?: string | null;
  proof?: PaymentProofMeta | null;
}) {
  const amount = roundMoney(options.amount);
  if (amount <= 0) throw new Error("INVALID_AMOUNT");

  return prisma.$transaction(async (tx) => {
    const vendor = await tx.vendor.findUnique({
      where: { id: options.vendorId },
      include: { purchases: { select: { amount: true, paidAmount: true } } },
    });
    if (!vendor) throw new Error("VENDOR_NOT_FOUND");

    let advanceBalance = roundMoney(vendor.advanceBalance);
    let recordedAmount = amount;
    let note = options.note || null;
    let proof = options.proof || null;

    if (options.type === PartyPaymentType.ADVANCE) {
      advanceBalance = roundMoney(advanceBalance + amount);
    } else if (options.type === PartyPaymentType.APPLY) {
      const invoiceDue = summarizePartyInvoices(vendor.purchases, 0).invoiceDue;
      if (advanceBalance <= 0) throw new Error("NO_ADVANCE");
      if (invoiceDue <= 0) throw new Error("NO_DUE");

      const applyAmount = roundMoney(Math.min(amount, advanceBalance, invoiceDue));
      if (applyAmount <= 0) throw new Error("INVALID_AMOUNT");

      const leftover = await allocateToPurchaseInvoices(
        tx,
        options.vendorId,
        applyAmount,
        options.paidAt,
        note || "Settled from advance",
        null
      );
      const applied = roundMoney(applyAmount - leftover);
      if (applied <= 0) throw new Error("NO_DUE");

      advanceBalance = roundMoney(advanceBalance - applied);
      recordedAmount = applied;
      note = note || "Settled from advance";
      proof = null;
    } else {
      const leftover = await allocateToPurchaseInvoices(
        tx,
        options.vendorId,
        amount,
        options.paidAt,
        options.note,
        options.proof
      );
      if (leftover > 0) {
        advanceBalance = roundMoney(advanceBalance + leftover);
      }
    }

    const payment = await tx.vendorPayment.create({
      data: {
        vendorId: options.vendorId,
        amount: recordedAmount,
        type: options.type,
        note,
        paidAt: options.paidAt,
        proofUrl: proof?.proofUrl || null,
        proofFileName: proof?.proofFileName || null,
        proofMimeType: proof?.proofMimeType || null,
      },
    });

    const updated = await tx.vendor.update({
      where: { id: options.vendorId },
      data: { advanceBalance },
      include: {
        purchases: { select: { amount: true, paidAmount: true } },
      },
    });

    return {
      payment,
      vendor: updated,
      summary: summarizePartyInvoices(updated.purchases, updated.advanceBalance),
    };
  });
}

export async function settleSaleFromAdvance(options: {
  saleId: string;
  amount: number;
  paidAt: Date;
  note?: string | null;
}) {
  const amount = roundMoney(options.amount);
  if (amount <= 0) throw new Error("INVALID_AMOUNT");

  return prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findUnique({ where: { id: options.saleId } });
    if (!sale) throw new Error("SALE_NOT_FOUND");
    if (!sale.customerId) throw new Error("NO_CUSTOMER");

    const customer = await tx.customer.findUnique({ where: { id: sale.customerId } });
    if (!customer) throw new Error("CUSTOMER_NOT_FOUND");

    const due = dueAmount(sale.amount, sale.paidAmount);
    const advanceBalance = roundMoney(customer.advanceBalance);
    if (due <= 0) throw new Error("NO_DUE");
    if (advanceBalance <= 0) throw new Error("NO_ADVANCE");

    const applyAmount = roundMoney(Math.min(amount, due, advanceBalance));
    if (applyAmount <= 0) throw new Error("INVALID_AMOUNT");

    const note = options.note?.trim() || "Settled from advance";
    const nextPaid = roundMoney(sale.paidAmount + applyAmount);
    const paymentStatus = resolvePaymentStatus(sale.amount, nextPaid);

    const payment = await tx.salePayment.create({
      data: {
        saleId: sale.id,
        amount: applyAmount,
        note,
        paidAt: options.paidAt,
      },
    });
    const updatedSale = await tx.sale.update({
      where: { id: sale.id },
      data: { paidAmount: nextPaid, paymentStatus },
    });

    const nextAdvance = roundMoney(advanceBalance - applyAmount);
    await tx.customerPayment.create({
      data: {
        customerId: customer.id,
        amount: applyAmount,
        type: PartyPaymentType.APPLY,
        note,
        paidAt: options.paidAt,
      },
    });
    const updatedCustomer = await tx.customer.update({
      where: { id: customer.id },
      data: { advanceBalance: nextAdvance },
    });

    return {
      payment,
      sale: updatedSale,
      customer: updatedCustomer,
      applied: applyAmount,
      advanceBalance: nextAdvance,
      dueAmount: dueAmount(updatedSale.amount, updatedSale.paidAmount),
    };
  });
}

export async function settlePurchaseFromAdvance(options: {
  purchaseId: string;
  amount: number;
  paidAt: Date;
  note?: string | null;
}) {
  const amount = roundMoney(options.amount);
  if (amount <= 0) throw new Error("INVALID_AMOUNT");

  return prisma.$transaction(async (tx) => {
    const purchase = await tx.purchase.findUnique({ where: { id: options.purchaseId } });
    if (!purchase) throw new Error("PURCHASE_NOT_FOUND");
    if (!purchase.vendorId) throw new Error("NO_VENDOR");

    const vendor = await tx.vendor.findUnique({ where: { id: purchase.vendorId } });
    if (!vendor) throw new Error("VENDOR_NOT_FOUND");

    const due = dueAmount(purchase.amount, purchase.paidAmount);
    const advanceBalance = roundMoney(vendor.advanceBalance);
    if (due <= 0) throw new Error("NO_DUE");
    if (advanceBalance <= 0) throw new Error("NO_ADVANCE");

    const applyAmount = roundMoney(Math.min(amount, due, advanceBalance));
    if (applyAmount <= 0) throw new Error("INVALID_AMOUNT");

    const note = options.note?.trim() || "Settled from advance";
    const nextPaid = roundMoney(purchase.paidAmount + applyAmount);
    const paymentStatus = resolvePaymentStatus(purchase.amount, nextPaid);

    const payment = await tx.purchasePayment.create({
      data: {
        purchaseId: purchase.id,
        amount: applyAmount,
        note,
        paidAt: options.paidAt,
      },
    });
    const updatedPurchase = await tx.purchase.update({
      where: { id: purchase.id },
      data: { paidAmount: nextPaid, paymentStatus },
    });

    const nextAdvance = roundMoney(advanceBalance - applyAmount);
    await tx.vendorPayment.create({
      data: {
        vendorId: vendor.id,
        amount: applyAmount,
        type: PartyPaymentType.APPLY,
        note,
        paidAt: options.paidAt,
      },
    });
    const updatedVendor = await tx.vendor.update({
      where: { id: vendor.id },
      data: { advanceBalance: nextAdvance },
    });

    return {
      payment,
      purchase: updatedPurchase,
      vendor: updatedVendor,
      applied: applyAmount,
      advanceBalance: nextAdvance,
      dueAmount: dueAmount(updatedPurchase.amount, updatedPurchase.paidAmount),
    };
  });
}
