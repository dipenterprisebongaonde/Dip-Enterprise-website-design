import Link from "next/link";

const SETTINGS_LINKS = [
  {
    href: "/dashboard/settings#company-details",
    title: "Company Details",
    blurb: "Brand, GST, contact, and default bank",
    icon: "co",
  },
  {
    href: "/dashboard/settings/invoice-templates",
    title: "Invoice Templates",
    blurb: "Default PDF layouts for invoice and purchase prints",
    icon: "tpl",
  },
  {
    href: "/dashboard/settings#branch-bank",
    title: "Bank Details",
    blurb: "Active branch bank account for PDF footers",
    icon: "bank",
  },
  {
    href: "/dashboard/settings#ops-backup",
    title: "Backup & Reset",
    blurb: "Operational backup download and data reset",
    icon: "ops",
  },
] as const;

export function SettingsMenu() {
  return (
    <nav className="settings-menu" aria-label="Settings menu">
      {SETTINGS_LINKS.map((item) => (
        <Link key={item.href} href={item.href} className="settings-menu-item">
          <span className={`settings-menu-icon ${item.icon}`} aria-hidden="true" />
          <span className="settings-menu-copy">
            <strong>{item.title}</strong>
            <em>{item.blurb}</em>
          </span>
          <span className="settings-menu-chevron" aria-hidden="true">
            ›
          </span>
        </Link>
      ))}
    </nav>
  );
}
