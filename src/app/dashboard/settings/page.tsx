import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { SettingsMenu } from "@/components/SettingsMenu";
import { getSession } from "@/lib/auth";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== Role.SUPER_ADMIN) redirect("/dashboard");

  return (
    <div className="settings-home">
      <div>
        <h2 className="brand-display text-3xl">Settings</h2>
        <p className="text-[var(--muted)]">
          Company defaults stay here. Switch branch in the top bar to edit that branch bank
          account and scoped data.
        </p>
      </div>

      <SettingsMenu />
    </div>
  );
}
