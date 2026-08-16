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

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const ten = Math.floor(n / 10);
  const one = n % 10;
  return `${TENS[ten]}${one ? ` ${ONES[one]}` : ""}`.trim();
}

function threeDigits(n: number): string {
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundred) parts.push(`${ONES[hundred]} Hundred`);
  if (rest) parts.push(twoDigits(rest));
  return parts.join(" ");
}

/** Indian numbering: Crore / Lakh / Thousand. */
export function amountInWords(value: number) {
  const abs = Math.abs(Number(value) || 0);
  const rupees = Math.floor(abs + 1e-9);
  const paise = Math.round((abs - rupees) * 100);

  if (rupees === 0 && paise === 0) return "INR Zero Rupees Only";

  const parts: string[] = [];
  let n = rupees;

  const crore = Math.floor(n / 1_00_00_000);
  n %= 1_00_00_000;
  const lakh = Math.floor(n / 1_00_000);
  n %= 1_00_000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;

  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (n) parts.push(threeDigits(n));

  let text = `INR ${parts.join(" ")} Rupees`;
  if (paise > 0) text += ` and ${twoDigits(paise)} Paise`;
  text += " Only";
  return text.replace(/\s+/g, " ").trim();
}

/** Plain words for templates that wrap with "Indian Rupees … Only". */
export function amountWordsPlain(value: number) {
  return amountInWords(value)
    .replace(/^INR\s*/i, "")
    .replace(/\bRupees\b/i, "")
    .replace(/\s*Only$/i, "")
    .replace(/\s+/g, " ")
    .trim();
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
