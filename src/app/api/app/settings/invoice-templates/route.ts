import { NextResponse } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { getCompanyProfile, parseInvoicePdfTemplate } from "@/lib/company";
import { prisma } from "@/lib/prisma";

const templateSchema = z.object({
  invoicePdfTemplate: z.enum(["tally", "flipkart", "thermal80", "thermal58"]),
  purchasePdfTemplate: z.enum(["tally", "flipkart", "thermal80", "thermal58"]),
});

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== Role.SUPER_ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const data = templateSchema.parse(await request.json());
    const invoicePdfTemplate = parseInvoicePdfTemplate(data.invoicePdfTemplate);
    const purchasePdfTemplate = parseInvoicePdfTemplate(data.purchasePdfTemplate);

    await prisma.setting.upsert({
      where: { id: "global" },
      update: {
        invoicePdfTemplate,
        purchasePdfTemplate,
      },
      create: {
        id: "global",
        cctvLoginUrl: "https://example.com/cctv-login",
        invoicePdfTemplate,
        purchasePdfTemplate,
      },
    });

    const company = await getCompanyProfile();
    return NextResponse.json({ company });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid PDF template selection." }, { status: 400 });
    }
    return NextResponse.json({ error: "Could not save invoice templates." }, { status: 400 });
  }
}
