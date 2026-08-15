import { createHash, randomInt } from "crypto";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 30 * 1000;

export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `+91${digits.slice(1)}`;
  if (digits.length >= 10 && digits.length <= 15) return `+${digits}`;
  return null;
}

export function formatPhoneDisplay(phone: string) {
  if (phone.startsWith("+91") && phone.length === 13) {
    return `+91 ${phone.slice(3, 8)} ${phone.slice(8)}`;
  }
  return phone;
}

function hashOtp(phone: string, code: string) {
  return createHash("sha256").update(`${phone}:${code}`).digest("hex");
}

function generateOtp() {
  return String(randomInt(100000, 999999));
}

export function phoneOtpDemoMode() {
  // Without an SMS provider, return the OTP in API responses for testing.
  return !process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_FROM_NUMBER;
}

async function sendSms(phone: string, code: string) {
  if (phoneOtpDemoMode()) {
    console.info(`[phone-otp] demo code for ${phone}: ${code}`);
    return { sent: false as const, demo: true as const };
  }

  const body = new URLSearchParams({
    To: phone,
    From: process.env.TWILIO_FROM_NUMBER || "",
    Body: `Your DIP Enterprise login code is ${code}. Valid for 5 minutes.`,
  });

  const auth = Buffer.from(
    `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`,
  ).toString("base64");

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    },
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`SMS_SEND_FAILED:${detail.slice(0, 200)}`);
  }

  return { sent: true as const, demo: false as const };
}

export async function requestPhoneOtp(rawPhone: string) {
  const phone = normalizePhone(rawPhone);
  if (!phone) {
    return { error: "Enter a valid phone number.", status: 400 as const };
  }

  const latest = await prisma.phoneOtp.findFirst({
    where: { phone, consumed: false },
    orderBy: { createdAt: "desc" },
  });

  if (latest && Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    return { error: "Please wait a few seconds before requesting another code.", status: 429 as const };
  }

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await prisma.phoneOtp.create({
    data: {
      phone,
      codeHash: hashOtp(phone, code),
      expiresAt,
    },
  });

  const delivery = await sendSms(phone, code);

  return {
    ok: true as const,
    phone,
    displayPhone: formatPhoneDisplay(phone),
    expiresInSec: Math.floor(OTP_TTL_MS / 1000),
    demoMode: delivery.demo,
    demoOtp: delivery.demo ? code : undefined,
  };
}

export async function verifyPhoneOtp(rawPhone: string, code: string) {
  const phone = normalizePhone(rawPhone);
  if (!phone) {
    return { error: "Enter a valid phone number.", status: 400 as const };
  }

  const otp = code.replace(/\D/g, "");
  if (otp.length !== 6) {
    return { error: "Enter the 6-digit code.", status: 400 as const };
  }

  const record = await prisma.phoneOtp.findFirst({
    where: { phone, consumed: false },
    orderBy: { createdAt: "desc" },
  });

  if (!record || record.expiresAt.getTime() < Date.now()) {
    return { error: "Code expired. Request a new one.", status: 401 as const };
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    return { error: "Too many attempts. Request a new code.", status: 429 as const };
  }

  const valid = record.codeHash === hashOtp(phone, otp);
  await prisma.phoneOtp.update({
    where: { id: record.id },
    data: {
      attempts: { increment: 1 },
      consumed: valid,
    },
  });

  if (!valid) {
    return { error: "Invalid code. Try again.", status: 401 as const };
  }

  let user = await prisma.user.findUnique({ where: { phone } });

  if (!user) {
    const branch = await prisma.branch.create({
      data: {
        name: `Phone ${phone.slice(-4)} Workspace`,
        region: "Primary",
        address: "Phone Sign-In Workspace",
      },
    });

    user = await prisma.user.create({
      data: {
        email: `phone.${phone.replace(/\D/g, "")}@users.dipenterprise.local`,
        phone,
        name: `User ${phone.slice(-4)}`,
        passwordHash: null,
        authProvider: "phone",
        role: Role.SUPER_ADMIN,
        branchId: branch.id,
      },
    });
  } else if (user.authProvider === "password") {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { authProvider: user.passwordHash ? user.authProvider : "phone" },
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
    ok: true as const,
    redirectTo: user.role === Role.SUPER_ADMIN ? "/choose-path" : "/dashboard",
    user: {
      id: user.id,
      email: user.email,
      phone: user.phone,
      name: user.name,
      role: user.role,
      branchId: user.branchId,
    },
  };
}
