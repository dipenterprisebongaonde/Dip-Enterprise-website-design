import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";

export type GoogleProfile = {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

export function googleOAuthConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function getAppUrl(requestUrl?: string) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  if (requestUrl) {
    const url = new URL(requestUrl);
    return `${url.protocol}//${url.host}`;
  }
  return "http://localhost:3000";
}

export function buildGoogleAuthUrl(options: {
  appUrl: string;
  state: string;
}) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    redirect_uri: `${options.appUrl}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    include_granted_scopes: "true",
    prompt: "select_account",
    state: options.state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleCode(code: string, appUrl: string) {
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
    redirect_uri: `${appUrl}/api/auth/google/callback`,
    grant_type: "authorization_code",
  });

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const tokenData = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(tokenData.error_description || "GOOGLE_TOKEN_EXCHANGE_FAILED");
  }

  const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const profile = (await profileRes.json().catch(() => null)) as GoogleProfile | null;
  if (!profileRes.ok || !profile?.sub || !profile.email) {
    throw new Error("GOOGLE_PROFILE_FAILED");
  }
  if (profile.email_verified === false) {
    throw new Error("GOOGLE_EMAIL_UNVERIFIED");
  }
  return profile;
}

export async function loginWithGoogleProfile(profile: GoogleProfile) {
  const email = profile.email.toLowerCase();
  let user =
    (await prisma.user.findFirst({ where: { googleId: profile.sub } })) ||
    (await prisma.user.findUnique({ where: { email } }));

  if (user) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        googleId: profile.sub,
        authProvider: user.passwordHash ? user.authProvider : "google",
        name: user.name || profile.name || email.split("@")[0],
      },
    });
  } else {
    const branch = await prisma.branch.create({
      data: {
        name: `${profile.name || "Google"} Workspace`,
        region: "Primary",
        address: "Google Sign-In Workspace",
      },
    });
    user = await prisma.user.create({
      data: {
        email,
        name: profile.name || email.split("@")[0],
        googleId: profile.sub,
        authProvider: "google",
        passwordHash: null,
        role: Role.SUPER_ADMIN,
        branchId: branch.id,
      },
    });
  }

  await createSession({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    branchId: user.branchId,
  });

  return {
    user,
    redirectTo: user.role === Role.SUPER_ADMIN ? "/choose-path" : "/dashboard",
  };
}
