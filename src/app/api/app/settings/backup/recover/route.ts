
import { NextResponse } from "next/server";
import { z } from "zod";
import { canBackupOperationalData } from "@/lib/access";
import { getSession } from "@/lib/auth";
import {
  backupErrorMessage,
  parseOperationalBackup,
  recoverOperationalBackup,
} from "@/lib/operational-backup";

export const runtime = "nodejs";

const CONFIRM_PHRASE = "RECOVER";

const schema = z.object({
  confirm: z.string().trim(),
  backup: z.unknown(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canBackupOperationalData(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = schema.parse(await request.json());
    if (body.confirm !== CONFIRM_PHRASE) {
      return NextResponse.json(
        { error: `Type ${CONFIRM_PHRASE} to confirm recover.` },
        { status: 400 }
      );
    }

    const backup = parseOperationalBackup(body.backup);
    const restored = await recoverOperationalBackup(backup);
    return NextResponse.json({ ok: true, restored });
  } catch (error) {
    return NextResponse.json({ error: backupErrorMessage(error) }, { status: 400 });
  }
}
