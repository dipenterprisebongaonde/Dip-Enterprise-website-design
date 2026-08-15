import { NextResponse } from "next/server";
import { z } from "zod";
import { requestPhoneOtp } from "@/lib/phone-auth";

const schema = z.object({
  phone: z.string().min(8).max(20),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });
    }

    const result = await requestPhoneOtp(parsed.data.phone);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("send-otp failed", error);
    return NextResponse.json({ error: "Could not send code. Try again." }, { status: 500 });
  }
}
