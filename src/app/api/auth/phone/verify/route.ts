import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyPhoneOtp } from "@/lib/phone-auth";

const schema = z.object({
  phone: z.string().min(8).max(20),
  code: z.string().min(4).max(8),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Enter phone and 6-digit code." }, { status: 400 });
    }

    const result = await verifyPhoneOtp(parsed.data.phone, parsed.data.code);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("verify phone otp failed", error);
    return NextResponse.json({ error: "Verification failed. Try again." }, { status: 500 });
  }
}
