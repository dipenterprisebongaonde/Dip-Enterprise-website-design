
import { notFound, redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { InvoiceEntryForm } from "@/components/InvoiceEntryForm";
import { getSession } from "@/lib/auth";
import { linesFromLegacy } from "@/lib/invoice-lines";
import { prisma } from "@/lib/prisma";

export default async function EditPurchasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const purchase = await prisma.purchase.findUnique({
    where: { id },
    include: {
      payments: { orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }], take: 10 },
      lines: true,
      charges: true,
    },
  });
  if (!purchase) notFound();
  if (session.role === Role.STAFF && purchase.branchId !== session.branchId) {
    redirect("/dashboard/purchases");
  }

  const where =
    session.role === Role.STAFF && session.branchId ? { branchId: session.branchId } : {};

  const [products, vendors, branches] = await Promise.all([
    prisma.inventoryItem.findMany({
      where,
      orderBy: { name: "asc" },
      select: { name: true, quantity: true, unitCost: true, unit: true },
    }),
    prisma.vendor.findMany({ where, orderBy: { name: "asc" } }),
    prisma.branch.findMany({ orderBy: { name: "asc" } }),
  ]);

  const invoiceLines =
    purchase.lines.length > 0
      ? purchase.lines.map((line) => ({
          item: line.item,
          quantity: line.quantity,
          gross: line.gross > 0 ? line.gross : line.quantity,
          unitPrice: line.unitPrice,
        }))
      : linesFromLegacy(purchase).map((line) => ({
          item: line.item,
          quantity: line.quantity,
          gross: line.gross,
          unitPrice: line.unitPrice,
        }));

  const productOptions = products.map((p) => ({
    label: `${p.name} (${p.quantity} ${p.unit || "pcs"} in stock)`,
    value: p.name,
    unitPrice: p.unitCost,
    unit: p.unit || "pcs",
  }));

  for (const line of invoiceLines) {
    if (!productOptions.some((p) => p.value === line.item)) {
      productOptions.unshift({
        label: `${line.item} (current)`,
        value: line.item,
        unitPrice: line.unitPrice,
        unit: "pcs",
      });
    }
  }

  const latestPayment = purchase.payments[0];
  const proofPayment = purchase.payments.find((payment) => payment.proofUrl) || latestPayment;

  return (
    <InvoiceEntryForm
      mode="purchase"
      method="PUT"
      action={`/api/app/purchases/${purchase.id}`}
      backHref="/dashboard/purchases"
      invoiceNo={purchase.invoiceNo}
      products={productOptions}
      parties={vendors.map((v) => ({ label: v.name, value: v.id }))}
      branches={branches.map((b) => ({ label: b.name, value: b.id }))}
      showBranch={session.role === Role.SUPER_ADMIN}
      initialValues={{
        invoiceNo: purchase.invoiceNo,
        invoiceDate: purchase.invoiceDate.toISOString().slice(0, 10),
        paymentStatus: purchase.paymentStatus,
        paidAmount: purchase.paidAmount,
        paidAt:
          latestPayment?.paidAt.toISOString().slice(0, 10) ||
          purchase.invoiceDate.toISOString().slice(0, 10),
        notes: purchase.notes || "",
        vendorId: purchase.vendorId,
        branchId: purchase.branchId,
        lines: invoiceLines,
        charges: purchase.charges.map((charge) => ({
          label: charge.label,
          amount: charge.amount,
        })),
        roundOff: purchase.roundOff,
        applyRoundOff: purchase.roundOff !== 0,
        proofUrl: proofPayment?.proofUrl || null,
        proofFileName: proofPayment?.proofFileName || null,
        proofMimeType: proofPayment?.proofMimeType || null,
        proofPaymentId: proofPayment?.proofUrl ? proofPayment.id : null,
      }}
    />
  );
}
