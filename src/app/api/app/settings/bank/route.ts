import { NextResponse } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { DEFAULT_COMPANY, getCompanyProfile } from "@/lib/company";
import { prisma } from "@/lib/prisma";

const bankSchema = z.object({
  bankName: z.string().trim().min(2).max(120),
  accountNo: z.string().trim().min(4).max(40),
  ifsc: z.string().trim().min(4).max(20),
  bankBranch: z.string().trim().min(2).max(80),
  upi: z.string().trim().min(3).max(80),
});

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== Role.SUPER_ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const data = bankSchema.parse(await request.json());

    await prisma.setting.upsert({
      where: { id: "global" },
      update: {
        bankName: data.bankName,
        accountNo: data.accountNo,
        ifsc: data.ifsc,
        bankBranch: data.bankBranch,
        upi: data.upi,
      },
      create: {
        id: "global",
        cctvLoginUrl: "https://example.com/cctv-login",
        logoUrl: DEFAULT_COMPANY.logoUrl,
        bankName: data.bankName,
        accountNo: data.accountNo,
        ifsc: data.ifsc,
        bankBranch: data.bankBranch,
        upi: data.upi,
      },
    });

    const company = await getCompanyProfile();
    return NextResponse.json({
      bank: {
        bankName: company.bankName,
        accountNo: company.accountNo,
        ifsc: company.ifsc,
        bankBranch: company.bankBranch,
        upi: company.upi,
      },
      company,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Enter valid bank details." }, { status: 400 });
    }
    return NextResponse.json({ error: "Could not save default bank." }, { status: 400 });
  }
}
