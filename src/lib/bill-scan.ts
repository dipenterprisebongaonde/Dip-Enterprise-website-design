import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import type { BillScanDraft } from "@/lib/bill-scan-types";
import { prisma } from "@/lib/prisma";
import { roundMoney } from "@/lib/payments";

export type { BillScanDraft } from "@/lib/bill-scan-types";

export const BILL_SCAN_ACCEPT =
  "image/png,image/jpeg,image/jpg,image/webp,application/pdf";
export const BILL_SCAN_MAX_BYTES = 10 * 1024 * 1024;

const extractedSchema = z.object({
  docType: z.enum(["purchase", "sale"]).optional().default("purchase"),
  invoiceNo: z.string().optional().nullable(),
  invoiceDate: z.string().optional().nullable(),
  partyName: z.string().optional().nullable(),
  paymentStatus: z.enum(["PAID", "UNPAID", "PARTIAL"]).optional().nullable(),
  paidAmount: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
  lines: z
    .array(
      z.object({
        item: z.string(),
        quantity: z.number().positive().optional().default(1),
        unitPrice: z.number().nonnegative().optional().default(0),
        amount: z.number().nonnegative().optional(),
      }),
    )
    .optional()
    .default([]),
  charges: z
    .array(
      z.object({
        label: z.string(),
        amount: z.number(),
      }),
    )
    .optional()
    .default([]),
});

export type ExtractedBill = z.infer<typeof extractedSchema>;

// BillScanDraft type lives in bill-scan-types.ts (client-safe).

const EXTRACT_PROMPT = `You extract structured data from Indian business invoices/bills/receipts.
Return ONLY valid JSON (no markdown) matching this shape:
{
  "docType": "purchase" | "sale",
  "invoiceNo": string|null,
  "invoiceDate": "YYYY-MM-DD"|null,
  "partyName": string|null,
  "paymentStatus": "PAID"|"UNPAID"|"PARTIAL"|null,
  "paidAmount": number|null,
  "notes": string|null,
  "lines": [{"item": string, "quantity": number, "unitPrice": number, "amount": number}],
  "charges": [{"label": string, "amount": number}]
}
Rules:
- Prefer purchase when the document is a supplier bill/purchase invoice.
- Prefer sale when it is clearly a tax invoice issued to a customer.
- partyName = supplier/vendor for purchase, customer/buyer for sale.
- Convert dates to YYYY-MM-DD.
- Quantities and money as numbers (no currency symbols).
- If unitPrice missing but amount+qty exist, derive unitPrice = amount/qty.
- Ignore company letterhead of the seller when guessing party for purchase (party is the vendor on a purchase bill).
- If unsure, still return best-effort fields and empty arrays rather than inventing items.`;

function normalizeDate(value?: string | null) {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const dmy = trimmed.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (dmy) {
    const day = dmy[1].padStart(2, "0");
    const month = dmy[2].padStart(2, "0");
    let year = dmy[3];
    if (year.length === 2) year = Number(year) > 50 ? `19${year}` : `20${year}`;
    return `${year}-${month}-${day}`;
  }
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return undefined;
}

function normalizeLines(lines: ExtractedBill["lines"]) {
  return (lines || [])
    .map((line) => {
      const quantity = Math.max(0.01, Number(line.quantity) || 1);
      let unitPrice = Number(line.unitPrice);
      if (!(unitPrice >= 0) && line.amount != null) {
        unitPrice = roundMoney(Number(line.amount) / quantity);
      }
      if (!(unitPrice >= 0)) unitPrice = 0;
      const item = String(line.item || "").trim();
      if (!item) return null;
      return {
        item,
        quantity: roundMoney(quantity),
        gross: roundMoney(quantity),
        unitPrice: roundMoney(unitPrice),
      };
    })
    .filter(Boolean) as BillScanDraft["lines"];
}

function normalizeCharges(charges: ExtractedBill["charges"]) {
  return (charges || [])
    .map((charge) => ({
      label: String(charge.label || "").trim(),
      amount: roundMoney(Number(charge.amount) || 0),
    }))
    .filter((c) => c.label && c.amount !== 0);
}

