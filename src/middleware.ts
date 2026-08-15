import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "dip_session";

const protectedPrefixes = ["/choose-path", "/dashboard", "/cctv", "/fleet", "/api/app"];

function getSecret() {
  return new TextEncoder().encode(
    process.env.AUTH_SECRET || "dip-enterprise-saas-dev-secret-change-in-production"
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const needsAuth = protectedPrefixes.some((p) => pathname.startsWith(p));
  if (!needsAuth) return NextResponse.next();

  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const { payload } = await jwtVerify(token, getSecret());
    const role = String(payload.role);

    if (
      (pathname.startsWith("/cctv") ||
        pathname.startsWith("/fleet") ||
        pathname.startsWith("/choose-path")) &&
      role !== "SUPER_ADMIN"
    ) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return NextResponse.next();
  } catch {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: [
    "/choose-path/:path*",
    "/dashboard/:path*",
    "/cctv/:path*",
    "/fleet/:path*",
    "/api/app/:path*",
  ],
};
