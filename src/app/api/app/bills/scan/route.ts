import { NextResponse } from "next/server";
import { getActiveBranchRecord } from "@/lib/active-branch";
import { getSession } from "@/lib/auth";
import {
  BILL_SCAN_MAX_BYTES,
  aiProvidersConfigured,
  scanBillFile,
} from "@/lib/bill-scan";

export const runtime = "nodejs";

const ALLOWED = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "application/pdf",
]);

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    aiConfigured: aiProvidersConfigured(),
    accept: ["image/png", "image/jpeg", "image/webp", "application/pdf"],
    maxBytes: BILL_SCAN_MAX_BYTES,
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const form = await request.formData();
    const file = form.get("file");
    const preferredModeRaw = String(form.get("mode") || "purchase").toLowerCase();
    const preferredMode =
      preferredModeRaw === "sale" ? ("sale" as const) : ("purchase" as const);

    if (!(file instanceof File) || file.size <= 0) {
      return NextResponse.json({ error: "Upload a bill image or PDF." }, { status: 400 });
    }
    if (file.size > BILL_SCAN_MAX_BYTES) {
      return NextResponse.json(
        { error: "File too large. Max 10 MB for AI bill scan." },
        { status: 400 },
      );
    }

    const mimeType = (file.type || "").toLowerCase() || "application/octet-stream";
    if (!ALLOWED.has(mimeType)) {
      return NextResponse.json(
        { error: "Use PNG, JPG, WEBP, or PDF." },
        { status: 400 },
      );
    }

    const { branch } = await getActiveBranchRecord(session);
    const buffer = Buffer.from(await file.arrayBuffer());
    const draft = await scanBillFile({
      buffer,
      mimeType,
      fileName: file.name,
      preferredMode,
      branchId: branch?.id || session.branchId || null,
    });

    return NextResponse.json({ draft });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "AI_NOT_CONFIGURED") {
      return NextResponse.json(
        {
          error:
            "AI bill scan needs GEMINI_API_KEY (or OPENAI_API_KEY) in the server environment. PDF text bills can still be parsed without a key.",
          code,
        },
        { status: 503 },
      );
    }
    if (code === "EXTRACT_FAILED") {
      return NextResponse.json(
        { error: "Could not read this bill. Try a clearer photo or PDF.", code },
        { status: 422 },
      );
    }
    console.error("Bill scan failed", error);
    return NextResponse.json({ error: "Could not scan bill." }, { status: 400 });
  }
}
