import { randomBytes } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";

import { PAYMENT_PROOF_ACCEPT } from "@/lib/payment-proof";

export const PAYMENT_PROOF_ACCEPT_ATTR = PAYMENT_PROOF_ACCEPT;

const PROOF_ALLOWED = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
  ["application/pdf", "pdf"],
]);

const MAX_PROOF_BYTES = 8 * 1024 * 1024;

export type PaymentProofMeta = {
  proofUrl: string;
  proofFileName: string;
  proofMimeType: string;
};

export function paymentProofAcceptAttr() {
  return PAYMENT_PROOF_ACCEPT;
}

export async function savePaymentProof(
  file: File,
  prefix = "proof"
): Promise<PaymentProofMeta> {
  const ext = PROOF_ALLOWED.get(file.type);
  if (!ext) {
    throw new Error("PROOF_TYPE");
  }
  if (file.size <= 0) {
    throw new Error("PROOF_EMPTY");
  }
  if (file.size > MAX_PROOF_BYTES) {
    throw new Error("PROOF_SIZE");
  }

  const uploadsDir = path.join(process.cwd(), "public", "uploads", "payment-proofs");
  await mkdir(uploadsDir, { recursive: true });

  const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24) || "proof";
  const filename = `${safePrefix}-${Date.now()}-${randomBytes(4).toString("hex")}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadsDir, filename), buffer);

  const originalName = (file.name || `payment-proof.${ext}`).trim().slice(0, 180);

  return {
    proofUrl: `/api/app/payment-proofs/${filename}`,
    proofFileName: originalName || `payment-proof.${ext}`,
    proofMimeType: file.type,
  };
}

export function proofErrorMessage(code: string) {
  if (code === "PROOF_TYPE") {
    return "Payment proof must be a PNG, JPG, WEBP, GIF, or PDF file.";
  }
  if (code === "PROOF_SIZE") {
    return "Payment proof must be under 8 MB.";
  }
  if (code === "PROOF_EMPTY") {
    return "Choose a valid payment proof file.";
  }
  return "Could not upload payment proof.";
}

export async function parsePaymentRequest(request: Request): Promise<{
  amount: number;
  paidAt: string;
  note?: string;
  type?: string;
  paymentMethod?: string;
  settleFromAdvance?: boolean;
  proofFile: File | null;
}> {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const proof = form.get("proof");
    const noteRaw = String(form.get("note") || "").trim();
    const typeRaw = String(form.get("type") || "").trim();
    const methodRaw = String(form.get("paymentMethod") || "").trim();
    const settleRaw = String(form.get("settleFromAdvance") || "").trim().toLowerCase();
    return {
      amount: Number(form.get("amount")),
      paidAt: String(form.get("paidAt") || ""),
      note: noteRaw || undefined,
      type: typeRaw || undefined,
      paymentMethod: methodRaw || undefined,
      settleFromAdvance: settleRaw === "1" || settleRaw === "true" || settleRaw === "yes",
      proofFile: proof instanceof File && proof.size > 0 ? proof : null,
    };
  }

  const data = await request.json();
  return {
    amount: Number(data.amount),
    paidAt: String(data.paidAt || ""),
    note: data.note ? String(data.note) : undefined,
    type: data.type ? String(data.type) : undefined,
    paymentMethod: data.paymentMethod ? String(data.paymentMethod) : undefined,
    settleFromAdvance: Boolean(data.settleFromAdvance),
    proofFile: null,
  };
}

export function proofFilenameFromUrl(proofUrl?: string | null) {
  if (!proofUrl) return null;
  const match = proofUrl.match(/\/api\/app\/payment-proofs\/([a-zA-Z0-9._-]+)$/);
  return match?.[1] || null;
}

export async function deletePaymentProofFile(proofUrl?: string | null) {
  const filename = proofFilenameFromUrl(proofUrl);
  if (!filename) return;
  try {
    await unlink(path.join(process.cwd(), "public", "uploads", "payment-proofs", filename));
  } catch {
    // File may already be gone; clearing DB fields is enough.
  }
}

export async function parseInvoiceRequest(request: Request): Promise<{
  data: unknown;
  proofFile: File | null;
}> {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const raw = form.get("data");
    if (typeof raw !== "string" || !raw.trim()) {
      throw new Error("INVALID_INVOICE_PAYLOAD");
    }
    const proof = form.get("proof");
    return {
      data: JSON.parse(raw),
      proofFile: proof instanceof File && proof.size > 0 ? proof : null,
    };
  }

  return {
    data: await request.json(),
    proofFile: null,
  };
}
