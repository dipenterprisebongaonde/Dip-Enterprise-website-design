import { CompanyProfile, DEFAULT_COMPANY } from "@/lib/company";

export type InvoiceLineDoc = {
  item: string;
  quantity: number;
  gross: number;
  unitPrice: number;
  amount: number;
};

export type InvoiceChargeDoc = {
  label: string;
  amount: number;
};

export type InvoiceCompany = {
  name: string;
  legalName: string;
  address: string;
  enableGst: boolean;
  gstin: string;
  gstPercent: number;
  phone: string;
  email: string;
  bankName: string;
  accountNo: string;
  ifsc: string;
  branch: string;
  upi: string;
  logoUrl?: string;
  logoPath?: string;
};

export type BranchBankDetails = {
  bankName?: string | null;
  accountNo?: string | null;
  ifsc?: string | null;
  bankBranch?: string | null;
  upi?: string | null;
};

export type InvoiceDoc = {
  type: "sale" | "purchase";
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalValue: number;
  roundOff?: number;
  paidAmount: number;
  dueAmount: number;
  paidAt?: string | null;
  paymentStatus: string;
  paymentMethod?: string | null;
  partyName: string;
  partyPhone?: string | null;
  partyAddress?: string | null;
  branchName: string;
  branchRegion: string;
  notes?: string | null;
  lines: InvoiceLineDoc[];
  charges?: InvoiceChargeDoc[];
  company?: InvoiceCompany;
  branchBank?: BranchBankDetails | null;
};

export function companyFromProfile(profile: CompanyProfile, logoPath?: string): InvoiceCompany {
  return {
    name: profile.companyName,
    legalName: profile.legalName,
    address: profile.address,
    enableGst: profile.enableGst,
    gstin: profile.gstin,
    gstPercent: profile.gstPercent,
    phone: profile.phone,
    email: profile.email,
    bankName: profile.bankName,
    accountNo: profile.accountNo,
    ifsc: profile.ifsc,
    branch: profile.bankBranch,
    upi: profile.upi,
    logoUrl: profile.logoUrl,
    logoPath,
  };
}

export function applyBranchBank(
  company: InvoiceCompany,
  branchBank?: BranchBankDetails | null
): InvoiceCompany {
  if (!branchBank) return company;
  return {
    ...company,
    bankName: branchBank.bankName?.trim() || company.bankName,
    accountNo: branchBank.accountNo?.trim() || company.accountNo,
    ifsc: branchBank.ifsc?.trim() || company.ifsc,
    branch: branchBank.bankBranch?.trim() || company.branch,
    upi: branchBank.upi?.trim() || company.upi,
  };
}

export const COMPANY: InvoiceCompany = companyFromProfile(DEFAULT_COMPANY);

export function formatINR(value: number) {
  return `₹${value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function amountInWords(value: number) {
  const rupees = Math.round(value);
  if (rupees === 0) return "INR Zero Rupees Only";
  return `INR ${rupees.toLocaleString("en-IN")} Rupees Only`;
}

export function gstRateFromPercent(percent?: number | null) {
  const value = typeof percent === "number" && Number.isFinite(percent) ? percent : 18;
  return Math.max(0, value) / 100;
}

export function taxableFromTotal(total: number, taxRate = 0.18, enabled = true) {
  if (!enabled) {
    return {
      taxable: Number(total.toFixed(2)),
      tax: 0,
      taxRate: 0,
    };
  }
  const taxable = total / (1 + taxRate);
  const tax = total - taxable;
  return {
    taxable: Number(taxable.toFixed(2)),
    tax: Number(tax.toFixed(2)),
    taxRate,
  };
}