function stripJsonFence(text: string) {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

async function matchParty(
  mode: "purchase" | "sale",
  partyName: string | undefined,
  branchId?: string | null,
) {
  if (!partyName?.trim()) return null;
  const needle = partyName.trim().toLowerCase();
  if (mode === "purchase") {
    const vendors = await prisma.vendor.findMany({
      where: branchId ? { branchId } : undefined,
      select: { id: true, name: true },
      take: 200,
    });
    const exact = vendors.find((v) => v.name.trim().toLowerCase() === needle);
    if (exact) return exact.id;
    const partial = vendors.find(
      (v) =>
        v.name.trim().toLowerCase().includes(needle) ||
        needle.includes(v.name.trim().toLowerCase()),
    );
    return partial?.id || null;
  }
  const customers = await prisma.customer.findMany({
    where: branchId ? { branchId } : undefined,
    select: { id: true, name: true },
    take: 200,
  });
  const exact = customers.find((c) => c.name.trim().toLowerCase() === needle);
  if (exact) return exact.id;
  const partial = customers.find(
    (c) =>
      c.name.trim().toLowerCase().includes(needle) ||
      needle.includes(c.name.trim().toLowerCase()),
  );
  return partial?.id || null;
}

export async function buildBillDraft(
  extracted: ExtractedBill,
  options: {
    preferredMode?: "purchase" | "sale";
    branchId?: string | null;
    provider: string;
    sourceFileName?: string;
    confidence?: BillScanDraft["confidence"];
  },
): Promise<BillScanDraft> {
  const mode = options.preferredMode || extracted.docType || "purchase";
  const lines = normalizeLines(extracted.lines);
  const charges = normalizeCharges(extracted.charges);
  const partyName = extracted.partyName?.trim() || undefined;
  const partyId = await matchParty(mode, partyName, options.branchId);

  const draft: BillScanDraft = {
    mode,
    invoiceNo: extracted.invoiceNo?.trim() || undefined,
    invoiceDate: normalizeDate(extracted.invoiceDate),
    partyName,
    vendorId: mode === "purchase" ? partyId : null,
    customerId: mode === "sale" ? partyId : null,
    paymentStatus: extracted.paymentStatus || "UNPAID",
    paidAmount:
      extracted.paidAmount != null ? roundMoney(Number(extracted.paidAmount)) : undefined,
    notes: extracted.notes?.trim() || undefined,
    lines: lines.length ? lines : [{ item: "", quantity: 1, gross: 1, unitPrice: 0 }],
    charges,
    applyRoundOff: false,
    confidence: options.confidence || (lines.length ? "medium" : "low"),
    provider: options.provider,
    sourceFileName: options.sourceFileName,
  };
  return draft;
}

async function extractWithGemini(buffer: Buffer, mimeType: string) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) return null;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
  });

  const result = await model.generateContent([
    { text: EXTRACT_PROMPT },
    {
      inlineData: {
        mimeType,
        data: buffer.toString("base64"),
      },
    },
  ]);
  const text = stripJsonFence(result.response.text() || "");
  const parsed = extractedSchema.parse(JSON.parse(text));
  return { parsed, provider: "gemini" as const };
}

