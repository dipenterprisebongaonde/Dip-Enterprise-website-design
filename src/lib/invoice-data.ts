import { prisma } from "@/lib/prisma";
import { InvoiceDoc } from "@/lib/invoice";
import { linesFromLegacy } from "@/lib/invoice-lines";
import { dueAmount } from "@/lib/payments";

function fmtDate(date: Date) {
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function toLines(invoice: {
  item: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  lines?: Array<{
    item: string;
    quantity: number;
    gross?: number;
    unitPrice: number;
    amount: number;
  }>;
}) {
  if (invoice.lines && invoice.lines.length > 0) {
    return invoice.lines.map((line) => ({
      item: line.item,
      quantity: line.quantity,
      gross: line.gross && line.gross > 0 ? line.gross : line.quantity,
      unitPrice: line.unitPrice,
      amount: line.amount,
    }));
  }
  return linesFromLegacy(invoice);
}

export async function getSaleInvoiceDoc(id: string): Promise<InvoiceDoc | null> {
  const sale = await prisma.sale.findUnique({
    where: { id },
    include: {
      customer: true,
      branch: true,
      payments: { orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }], take: 1 },
      lines: true,
      charges: true,
    },
  });
  if (!sale) return null;

  const lines = toLines(sale);

  return {
    type: "sale",
    invoiceNo: sale.invoiceNo,
    invoiceDate: fmtDate(sale.invoiceDate),
    dueDate: fmtDate(sale.invoiceDate),
    productName: sale.item,
    quantity: sale.quantity,
    unitPrice: sale.unitPrice,
    totalValue: sale.amount,
    roundOff: sale.roundOff,
    paidAmount: sale.paidAmount,
    dueAmount: dueAmount(sale.amount, sale.paidAmount),
    paidAt: sale.payments[0] ? fmtDate(sale.payments[0].paidAt) : null,
    paymentStatus: sale.paymentStatus,
    paymentMethod: sale.payments[0]?.paymentMethod || null,
    partyName: sale.customer?.name || "Walk-in Customer",
    partyPhone: sale.customer?.phone,
    partyAddress: sale.customer?.address,
    branchName: sale.branch.name,
    branchRegion: sale.branch.region,
    notes: sale.notes,
    lines,
    charges: sale.charges.map((charge) => ({
      label: charge.label,
      amount: charge.amount,
    })),
    branchBank: {
      bankName: sale.branch.bankName,
      accountNo: sale.branch.accountNo,
      ifsc: sale.branch.ifsc,
      bankBranch: sale.branch.bankBranch,
      upi: sale.branch.upi,
    },
  };
}

export async function getPurchaseInvoiceDoc(id: string): Promise<InvoiceDoc | null> {
  const purchase = await prisma.purchase.findUnique({
    where: { id },
    include: {
      vendor: true,
      branch: true,
      payments: { orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }], take: 1 },
      lines: true,
      charges: true,
    },
  });
  if (!purchase) return null;

  const lines = toLines(purchase);

  return {
    type: "purchase",
    invoiceNo: purchase.invoiceNo,
    invoiceDate: fmtDate(purchase.invoiceDate),
    dueDate: fmtDate(purchase.invoiceDate),
    productName: purchase.item,
    quantity: purchase.quantity,
    unitPrice: purchase.unitPrice,
    totalValue: purchase.amount,
    roundOff: purchase.roundOff,
    paidAmount: purchase.paidAmount,
    dueAmount: dueAmount(purchase.amount, purchase.paidAmount),
    paidAt: purchase.payments[0] ? fmtDate(purchase.payments[0].paidAt) : null,
    paymentStatus: purchase.paymentStatus,
    paymentMethod: purchase.payments[0]?.paymentMethod || null,
    partyName: purchase.vendor?.name || "General Vendor",
    partyPhone: purchase.vendor?.phone,
    partyAddress: purchase.vendor?.address,
    branchName: purchase.branch.name,
    branchRegion: purchase.branch.region,
    notes: purchase.notes,
    lines,
    charges: purchase.charges.map((charge) => ({
      label: charge.label,
      amount: charge.amount,
    })),
    branchBank: {
      bankName: purchase.branch.bankName,
      accountNo: purchase.branch.accountNo,
      ifsc: purchase.branch.ifsc,
      bankBranch: purchase.branch.bankBranch,
      upi: purchase.branch.upi,
    },
  };
}
