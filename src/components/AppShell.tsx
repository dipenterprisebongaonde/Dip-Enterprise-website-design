"use client";

import Link from "next/link";
import { ArrowLeft, Bell, Search, Settings } from "lucide-react";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { BranchSwitcher } from "@/components/BranchSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserAccountMenu } from "@/components/UserAccountMenu";

type NavItem = { href: string; label: string };
type BranchOption = { id: string; name: string; region: string };

function resolvePage(pathname: string, nav: NavItem[]) {
  if (pathname.startsWith("/dashboard/profile")) {
    return { href: "/dashboard/profile", label: "Profile" };
  }

  const exact = nav.find((item) => item.href === pathname);
  if (exact) return exact;

  const nested = [...nav]
    .filter((item) => item.href !== "/dashboard")
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => pathname.startsWith(item.href));

  return nested || { href: pathname, label: "Overview" };
}

function resolveAction(pathname: string): { href: string; label: string } | null {
  if (pathname.startsWith("/dashboard/sales")) {
    return { href: "/dashboard/sales/new", label: "+ New invoice" };
  }
  if (pathname.startsWith("/dashboard/purchases")) {
    return { href: "/dashboard/purchases/new", label: "+ New bill" };
  }
  return null;
}

export function AppShell({
  title,
  role,
  userName,
  nav,
  action,
  backHref,
  children,
  companyName = "DIP ENTERPRISE",
  logoUrl = "/logo.png",
  companyMotto = "Cloud operations suite",
  branches = [],
  activeBranchId = null,
  activeBranchName = null,
  branchLocked = false,
}: {
  title?: string;
  role: string;
  userName: string;
  nav: NavItem[];
  action?: ReactNode;
  backHref?: string;
  children: ReactNode;
  companyName?: string;
  logoUrl?: string;
  companyMotto?: string;
  branches?: BranchOption[];
  activeBranchId?: string | null;
  activeBranchName?: string | null;
  branchLocked?: boolean;
}) {
  const pathname = usePathname();
  const page = resolvePage(pathname, nav);
  const pageTitle = title || page.label;
  const defaultAction = resolveAction(pathname);

  return (
    <div className="app-shell">
      <header className="app-topbar-card">
        <Link href="/dashboard" className="app-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} alt={companyName} />
          <div>
            <strong>{companyName}</strong>
            <span>{companyMotto}</span>
          </div>
        </Link>

        <nav className="app-pillnav" aria-label="Primary">
          <div className="app-pillnav-inner">
            {nav.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(`${item.href}`));
              return (
                <Link key={item.href} href={item.href} className={active ? "active" : undefined}>
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="app-utils">
          <ThemeToggle />
          <button className="util" type="button" aria-label="Search">
            <Search size={16} />
          </button>
          <button className="util" type="button" aria-label="Notifications">
            <Bell size={16} />
          </button>
          {role === "SUPER_ADMIN" ? (
            <Link className="util" href="/dashboard/settings" aria-label="Settings">
              <Settings size={16} />
            </Link>
          ) : (
            <Link className="util" href="/dashboard/profile" aria-label="Profile settings">
              <Settings size={16} />
            </Link>
          )}
          <UserAccountMenu userName={userName} role={role} />
        </div>
      </header>

      <div className="app-header-row">
        <div className="app-title-block">
          {backHref && (
            <Link href={backHref} className="back-btn" aria-label="Back">
              <ArrowLeft size={16} />
            </Link>
          )}
          <div>
            <h1>{pageTitle}</h1>
            <p>
              {userName} · {role === "SUPER_ADMIN" ? "Super Admin" : "Standard Staff"}
              {activeBranchName ? ` · ${activeBranchName}` : role === "SUPER_ADMIN" ? " · All branches" : ""}
            </p>
          </div>
        </div>
        <div className="app-header-actions">
          {action ||
            (defaultAction ? (
              <Link href={defaultAction.href} className="btn btn-primary">
                {defaultAction.label}
              </Link>
            ) : null)}
          {(role === "SUPER_ADMIN" || branchLocked) && branches.length > 0 ? (
            <BranchSwitcher
              branches={branches}
              activeBranchId={activeBranchId}
              locked={branchLocked}
            />
          ) : null}
        </div>
      </div>

      {children}
    </div>
  );
}
