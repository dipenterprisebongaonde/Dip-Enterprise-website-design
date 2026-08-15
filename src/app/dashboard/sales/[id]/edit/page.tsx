
import { notFound, redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { InvoiceEntryForm } from "@/components/InvoiceEntryForm";
import { getSession } from "@/lib/auth";
import { linesFromLegacy } from "@/lib/invoice-lines";
import { prisma } from "@/lib/prisma";

export default async function EditSalePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const sale = await prisma.sale.findUnique({
    where: { id },
    include: {
      payments: { orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }], take: 10 },
      lines: true,
      charges: true,
    },
  });
  if (!sale) notFound();
  if (session.role === Role.STAFF && sale.branchId !== session.branchId) {
    redirect("/dashboard/sales");
  }

  const where =
    session.role === Role.STAFF && session.branchId ? { branchId: session.branchId } : {};

  const [products, customers, branches] = await Promise.all([
    prisma.inventoryItem.findMany({
      where,
      orderBy: { name: "asc" },
      select: { name: true, quantity: true, unitCost: true, unit: true },
    }),
    prisma.customer.findMany({ where, orderBy: { name: "asc" } }),
    prisma.branch.findMany({ orderBy: { name: "asc" } }),
  ]);

  const invoiceLines =
    sale.lines.length > 0
      ? sale.lines.map((line) => ({
          item: line.item,
          quantity: line.quantity,
          gross: line.gross > 0 ? line.gross : line.quantity,
          unitPrice: line.unitPrice,
        }))
      : linesFromLegacy(sale).map((line) => ({
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

  const latestPayment = sale.payments[0];
  const proofPayment = sale.payments.find((payment) => payment.proofUrl) || latestPayment;

  return (
    <InvoiceEntryForm
      mode="sale"
      method="PUT"
      action={`/api/app/sales/${sale.id}`}
      backHref="/dashboard/sales"
      invoiceNo={sale.invoiceNo}
      products={productOptions}
      parties={customers.map((c) => ({ label: c.name, value: c.id }))}
      branches={branches.map((b) => ({ label: b.name, value: b.id }))}
      showBranch={session.role === Role.SUPER_ADMIN}
      initialValues={{
        invoiceNo: sale.invoiceNo,
        invoiceDate: sale.invoiceDate.toISOString().slice(0, 10),
        paymentStatus: sale.paymentStatus,
        paidAmount: sale.paidAmount,
        paidAt:
          latestPayment?.paidAt.toISOString().slice(0, 10) ||
          sale.invoiceDate.toISOString().slice(0, 10),
        notes: sale.notes || "",
        customerId: sale.customerId,
        branchId: sale.branchId,
        lines: invoiceLines,
        charges: sale.charges.map((charge) => ({
          label: charge.label,
          amount: charge.amount,
        })),
        roundOff: sale.roundOff,
        applyRoundOff: sale.roundOff !== 0,
        proofUrl: proofPayment?.proofUrl || null,
        proofFileName: proofPayment?.proofFileName || null,
        proofMimeType: proofPayment?.proofMimeType || null,
        proofPaymentId: proofPayment?.proofUrl ? proofPayment.id : null,
      }}
    />
  );
}
