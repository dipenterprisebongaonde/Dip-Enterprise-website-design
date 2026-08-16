import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const logoCache = new Map<string, string | null>();

function mimeForExt(ext: string) {
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".svg") return "image/svg+xml";
  return "image/png";
}

/**
 * Compact logo data-URI for PDF HTML.
 * Large logos are resized so invoice PDFs stay small and render quickly.
 */
export function logoDataUri(logoPath?: string, size = 96): string | null {
  if (!logoPath || !fs.existsSync(logoPath)) return null;
  try {
    return logoDataUriSync(logoPath, size);
  } catch {
    return null;
  }
}

function logoDataUriSync(logoPath: string, size: number): string | null {
  const key = `${logoPath}:${size}:${fs.statSync(logoPath).mtimeMs}`;
  if (logoCache.has(key)) return logoCache.get(key) || null;

  const raw = fs.readFileSync(logoPath);
  const ext = path.extname(logoPath).toLowerCase();

  if (raw.length <= 40_000 && [".png", ".jpg", ".jpeg", ".webp"].includes(ext)) {
    const uri = `data:${mimeForExt(ext)};base64,${raw.toString("base64")}`;
    logoCache.set(key, uri);
    return uri;
  }

  try {
    const tmp = path.join(
      "/tmp",
      `dip-pdf-logo-${Buffer.from(key).toString("hex").slice(0, 24)}.jpg`,
    );
    execFileSync(
      "ffmpeg",
      [
        "-y",
        "-i",
        logoPath,
        "-vf",
        `scale=${size}:${size}:force_original_aspect_ratio=decrease`,
        "-frames:v",
        "1",
        "-q:v",
        "4",
        tmp,
      ],
      { stdio: "ignore" },
    );
    if (fs.existsSync(tmp)) {
      const resized = fs.readFileSync(tmp);
      try {
        fs.unlinkSync(tmp);
      } catch {
        /* ignore */
      }
      const uri = `data:image/jpeg;base64,${resized.toString("base64")}`;
      logoCache.set(key, uri);
      return uri;
    }
  } catch {
    /* fall through */
  }

  const uri = `data:${mimeForExt(ext)};base64,${raw.toString("base64")}`;
  logoCache.set(key, uri);
  return uri;
}

/** Async logo helper using sharp when available (preferred for API routes). */
export async function logoDataUriAsync(
  logoPath?: string,
  size = 96,
): Promise<string | null> {
  if (!logoPath || !fs.existsSync(logoPath)) return null;
  try {
    const buffer = await sharp(logoPath)
      .resize(size, size, { fit: "inside", withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toBuffer();
    return `data:image/png;base64,${buffer.toString("base64")}`;
  } catch {
    return logoDataUri(logoPath, size);
  }
}

export function formatPdfAmount(value: number) {
  return value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
