import fs from "node:fs";
import puppeteer, { type Browser } from "puppeteer-core";
import {
  getCompanyProfile,
  parseInvoicePdfTemplate,
  resolvePublicAssetPath,
  type InvoicePdfTemplate,
} from "@/lib/company";
import {
  COMPANY,
  InvoiceDoc,
  applyBranchBank,
  companyFromProfile,
} from "@/lib/invoice";
import { buildInvoiceHtml } from "@/lib/invoice-html";
import { buildFlipkartInvoiceHtml } from "@/lib/invoice-html-flipkart";
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

export type InvoicePrintFormat = "a4" | "tally" | "flipkart" | "thermal58" | "thermal80";

export function parseInvoicePrintFormat(
  value: string | null,
  fallbackA4: InvoicePdfTemplate = "tally",
): InvoicePrintFormat {
  if (value === "thermal58" || value === "58") return "thermal58";
  if (value === "thermal80" || value === "80" || value === "thermal") return "thermal80";
  if (value === "flipkart") return "flipkart";
  if (value === "tally") return "tally";
  if (value === "a4" || !value) return fallbackA4;
  return parseInvoicePdfTemplate(fallbackA4);
}

export function thermalWidthForFormat(format: InvoicePrintFormat): ThermalWidth | null {
  if (format === "thermal58") return 58;
  if (format === "thermal80") return 80;
  return null;
}

export function isA4PrintFormat(format: InvoicePrintFormat) {
  return format === "a4" || format === "tally" || format === "flipkart";
}

export async function buildInvoiceDocumentHtml(
  invoice: InvoiceDoc,
  format: InvoicePrintFormat = "tally",
  options?: { interactive?: boolean; autoprint?: boolean },
) {
  const profile = await getCompanyProfile();
  const base = companyFromProfile(profile, resolvePublicAssetPath(profile.logoUrl));
  const company = applyBranchBank(invoice.company || base || COMPANY, invoice.branchBank);
  const width = thermalWidthForFormat(format);
  if (width) {
    return buildThermalInvoiceHtml({ ...invoice, company }, company, width, options);
  }
  const style = format === "flipkart" ? "flipkart" : "tally";
  if (style === "flipkart") {
    return buildFlipkartInvoiceHtml({ ...invoice, company }, company);
  }
  return buildInvoiceHtml({ ...invoice, company }, company);
}

export async function renderInvoicePdf(
  invoice: InvoiceDoc,
  format: InvoicePrintFormat = "tally",
): Promise<Buffer> {
  const html = await buildInvoiceDocumentHtml(invoice, format, { interactive: false });
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    if (isA4PrintFormat(format)) {
      await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });
      await page.setContent(html, { waitUntil: "networkidle0", timeout: 30_000 }).catch(async () => {
        await page.setContent(html, { waitUntil: "load", timeout: 30_000 });
      });
      await page.evaluate(async () => {
        try {
          if (document.fonts?.ready) await document.fonts.ready;
        } catch {
          /* ignore */
        }
      });
      await new Promise((r) => setTimeout(r, 150));
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
