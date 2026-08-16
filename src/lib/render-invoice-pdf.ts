import fs from "node:fs";
import puppeteer, { type Browser } from "puppeteer-core";
import {
  getCompanyProfile,
  resolvePublicAssetPath,
  type InvoicePdfTemplate,
} from "@/lib/company";
import {
  COMPANY,
  InvoiceDoc,
  applyBranchBank,
  companyFromProfile,
} from "@/lib/invoice";
import { buildThermalInvoiceHtml } from "@/lib/invoice-thermal-html";

const CHROME_CANDIDATES = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  process.env.CHROME_PATH,
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
  "/usr/local/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean) as string[];

function resolveChromePath() {
  for (const candidate of CHROME_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(
    "Chrome/Chromium not found. Set PUPPETEER_EXECUTABLE_PATH to a Chrome binary."
  );
}

let browserPromise: Promise<Browser> | null = null;

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer
      .launch({
        executablePath: resolveChromePath(),
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--font-render-hinting=none",
        ],
      })
      .catch((error) => {
        browserPromise = null;
        throw error;
      });
  }
  return browserPromise;
}

export type InvoicePrintFormat = InvoicePdfTemplate;

export function parseInvoicePrintFormat(
  _value?: string | null,
  _fallback?: InvoicePdfTemplate,
): InvoicePrintFormat {
  return "thermal80";
}

export function thermalWidthForFormat(_format?: InvoicePrintFormat) {
  return 80 as const;
}

export function isA4PrintFormat(_format?: InvoicePrintFormat) {
  return false;
}

export async function buildInvoiceDocumentHtml(
  invoice: InvoiceDoc,
  _format: InvoicePrintFormat = "thermal80",
  options?: { interactive?: boolean; autoprint?: boolean },
) {
  const profile = await getCompanyProfile();
  const base = companyFromProfile(profile, resolvePublicAssetPath(profile.logoUrl));
  const company = applyBranchBank(invoice.company || base || COMPANY, invoice.branchBank);
  return buildThermalInvoiceHtml({ ...invoice, company }, company, 80, options);
}

export async function renderInvoicePdf(
  invoice: InvoiceDoc,
  format: InvoicePrintFormat = "thermal80",
): Promise<Buffer> {
  const html = await buildInvoiceDocumentHtml(invoice, format, { interactive: false });
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    const widthMm = 80;
    const widthPx = Math.round((widthMm / 25.4) * 96);
    await page.setViewport({ width: widthPx, height: 1600, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: "load", timeout: 30_000 });
    await page.evaluate(async () => {
      try {
        if (document.fonts?.ready) await document.fonts.ready;
      } catch {
        /* ignore */
      }
    });
    const heightPx = await page.evaluate(() => {
      const el = document.querySelector(".receipt") as HTMLElement | null;
      const body = document.body;
      const h = Math.max(el?.scrollHeight || 0, body.scrollHeight || 0, 320);
      return Math.ceil(h + 8);
    });
    await page.setViewport({ width: widthPx, height: heightPx, deviceScaleFactor: 2 });
    const heightMm = Math.max(40, Math.ceil((heightPx / 96) * 25.4) + 2);
    const pdf = await page.pdf({
      width: `${widthMm}mm`,
      height: `${heightMm}mm`,
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: "0.5mm", right: "0.5mm", bottom: "0.5mm", left: "0.5mm" },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => undefined);
  }
}
