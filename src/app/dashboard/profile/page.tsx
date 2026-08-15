
import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/ProfileForm";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    include: { branch: true },
  });
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[var(--navy)]">My profile</h2>
        <p className="text-[var(--muted)]">
          Update your name, contact details, and password for this account.
        </p>
      </div>

      <ProfileForm
        user={{
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          hasPassword: Boolean(user.passwordHash),
          authProvider: user.authProvider,
          branch: user.branch
            ? { id: user.branch.id, name: user.branch.name, region: user.branch.region }
            : null,
        }}
      />
    </div>
  );
}
