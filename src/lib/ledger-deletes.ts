import { PartyPaymentType } from "@prisma/client";
import { resolvePaymentStatus, roundMoney } from "@/lib/payments";
import { prisma } from "@/lib/prisma";
import { deletePaymentProofFile } from "@/lib/uploads";

function isAdvanceAppliedNote(note?: string | null) {
  if (!note) return false;
  return /settled from advance|applied from advance|apply(?:ing)? advance|from advance|settlement/i.test(
    note
  );
}

export async function deleteCustomerAdvancePayment(options: {
  customerId: string;
  paymentId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.customerPayment.findFirst({
      where: { id: options.paymentId, customerId: options.customerId },
    });
    if (!payment) throw new Error("NOT_FOUND");
    if (payment.type !== PartyPaymentType.ADVANCE) {
      throw new Error("NOT_ADVANCE");
    }

    const customer = await tx.customer.findUnique({ where: { id: options.customerId } });
    if (!customer) throw new Error("NOT_FOUND");

    const advanceBalance = roundMoney(customer.advanceBalance);
    const amount = roundMoney(payment.amount);
    if (advanceBalance + 0.001 < amount) {
      throw new Error("ADVANCE_APPLIED");
    }

    await deletePaymentProofFile(payment.proofUrl);
    await tx.customerPayment.delete({ where: { id: payment.id } });
    await tx.customer.update({
      where: { id: options.customerId },
      data: { advanceBalance: roundMoney(advanceBalance - amount) },
    });

    return { ok: true as const };
  });
}

export async function deleteVendorAdvancePayment(options: {
  vendorId: string;
  paymentId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.vendorPayment.findFirst({
      where: { id: options.paymentId, vendorId: options.vendorId },
    });
    if (!payment) throw new Error("NOT_FOUND");
    if (payment.type !== PartyPaymentType.ADVANCE) {
      throw new Error("NOT_ADVANCE");
    }

    const vendor = await tx.vendor.findUnique({ where: { id: options.vendorId } });
    if (!vendor) throw new Error("NOT_FOUND");

    const advanceBalance = roundMoney(vendor.advanceBalance);
    const amount = roundMoney(payment.amount);
    if (advanceBalance + 0.001 < amount) {
      throw new Error("ADVANCE_APPLIED");
    }

    await deletePaymentProofFile(payment.proofUrl);
    await tx.vendorPayment.delete({ where: { id: payment.id } });
    await tx.vendor.update({
      where: { id: options.vendorId },
      data: { advanceBalance: roundMoney(advanceBalance - amount) },
    });

    return { ok: true as const };
  });
}

export async function deleteSaleInvoicePayment(options: {
  saleId: string;
  paymentId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.salePayment.findFirst({
      where: { id: options.paymentId, saleId: options.saleId },
      include: { sale: true },
    });
    if (!payment) throw new Error("NOT_FOUND");

    const amount = roundMoney(payment.amount);
    const nextPaid = roundMoney(Math.max(0, payment.sale.paidAmount - amount));
    const paymentStatus = resolvePaymentStatus(payment.sale.amount, nextPaid);

    await deletePaymentProofFile(payment.proofUrl);
    await tx.salePayment.delete({ where: { id: payment.id } });
    await tx.sale.update({
      where: { id: options.saleId },
      data: { paidAmount: nextPaid, paymentStatus },
    });

    if (isAdvanceAppliedNote(payment.note) && payment.sale.customerId) {
      const customer = await tx.customer.findUnique({
        where: { id: payment.sale.customerId },
      });
      if (customer) {
        await tx.customer.update({
          where: { id: customer.id },
          data: { advanceBalance: roundMoney(customer.advanceBalance + amount) },
        });
      }
    }

    return { ok: true as const };
  });
}

export async function deletePurchaseInvoicePayment(options: {
  purchaseId: string;
  paymentId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.purchasePayment.findFirst({
      where: { id: options.paymentId, purchaseId: options.purchaseId },
      include: { purchase: true },
    });
    if (!payment) throw new Error("NOT_FOUND");

    const amount = roundMoney(payment.amount);
    const nextPaid = roundMoney(Math.max(0, payment.purchase.paidAmount - amount));
    const paymentStatus = resolvePaymentStatus(payment.purchase.amount, nextPaid);

    await deletePaymentProofFile(payment.proofUrl);
    await tx.purchasePayment.delete({ where: { id: payment.id } });
    await tx.purchase.update({
      where: { id: options.purchaseId },
      data: { paidAmount: nextPaid, paymentStatus },
    });

    if (isAdvanceAppliedNote(payment.note) && payment.purchase.vendorId) {
      const vendor = await tx.vendor.findUnique({
        where: { id: payment.purchase.vendorId },
      });
      if (vendor) {
        await tx.vendor.update({
          where: { id: vendor.id },
          data: { advanceBalance: roundMoney(vendor.advanceBalance + amount) },
        });
      }
    }

    return { ok: true as const };
  });
}

export function ledgerDeleteErrorMessage(code: string) {
  if (code === "NOT_FOUND") return "Entry not found.";
  if (code === "NOT_ADVANCE") return "Only advance entries can be deleted here.";
  if (code === "ADVANCE_APPLIED") {
    return "This advance was already applied to invoices. Delete those applied payments first.";
  }
  return "Could not delete ledger entry.";
}
