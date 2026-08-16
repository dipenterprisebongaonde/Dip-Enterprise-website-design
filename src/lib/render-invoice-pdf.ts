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
import {
  buildGalleryInvoiceHtml,
  isGalleryTemplate,
} from "@/lib/invoice-html-gallery";
import { buildThermalInvoiceHtml } from "@/lib/invoice-thermal-html";
import { isInvoicePdfTemplate } from "@/lib/invoice-pdf-templates";

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

function isValidPdf(buffer: Buffer) {
  if (buffer.length < 200) return false;
  return buffer.subarray(0, 5).toString("utf8") === "%PDF-";
}

async function closeBrowserQuietly() {
  const pending = browserPromise;
  browserPromise = null;
  if (!pending) return;
  try {
    const browser = await pending;
    await browser.close().catch(() => undefined);
  } catch {
    /* already dead */
  }
}

async function launchBrowser() {
  const browser = await puppeteer.launch({
    executablePath: resolveChromePath(),
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--font-render-hinting=none",
      "--disable-gpu",
    ],
  });
  browser.on("disconnected", () => {
    if (browserPromise) browserPromise = null;
  });
  return browser;
}

async function getBrowser() {
  if (browserPromise) {
    try {
      const existing = await browserPromise;
      if (existing.connected) return existing;
    } catch {
      /* relaunch below */
    }
    browserPromise = null;
  }

  browserPromise = launchBrowser().catch((error) => {
    browserPromise = null;
    throw error;
  });
  return browserPromise;
}

export type InvoicePrintFormat = InvoicePdfTemplate | "a4";

export function parseInvoicePrintFormat(
  value: string | null,
  fallback: InvoicePdfTemplate = "thermal80",
): InvoicePrintFormat {
  if (value === "a4" || !value) return fallback;
  if (value === "80" || value === "thermal") return "thermal80";
  if (isInvoicePdfTemplate(value)) return value;
  return parseInvoicePdfTemplate(fallback);
}

export function thermalWidthForFormat(format: InvoicePrintFormat) {
  return format === "thermal80" ? (80 as const) : null;
}

export function isA4PrintFormat(format: InvoicePrintFormat) {
  return format !== "thermal80";
}

export async function buildInvoiceDocumentHtml(
  invoice: InvoiceDoc,
  format: InvoicePrintFormat = "thermal80",
  options?: { interactive?: boolean; autoprint?: boolean },
) {
  const profile = await getCompanyProfile();
  const base = companyFromProfile(profile, resolvePublicAssetPath(profile.logoUrl));
  const company = applyBranchBank(invoice.company || base || COMPANY, invoice.branchBank);
  const width = thermalWidthForFormat(format);
  if (width) {
    return buildThermalInvoiceHtml({ ...invoice, company }, company, width, options);
  }
  const style = format === "a4" ? "atelier" : format;
  if (isGalleryTemplate(style)) {
    return buildGalleryInvoiceHtml({ ...invoice, company }, company, style);
  }
  return buildGalleryInvoiceHtml({ ...invoice, company }, company, "atelier");
}

async function waitForFonts(page: Awaited<ReturnType<Browser["newPage"]>>) {
  await page.evaluate(async () => {
    try {
      if (document.fonts?.ready) await document.fonts.ready;
    } catch {
      /* ignore */
    }
  });
  await new Promise((r) => setTimeout(r, 120));
}

async function renderInvoicePdfOnce(
  html: string,
  format: InvoicePrintFormat,
): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.emulateMediaType("print");

    if (isA4PrintFormat(format)) {
      await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });
      await page.setContent(html, { waitUntil: "load", timeout: 30_000 });
      await waitForFonts(page);
      // Prefer explicit A4 sizing over preferCSSPageSize — the latter can yield
      // blank pages in headless Chrome when @page margins conflict with layout.
      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        preferCSSPageSize: false,
        margin: { top: "0", right: "0", bottom: "0", left: "0" },
      });
      return Buffer.from(pdf);
    }

    const widthMm = 80;
    const widthPx = Math.round((widthMm / 25.4) * 96);
    await page.setViewport({ width: widthPx, height: 1600, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: "load", timeout: 30_000 });
    await waitForFonts(page);
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
      // Side padding lives in the receipt CSS (≥3mm); keep PDF margins at 0.
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => undefined);
  }
}

export async function renderInvoicePdf(
  invoice: InvoiceDoc,
  format: InvoicePrintFormat = "thermal80",
): Promise<Buffer> {
  const html = await buildInvoiceDocumentHtml(invoice, format, { interactive: false });

  const attempt = async () => {
    const buffer = await renderInvoicePdfOnce(html, format);
    if (!isValidPdf(buffer)) {
      throw new Error("PDF renderer returned an empty or invalid document");
    }
    return buffer;
  };

  try {
    return await attempt();
  } catch (error) {
    // Fresh browser for disconnects and one-shot empty/invalid PDF flakiness.
    console.error("invoice pdf attempt failed; retrying", error);
    await closeBrowserQuietly();
    return attempt();
  }
}
