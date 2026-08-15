
import fs from "node:fs";
import puppeteer, { type Browser } from "puppeteer-core";
import { getCompanyProfile, resolvePublicAssetPath } from "@/lib/company";
import {
  COMPANY,
  InvoiceDoc,
  applyBranchBank,
  companyFromProfile,
} from "@/lib/invoice";
import { buildInvoiceHtml } from "@/lib/invoice-html";
import {
  ThermalWidth,
  buildThermalInvoiceHtml,
} from "@/lib/invoice-thermal-html";

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

export type InvoicePrintFormat = "a4" | "thermal58" | "thermal80";

export function parseInvoicePrintFormat(value: string | null): InvoicePrintFormat {
  if (value === "thermal58" || value === "58") return "thermal58";
  if (value === "thermal80" || value === "80" || value === "thermal") return "thermal80";
  return "a4";
}

export function thermalWidthForFormat(format: InvoicePrintFormat): ThermalWidth | null {
  if (format === "thermal58") return 58;
  if (format === "thermal80") return 80;
  return null;
}

export async function buildInvoiceDocumentHtml(
  invoice: InvoiceDoc,
  format: InvoicePrintFormat = "a4",
  options?: { interactive?: boolean; autoprint?: boolean },
) {
  const profile = await getCompanyProfile();
  const base = companyFromProfile(profile, resolvePublicAssetPath(profile.logoUrl));
  const company = applyBranchBank(invoice.company || base || COMPANY, invoice.branchBank);
  const width = thermalWidthForFormat(format);
  if (width) {
    return buildThermalInvoiceHtml({ ...invoice, company }, company, width, options);
  }
  return buildInvoiceHtml({ ...invoice, company }, company);
}

export async function renderInvoicePdf(
  invoice: InvoiceDoc,
  format: InvoicePrintFormat = "a4",
): Promise<Buffer> {
  const html = await buildInvoiceDocumentHtml(invoice, format, { interactive: false });
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    if (format === "a4") {
      await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });
      await page.setContent(html, { waitUntil: "load" });
      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: "0", right: "0", bottom: "0", left: "0" },
      });
      return Buffer.from(pdf);
    }

    const widthMm = format === "thermal58" ? 58 : 80;
    const widthPx = Math.round((widthMm / 25.4) * 96);
    await page.setViewport({ width: widthPx, height: 1200, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: "load" });
    const height = await page.evaluate(() => {
      const el = document.querySelector(".receipt") as HTMLElement | null;
      const body = document.body;
      const h = Math.max(el?.scrollHeight || 0, body.scrollHeight || 0, 400);
      return Math.ceil(h + 24);
    });
    await page.setViewport({ width: widthPx, height, deviceScaleFactor: 2 });
    const pdf = await page.pdf({
      width: `${widthMm}mm`,
      height: `${Math.ceil((height / 96) * 25.4) + 4}mm`,
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: "1mm", right: "1mm", bottom: "1mm", left: "1mm" },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => undefined);
  }
}
