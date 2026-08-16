import Link from "next/link";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { InvoiceTemplatesStudio } from "@/components/InvoiceTemplatesStudio";
import { getSession } from "@/lib/auth";
import { getCompanyProfile } from "@/lib/company";

export default async function InvoiceTemplatesSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== Role.SUPER_ADMIN) redirect("/dashboard");

  const company = await getCompanyProfile();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-[var(--muted)]">
          <Link href="/dashboard/settings" className="underline-offset-2 hover:underline">
            Settings
          </Link>
          <span aria-hidden="true"> · </span>
          Invoice Templates
        </p>
        <h2 className="brand-display text-3xl">Invoice Templates</h2>
        <p className="text-[var(--muted)]">
          Choose the default PDF layout used when printing sales invoices and purchase bills.
        </p>
      </div>

      <InvoiceTemplatesStudio
        initialInvoice={company.invoicePdfTemplate}
        initialPurchase={company.purchasePdfTemplate}
      />
    </div>
  );
}
