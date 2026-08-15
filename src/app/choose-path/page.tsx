
import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, LayoutDashboard, MapPinned, Shield, Video } from "lucide-react";
import { BranchFocusLink } from "@/components/BranchFocusLink";
import { ThemeToggle } from "@/components/ThemeToggle";
import { canAccessPathChooser } from "@/lib/access";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ChoosePathPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canAccessPathChooser(session)) redirect("/dashboard");

  const branches = await prisma.branch.findMany({ orderBy: { name: "asc" } });

  const paths = [
    {
      href: "/dashboard",
      title: "Company Dashboard",
      copy: "Sales, purchases, inventory, vendors, customers, and users across branches.",
      icon: LayoutDashboard,
      tone: "ops",
      step: "01",
    },
    {
      href: "/cctv",
      title: "CCTV Monitoring",
      copy: "Camera status by branch with quick access to the surveillance console.",
      icon: Video,
      tone: "watch",
      step: "02",
    },
    {
      href: "/fleet",
      title: "Car Tracking",
      copy: "Live vehicle status, driver assignment, and historical route points.",
      icon: MapPinned,
      tone: "fleet",
      step: "03",
    },
  ] as const;

  return (
    <div className="path-stage">
      <div className="path-orb path-orb-a" aria-hidden />
      <div className="path-orb path-orb-b" aria-hidden />
      <div className="path-grid" aria-hidden />

      <div className="path-topbar">
        <Link href="/dashboard" className="path-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="DIP Enterprise" />
          <div>
            <strong>DIP ENTERPRISE</strong>
            <span>Cloud operations suite</span>
          </div>
        </Link>
        <div className="path-topbar-actions">
          <span className="path-session">
            <Shield size={14} />
            Super Admin
          </span>
          <ThemeToggle />
        </div>
      </div>

      <main className="path-main">
        <header className="path-hero">
          <p className="path-kicker">DIP Enterprise Cloud</p>
          <h1 className="brand-display">Choose your path</h1>
          <p className="path-lead">
            Open a company module, or lock the workspace to one branch region.
          </p>
        </header>

        <section className="path-modules" aria-label="Modules">
          {paths.map((path, index) => {
            const Icon = path.icon;
            return (
              <Link
                key={path.href}
                href={path.href}
                className={`path-module tone-${path.tone}`}
                style={{ animationDelay: `${120 + index * 90}ms` }}
              >
                <div className="path-module-top">
                  <span className="path-module-step">{path.step}</span>
                  <span className="path-module-icon">
                    <Icon size={22} />
                  </span>
                </div>
                <h2>{path.title}</h2>
                <p>{path.copy}</p>
                <span className="path-module-cta">Enter module</span>
              </Link>
            );
          })}
        </section>

        <section className="path-branches" aria-label="Branch focus">
          <div className="path-branches-head">
            <div>
              <p className="path-kicker">
                <Building2 size={14} />
                Branch focus
              </p>
              <h2>Open a region workspace</h2>
              <p>
                Sales, purchases, inventory, expenses, and bank details for that branch only.
              </p>
            </div>
            <span className="path-branch-count">
              {branches.length} branch{branches.length === 1 ? "" : "es"}
            </span>
          </div>

          <div className="path-branch-grid">
            {branches.map((branch, index) => (
              <BranchFocusLink
                key={branch.id}
                branchId={branch.id}
                name={branch.name}
                region={branch.region}
                index={index}
              />
            ))}
            {branches.length === 0 ? (
              <p className="path-empty">No branches yet. Create one from Branches.</p>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}
