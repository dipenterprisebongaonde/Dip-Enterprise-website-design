import { NextResponse } from "next/server";
import {
  exchangeGoogleCode,
  getAppUrl,
  googleOAuthConfigured,
  loginWithGoogleProfile,
} from "@/lib/google-auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const appUrl = getAppUrl(request.url);

  if (!googleOAuthConfigured()) {
    return NextResponse.redirect(`${appUrl}/login?error=google_not_configured`);
  }

  const error = url.searchParams.get("error");
  if (error) {
    return NextResponse.redirect(`${appUrl}/login?error=google_denied`);
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieHeader = request.headers.get("cookie") || "";
  const stateCookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("dip_google_oauth_state="))
    ?.split("=")[1];

  if (!code || !state || !stateCookie || stateCookie !== state) {
    return NextResponse.redirect(`${appUrl}/login?error=google_state`);
  }

  try {
    const profile = await exchangeGoogleCode(code, appUrl);
    const result = await loginWithGoogleProfile(profile);
    const response = NextResponse.redirect(`${appUrl}${result.redirectTo}`);
    response.cookies.set("dip_google_oauth_state", "", {
      httpOnly: true,
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (err) {
    console.error("google oauth callback", err);
    const codeName = err instanceof Error ? err.message : "";
    const errorKey =
      codeName === "GOOGLE_EMAIL_UNVERIFIED"
        ? "google_unverified"
        : "google_failed";
    return NextResponse.redirect(`${appUrl}/login?error=${errorKey}`);
  }
}
