
import { NextResponse } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { DEFAULT_COMPANY, getCompanyProfile, parseInvoicePdfTemplate, INVOICE_PDF_TEMPLATE_IDS } from "@/lib/company";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== Role.SUPER_ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const company = await getCompanyProfile();
  return NextResponse.json({ company });
}

const updateSchema = z
  .object({
    companyName: z.string().trim().min(2).max(120),
    legalName: z.string().trim().min(2).max(160),
    address: z.string().trim().min(4).max(400),
    phone: z.string().trim().min(6).max(40),
    email: z.string().trim().email().max(160),
    enableGst: z.boolean().optional().default(false),
    gstin: z.string().trim().max(30).optional().default(""),
    gstPercent: z.coerce.number().min(0).max(40).optional().default(18),
    companyMotto: z.string().trim().max(160).optional(),
    platformName: z.string().trim().max(120).optional(),
    bankName: z.string().trim().min(2).max(120),
    accountNo: z.string().trim().min(4).max(40),
    ifsc: z.string().trim().min(4).max(20),
    bankBranch: z.string().trim().min(2).max(80),
    upi: z.string().trim().min(3).max(80),
    invoicePdfTemplate: z.enum(INVOICE_PDF_TEMPLATE_IDS).optional(),
    purchasePdfTemplate: z.enum(INVOICE_PDF_TEMPLATE_IDS).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.enableGst && data.gstin.trim().length < 5) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["gstin"],
        message: "Enter GSTIN when GST is enabled.",
      });
    }
    if (data.enableGst && !(data.gstPercent > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["gstPercent"],
        message: "Enter GST percentage when GST is enabled.",
      });
    }
  });

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== Role.SUPER_ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const data = updateSchema.parse(await request.json());
    const enableGst = Boolean(data.enableGst);
    const gstin = data.gstin.trim();
    const gstPercent = Number(data.gstPercent.toFixed(2));
    const current = await getCompanyProfile();
    const invoicePdfTemplate = data.invoicePdfTemplate
      ? parseInvoicePdfTemplate(data.invoicePdfTemplate)
      : current.invoicePdfTemplate;
    const purchasePdfTemplate = data.purchasePdfTemplate
      ? parseInvoicePdfTemplate(data.purchasePdfTemplate)
      : current.purchasePdfTemplate;

    await prisma.setting.upsert({
      where: { id: "global" },
      update: {
        companyName: data.companyName,
        legalName: data.legalName,
        address: data.address,
        phone: data.phone,
        email: data.email,
        enableGst,
        gstin,
        gstPercent,
        companyMotto: data.companyMotto || DEFAULT_COMPANY.companyMotto,
        platformName: data.platformName || DEFAULT_COMPANY.platformName,
        bankName: data.bankName,
        accountNo: data.accountNo,
        ifsc: data.ifsc,
        bankBranch: data.bankBranch,
        upi: data.upi,
        invoicePdfTemplate,
        purchasePdfTemplate,
      },
      create: {
        id: "global",
        cctvLoginUrl: "https://example.com/cctv-login",
        logoUrl: DEFAULT_COMPANY.logoUrl,
        companyName: data.companyName,
        legalName: data.legalName,
        address: data.address,
        phone: data.phone,
        email: data.email,
        enableGst,
        gstin,
        gstPercent,
        companyMotto: data.companyMotto || DEFAULT_COMPANY.companyMotto,
        platformName: data.platformName || DEFAULT_COMPANY.platformName,
        bankName: data.bankName,
        accountNo: data.accountNo,
        ifsc: data.ifsc,
        bankBranch: data.bankBranch,
        upi: data.upi,
        invoicePdfTemplate,
        purchasePdfTemplate,
      },
    });

    const company = await getCompanyProfile();
    return NextResponse.json({ company });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const gstIssue = error.issues.find(
        (issue) => issue.path.includes("gstin") || issue.path.includes("gstPercent")
      );
      return NextResponse.json(
        { error: gstIssue?.message || "Invalid company details." },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Could not save company settings." }, { status: 400 });
  }
}