async function extractWithOpenAI(buffer: Buffer, mimeType: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  if (mimeType === "application/pdf") {
    // OpenAI vision path expects images; skip PDF here.
    return null;
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_VISION_MODEL || "gpt-4o-mini",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: EXTRACT_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract the invoice fields from this bill image." },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${buffer.toString("base64")}`,
              },
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OPENAI_FAILED:${res.status}:${errText.slice(0, 180)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = stripJsonFence(data.choices?.[0]?.message?.content || "");
  const parsed = extractedSchema.parse(JSON.parse(text));
  return { parsed, provider: "openai" as const };
}

function heuristicFromText(text: string): ExtractedBill {
  const cleaned = text.replace(/\r/g, "\n");
  const invoiceNo =
    cleaned.match(
      /(?:invoice|bill|inv|pur)[\s#.No:-]*([A-Z0-9][A-Z0-9\/\-]{2,})/i,
    )?.[1] || null;
  const dateRaw =
    cleaned.match(
      /(?:date|dated)[:\s]*([0-9]{1,2}[\/\-.][0-9]{1,2}[\/\-.][0-9]{2,4}|[0-9]{4}-[0-9]{2}-[0-9]{2})/i,
    )?.[1] || null;

  const partyName =
    cleaned.match(/(?:vendor|supplier|seller|from|bill\s*from)[:\s]+([A-Za-z0-9 &.'-]{3,60})/i)?.[1] ||
    cleaned.match(/(?:customer|buyer|bill\s*to)[:\s]+([A-Za-z0-9 &.'-]{3,60})/i)?.[1] ||
    null;

  const lines: ExtractedBill["lines"] = [];
  const lineMatches = cleaned.matchAll(
    /^(.{3,60}?)\s+(\d+(?:\.\d+)?)\s+(?:x\s*)?(?:₹|Rs\.?\s*)?(\d+(?:\.\d+)?)\s+(?:₹|Rs\.?\s*)?(\d+(?:\.\d+)?)\s*$/gim,
  );
  for (const match of lineMatches) {
    lines.push({
      item: match[1].trim(),
      quantity: Number(match[2]),
      unitPrice: Number(match[3]),
      amount: Number(match[4]),
    });
    if (lines.length >= 20) break;
  }

  if (!lines.length) {
    const amountMatch = cleaned.match(
      /(?:grand\s*total|total\s*amount|net\s*amount|total)[:\s]*(?:₹|Rs\.?\s*)?([0-9,]+(?:\.\d{1,2})?)/i,
    );
    if (amountMatch) {
      const amount = Number(amountMatch[1].replace(/,/g, ""));
      if (amount > 0) {
        lines.push({
          item: "Bill total (review)",
          quantity: 1,
          unitPrice: amount,
          amount,
        });
      }
    }
  }

  return {
    docType: /tax\s*invoice|sold\s*to|customer/i.test(cleaned) ? "sale" : "purchase",
    invoiceNo,
    invoiceDate: dateRaw,
    partyName,
    paymentStatus: /paid/i.test(cleaned) ? "PAID" : "UNPAID",
    paidAmount: null,
    notes: "Parsed from PDF text — please review before saving.",
    lines,
    charges: [],
  };
}

async function extractFromPdfText(buffer: Buffer) {
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    const text = result.text || "";
    try {
      await parser.destroy();
    } catch {
      /* ignore */
    }
    if (text.trim().length < 20) return null;
    return {
      parsed: heuristicFromText(text),
      provider: "pdf-text" as const,
      confidence: "low" as const,
    };
  } catch {
    return null;
  }
}

export function aiProvidersConfigured() {
  return Boolean(
    process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      process.env.OPENAI_API_KEY,
  );
}

export async function scanBillFile(options: {
  buffer: Buffer;
  mimeType: string;
  fileName?: string;
  preferredMode?: "purchase" | "sale";
  branchId?: string | null;
}): Promise<BillScanDraft> {
  const mime = options.mimeType.toLowerCase();
  let extracted:
    | { parsed: ExtractedBill; provider: string; confidence?: BillScanDraft["confidence"] }
    | null = null;

  try {
    extracted = await extractWithGemini(options.buffer, mime);
  } catch (error) {
    console.error("Gemini bill scan failed", error);
  }

  if (!extracted) {
    try {
      extracted = await extractWithOpenAI(options.buffer, mime);
    } catch (error) {
      console.error("OpenAI bill scan failed", error);
    }
  }

  if (!extracted && mime === "application/pdf") {
    extracted = await extractFromPdfText(options.buffer);
  }

  if (!extracted) {
    if (!aiProvidersConfigured()) {
      throw new Error("AI_NOT_CONFIGURED");
    }
    throw new Error("EXTRACT_FAILED");
  }

  return buildBillDraft(extracted.parsed, {
    preferredMode: options.preferredMode,
    branchId: options.branchId,
    provider: extracted.provider,
    sourceFileName: options.fileName,
    confidence: extracted.confidence || (extracted.provider === "pdf-text" ? "low" : "high"),
  });
}
