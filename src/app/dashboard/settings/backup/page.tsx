import Link from "next/link";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { OperationalBackupCard } from "@/components/OperationalBackupCard";
import { OperationalResetCard } from "@/components/OperationalResetCard";
import { getSession } from "@/lib/auth";

export default async function BackupSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== Role.SUPER_ADMIN) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-[var(--muted)]">
          <Link href="/dashboard/settings" className="underline-offset-2 hover:underline">
            Settings
          </Link>
          <span aria-hidden="true"> · </span>
          Backup &amp; Reset
        </p>
        <h2 className="brand-display text-3xl">Backup &amp; Reset</h2>
        <p className="text-[var(--muted)]">
          Download an operational backup or reset transactional data while keeping settings.
        </p>
      </div>

      <OperationalBackupCard />
      <OperationalResetCard />
    </div>
  );
}
