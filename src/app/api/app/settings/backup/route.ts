
import { NextResponse } from "next/server";
import { canBackupOperationalData } from "@/lib/access";
import { getSession } from "@/lib/auth";
import { buildOperationalBackup } from "@/lib/operational-backup";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canBackupOperationalData(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const backup = await buildOperationalBackup();
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const filename = `dip-operational-backup-${stamp}.json`;

    return new NextResponse(JSON.stringify(backup, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Could not create backup." }, { status: 500 });
  }
}
