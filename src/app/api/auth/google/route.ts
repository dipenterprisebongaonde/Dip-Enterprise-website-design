import { NextResponse } from "next/server";
import {
  buildGoogleAuthUrl,
  getAppUrl,
  googleOAuthConfigured,
} from "@/lib/google-auth";

export async function GET(request: Request) {
  if (!googleOAuthConfigured()) {
    return NextResponse.redirect(
      new URL("/login?error=google_not_configured", request.url)
    );
  }

  const appUrl = getAppUrl(request.url);
  const state = crypto.randomUUID();
  const response = NextResponse.redirect(
    buildGoogleAuthUrl({ appUrl, state })
  );
  response.cookies.set("dip_google_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });
  return response;
}
