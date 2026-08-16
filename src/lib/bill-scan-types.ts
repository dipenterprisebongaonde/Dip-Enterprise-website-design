export type BillScanDraft = {
  mode: "purchase" | "sale";
  invoiceNo?: string;
  invoiceDate?: string;
  partyName?: string;
  vendorId?: string | null;
  customerId?: string | null;
  paymentStatus?: "PAID" | "UNPAID" | "PARTIAL";
  paidAmount?: number;
  notes?: string;
  lines: Array<{ item: string; quantity: number; gross?: number; unitPrice: number }>;
  charges: Array<{ label: string; amount: number }>;
  applyRoundOff?: boolean;
  confidence: "high" | "medium" | "low";
  provider: string;
  sourceFileName?: string;
};

export const AI_BILL_DRAFT_KEY = "dip_ai_bill_draft";
