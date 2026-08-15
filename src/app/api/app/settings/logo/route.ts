
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { DEFAULT_COMPANY, getCompanyProfile } from "@/lib/company";
import { prisma } from "@/lib/prisma";

const ALLOWED = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== Role.SUPER_ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const form = await request.formData();
    const file = form.get("logo");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Choose a logo image to upload." }, { status: 400 });
    }

    const ext = ALLOWED.get(file.type);
    if (!ext) {
      return NextResponse.json(
        { error: "Logo must be a PNG, JPG, or WEBP image." },
        { status: 400 }
      );
    }

    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: "Logo must be under 2 MB." }, { status: 400 });
    }

    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadsDir, { recursive: true });

    const filename = `company-logo.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(uploadsDir, filename), buffer);

    const logoUrl = `/uploads/${filename}?v=${Date.now()}`;
    await prisma.setting.upsert({
      where: { id: "global" },
      update: { logoUrl },
      create: {
        id: "global",
        cctvLoginUrl: "https://example.com/cctv-login",
        ...DEFAULT_COMPANY,
        logoUrl,
      },
    });

    const company = await getCompanyProfile();
    return NextResponse.json({ company, logoUrl });
  } catch {
    return NextResponse.json({ error: "Could not upload logo." }, { status: 400 });
  }
}
