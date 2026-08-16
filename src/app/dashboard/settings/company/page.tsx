import Link from "next/link";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { CompanySettingsForm } from "@/components/CompanySettingsForm";
import { getSession } from "@/lib/auth";
import { getCompanyProfile } from "@/lib/company";

export default async function CompanySettingsPage() {
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
          Company Details
        </p>
        <h2 className="brand-display text-3xl">Company Details</h2>
        <p className="text-[var(--muted)]">
          Brand, GST, contact, and default bank used across invoices and the dashboard.
        </p>
      </div>

      <CompanySettingsForm initial={company} />
    </div>
  );
}
