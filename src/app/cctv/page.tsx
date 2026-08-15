
import Link from "next/link";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { AppShell } from "@/components/AppShell";
import { canAccessCctv } from "@/lib/access";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function CctvPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canAccessCctv(session)) redirect("/dashboard");

  const branchFilter =
    session.role === Role.STAFF && session.branchId ? { branchId: session.branchId } : {};

  const [cameras, settings] = await Promise.all([
    prisma.camera.findMany({
      where: branchFilter,
      include: { branch: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.setting.findUnique({ where: { id: "global" } }),
  ]);

  const online = cameras.filter((c) => c.status === "online").length;
  const scopeLabel =
    session.role === Role.STAFF
      ? cameras[0]?.branch.name || "your branch"
      : "all branches";

  return (
    <AppShell
      title="CCTV Monitoring"
      role={session.role}
      userName={session.name}
      nav={[
        { href: "/choose-path", label: "Paths" },
        { href: "/dashboard", label: "Overview" },
        { href: "/dashboard/inventory", label: "Inventory" },
        { href: "/cctv", label: "CCTV" },
        { href: "/fleet", label: "Car Tracking" },
      ]}
      action={
        <a
          className="btn btn-primary"
          href={settings?.cctvLoginUrl || "https://example.com/cctv-login"}
          target="_blank"
          rel="noreferrer"
        >
          Open CCTV login
        </a>
      }
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-[var(--navy)]">Surveillance console</h2>
          <p className="text-[var(--muted)]">
            {online} online · {cameras.length - online} offline across {scopeLabel}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cameras.map((camera) => (
            <div key={camera.id} className="panel overflow-hidden">
              <div
                className="h-40 bg-cover bg-center"
                style={{
                  backgroundImage:
                    camera.status === "online"
                      ? "linear-gradient(180deg, rgba(0,0,0,.15), rgba(0,0,0,.65)), url('https://images.unsplash.com/photo-1557597774-9d273605dfa9?auto=format&fit=crop&w=800&q=80')"
                      : "linear-gradient(180deg, #1a1a1a, #0d0d0d)",
                }}
              />
              <div className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="brand-display text-xl">{camera.name}</h3>
                  <span
                    className={`text-xs uppercase tracking-wider ${
                      camera.status === "online" ? "text-[var(--success)]" : "text-[var(--danger)]"
                    }`}
                  >
                    {camera.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {camera.location} · {camera.branch.name}
                </p>
                {camera.streamUrl && (
                  <Link
                    href={camera.streamUrl}
                    target="_blank"
                    className="mt-3 inline-block text-sm text-[var(--gold-soft)]"
                  >
                    Open stream link
                  </Link>
                )}
              </div>
            </div>
          ))}
          {cameras.length === 0 && (
            <p className="text-sm text-[var(--muted)]">No cameras available for your branch.</p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
