import { NextResponse } from "next/server";
import { googleOAuthConfigured } from "@/lib/google-auth";

export async function GET() {
  return NextResponse.json({ configured: googleOAuthConfigured() });
}
