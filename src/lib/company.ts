import { prisma } from "@/lib/prisma";

export type InvoicePdfTemplate = "tally" | "flipkart" | "thermal80" | "thermal58";

export type CompanyProfile = {
  companyName: string;
  legalName: string;
  address: string;
  phone: string;
  email: string;
  enableGst: boolean;
  gstin: string;
  gstPercent: number;
  logoUrl: string;
  bankName: string;
  accountNo: string;
  ifsc: string;
  bankBranch: string;
  upi: string;
  companyMotto: string;
  platformName: string;
  invoicePdfTemplate: InvoicePdfTemplate;
  purchasePdfTemplate: InvoicePdfTemplate;
};

export const DEFAULT_COMPANY: CompanyProfile = {
  companyName: "DIP ENTERPRISE",
  legalName: "DIP Enterprise Cloud",
  address: "Bongaon, West Bengal, India",
  phone: "+91 90000 00000",
  email: "dipenterprise.bongaon.de@gmail.com",
  enableGst: false,
  gstin: "",
  gstPercent: 18,
  logoUrl: "/logo.png",
  bankName: "State Bank of India",
  accountNo: "XXXXXX4521",
  ifsc: "SBIN0001234",
  bankBranch: "Bongaon",
  upi: "dipenterprise@upi",
  companyMotto: "Secure. Track. Operate.",
  platformName: "DIP Enterprise Cloud",
  invoicePdfTemplate: "tally",
  purchasePdfTemplate: "tally",
};

export function parseInvoicePdfTemplate(value: unknown): InvoicePdfTemplate {
  if (value === "flipkart") return "flipkart";
  if (value === "thermal80" || value === "80" || value === "thermal") return "thermal80";
  if (value === "thermal58" || value === "58") return "thermal58";
  return "tally";
}

export async function getCompanyProfile(): Promise<CompanyProfile> {
  const setting = await prisma.setting.upsert({
    where: { id: "global" },
    update: {},
    create: {
      id: "global",
      cctvLoginUrl: "https://example.com/cctv-login",
      ...DEFAULT_COMPANY,
    },
  });

  return {
    companyName: setting.companyName || DEFAULT_COMPANY.companyName,
    legalName: setting.legalName || DEFAULT_COMPANY.legalName,
    address: setting.address || DEFAULT_COMPANY.address,
    phone: setting.phone || DEFAULT_COMPANY.phone,
    email: setting.email || DEFAULT_COMPANY.email,
    enableGst: Boolean(setting.enableGst),
    gstin: setting.gstin || "",
    gstPercent:
      typeof setting.gstPercent === "number" && Number.isFinite(setting.gstPercent)
        ? setting.gstPercent
        : DEFAULT_COMPANY.gstPercent,
    logoUrl: setting.logoUrl || DEFAULT_COMPANY.logoUrl,
    bankName: setting.bankName || DEFAULT_COMPANY.bankName,
    accountNo: setting.accountNo || DEFAULT_COMPANY.accountNo,
    ifsc: setting.ifsc || DEFAULT_COMPANY.ifsc,
    bankBranch: setting.bankBranch || DEFAULT_COMPANY.bankBranch,
    upi: setting.upi || DEFAULT_COMPANY.upi,
    companyMotto: setting.companyMotto || DEFAULT_COMPANY.companyMotto,
    platformName: setting.platformName || DEFAULT_COMPANY.platformName,
    invoicePdfTemplate: parseInvoicePdfTemplate(setting.invoicePdfTemplate),
    purchasePdfTemplate: parseInvoicePdfTemplate(setting.purchasePdfTemplate),
  };
}

/** Absolute filesystem path for a public logo URL (for PDF rendering). */
export function resolvePublicAssetPath(url: string) {
  const clean = (url || "/logo.png").split("?")[0];
  const relative = clean.startsWith("/") ? clean.slice(1) : clean;
  return `${process.cwd()}/public/${relative}`;
}
