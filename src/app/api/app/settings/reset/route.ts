
import { NextResponse } from "next/server";
import { z } from "zod";
import { canResetOperationalData } from "@/lib/access";
import { getSession } from "@/lib/auth";
import { resetOperationalData } from "@/lib/operational-reset";

export const runtime = "nodejs";

const CONFIRM_PHRASE = "RESET";

const schema = z.object({
  confirm: z.string().trim(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canResetOperationalData(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = schema.parse(await request.json());
    if (body.confirm !== CONFIRM_PHRASE) {
      return NextResponse.json(
        { error: `Type ${CONFIRM_PHRASE} to confirm reset.` },
        { status: 400 }
      );
    }

    const deleted = await resetOperationalData();
    return NextResponse.json({ ok: true, deleted });
  } catch {
    return NextResponse.json({ error: "Could not reset operational data." }, { status: 400 });
  }
}
