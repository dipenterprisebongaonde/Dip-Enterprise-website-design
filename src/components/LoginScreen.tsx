"use client";

import Image from "next/image";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";

type Step = "chooser" | "email" | "password" | "phone" | "otp";

const DEMO_ACCOUNTS = [
  {
    label: "Super Admin",
    email: "admin@dipenterprise.com",
    password: "Admin@123",
    phone: "9000011111",
  },
  {
    label: "Staff",
    email: "staff@dipenterprise.com",
    password: "Staff@123",
    phone: "9000022222",
  },
] as const;

const ERROR_MESSAGES: Record<string, string> = {
  google_denied: "Google sign-in was cancelled.",
  google_failed: "Google sign-in failed. Try again.",
  google_not_configured: "Google login is not configured yet. Use email, phone, or continue without login.",
  google_unverified: "Your Google account email could not be verified.",
  google_state: "Google sign-in expired. Please try again.",
  google_email: "Your Google account email could not be verified.",
  missing_code: "Google did not return an authorization code.",
  config: "Google login is missing server credentials.",
};

export function LoginScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>("chooser");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState<string>(DEMO_ACCOUNTS[0].email);
  const [password, setPassword] = useState<string>(DEMO_ACCOUNTS[0].password);
  const [phone, setPhone] = useState<string>(DEMO_ACCOUNTS[0].phone);
  const [otp, setOtp] = useState("");
  const [demoOtp, setDemoOtp] = useState("");
  const [displayPhone, setDisplayPhone] = useState("");
  const [googleReady, setGoogleReady] = useState(false);

  const oauthError = searchParams.get("error");
  const oauthMessage = useMemo(
    () => (oauthError ? ERROR_MESSAGES[oauthError] || "Sign-in failed." : ""),
    [oauthError],
  );

  useEffect(() => {
    if (oauthMessage) setError(oauthMessage);
  }, [oauthMessage]);

  useEffect(() => {
    fetch("/api/auth/google/status")
      .then((r) => r.json())
      .then((d: { configured?: boolean }) => setGoogleReady(Boolean(d.configured)))
      .catch(() => setGoogleReady(false));
  }, []);

  function fillDemo(account: (typeof DEMO_ACCOUNTS)[number]) {
    setEmail(account.email);
    setPassword(account.password);
    setPhone(account.phone);
    setError("");
    setStep("password");
  }

  function fillPhoneDemo(account: (typeof DEMO_ACCOUNTS)[number]) {
    setPhone(account.phone);
    setError("");
    setDemoOtp("");
    setOtp("");
  }

  function onEmailContinue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) {
      setError("Enter your email.");
      return;
    }
    setError("");
    setStep("password");
  }

  async function onPasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const payload = {
      email: email.trim().toLowerCase(),
      password: password.trim(),
    };

    if (!payload.email || !payload.password) {
      setLoading(false);
      setError("Enter email and password.");
      return;
    }

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Invalid email or password");
        setLoading(false);
        return;
      }
      router.push(data.redirectTo || "/dashboard");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  async function onSendOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    setDemoOtp("");
    try {
      const res = await fetch("/api/auth/phone/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not send code.");
        setLoading(false);
        return;
      }
      setDisplayPhone(data.displayPhone || phone);
      if (data.demoOtp) {
        setDemoOtp(String(data.demoOtp));
        setOtp(String(data.demoOtp));
      } else {
        setOtp("");
      }
      setStep("otp");
      setLoading(false);
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  async function onVerifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/phone/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), code: otp.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Invalid code.");
        setLoading(false);
        return;
      }
      router.push(data.redirectTo || "/dashboard");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="login-blob login-blob-a" aria-hidden />
      <div className="login-blob login-blob-b" aria-hidden />
      <div className="login-blob login-blob-c" aria-hidden />

      <div className="login-theme-slot">
        <ThemeToggle />
      </div>

      <div className="login-frame">
        <div className="login-brand">
          <Image src="/logo.png" alt="DIP Enterprise" width={42} height={42} className="login-brand-logo" />
          <span>DIP ENTERPRISE</span>
        </div>

        <div className="login-grid">
          <div className="login-form google-login-panel">
            {step === "chooser" && (
              <>
                <h1>Sign in</h1>
                <p className="login-sub">
                  Continue with Google, phone, email, or browse without logging in.
                </p>

                {error && <p className="login-error">{error}</p>}

                <div className="google-login-actions">
                  <a
                    className={`google-login-btn${googleReady ? "" : " is-disabled"}`}
                    href={googleReady ? "/api/auth/google" : undefined}
                    onClick={(e) => {
                      if (!googleReady) {
                        e.preventDefault();
                        setError(ERROR_MESSAGES.google_not_configured);
                      }
                    }}
                    aria-disabled={!googleReady}
                  >
                    <GoogleMark />
                    Continue with Google
                  </a>

                  <button type="button" className="login-demo-chip google-email-chip" onClick={() => setStep("phone")}>
                    Continue with phone number
                  </button>

                  <button type="button" className="login-demo-chip google-email-chip" onClick={() => setStep("email")}>
                    Continue with email
                  </button>

                  <Link href="/" className="login-submit google-guest-btn">
                    Continue without login
                  </Link>
                </div>

                <p className="login-meta">
                  New to the platform? <Link href="/signup">Sign up</Link>
                </p>
              </>
            )}

            {step === "phone" && (
              <form onSubmit={onSendOtp}>
                <h1>Phone login</h1>
                <p className="login-sub">Enter your phone number. We’ll send a one-time code.</p>

                <div className="login-demo-actions" role="group" aria-label="Demo phone accounts">
                  {DEMO_ACCOUNTS.map((account) => (
                    <button
                      key={account.phone}
                      type="button"
                      className="login-demo-chip"
                      onClick={() => fillPhoneDemo(account)}
                    >
                      Use {account.label}
                    </button>
                  ))}
                </div>

                <label className="login-field">
                  <span>Phone number</span>
                  <input
                    type="tel"
                    name="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="10-digit mobile number"
                    required
                    autoComplete="tel"
                    autoFocus
                  />
                </label>

                {error && <p className="login-error">{error}</p>}

                <div className="google-step-actions">
                  <button type="button" className="login-demo-chip" onClick={() => setStep("chooser")}>
                    Back
                  </button>
                  <button className="login-submit google-next-btn" disabled={loading} type="submit">
                    {loading ? "SENDING…" : "Send OTP"}
                  </button>
                </div>
              </form>
            )}

            {step === "otp" && (
              <form onSubmit={onVerifyOtp}>
                <h1>Enter code</h1>
                <button type="button" className="google-account-chip" onClick={() => setStep("phone")}>
                  {displayPhone || phone}
                </button>
                <p className="login-sub">Type the 6-digit OTP sent to your phone.</p>

                {demoOtp && (
                  <p className="phone-demo-otp">
                    Demo mode · use code <strong>{demoOtp}</strong>
                  </p>
                )}

                <label className="login-field">
                  <span>OTP</span>
                  <input
                    type="text"
                    name="otp"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="6-digit code"
                    required
                    autoComplete="one-time-code"
                    autoFocus
                  />
                </label>

                {error && <p className="login-error">{error}</p>}

                <div className="google-step-actions">
                  <button
                    type="button"
                    className="login-demo-chip"
                    disabled={loading}
                    onClick={async () => {
                      setLoading(true);
                      setError("");
                      try {
                        const res = await fetch("/api/auth/phone/send-otp", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ phone: phone.trim() }),
                        });
                        const data = await res.json().catch(() => ({}));
                        if (!res.ok) {
                          setError(data.error || "Could not resend code.");
                        } else if (data.demoOtp) {
                          setDemoOtp(String(data.demoOtp));
                          setOtp(String(data.demoOtp));
                        }
                      } catch {
                        setError("Network error. Please try again.");
                      } finally {
                        setLoading(false);
                      }
                    }}
                  >
                    Resend
                  </button>
                  <button className="login-submit google-next-btn" disabled={loading || otp.length !== 6} type="submit">
                    {loading ? "VERIFYING…" : "Verify"}
                  </button>
                </div>
              </form>
            )}

            {step === "email" && (
              <form onSubmit={onEmailContinue}>
                <h1>Sign in</h1>
                <p className="login-sub">Enter your email to continue.</p>

                <div className="login-demo-actions" role="group" aria-label="Demo accounts">
                  {DEMO_ACCOUNTS.map((account) => (
                    <button
                      key={account.email}
                      type="button"
                      className="login-demo-chip"
                      onClick={() => fillDemo(account)}
                    >
                      Use {account.label}
                    </button>
                  ))}
                </div>

                <label className="login-field">
                  <span>Email</span>
                  <input
                    type="email"
                    name="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Please enter your email"
                    required
                    autoComplete="email"
                    autoFocus
                  />
                </label>

                {error && <p className="login-error">{error}</p>}

                <div className="google-step-actions">
                  <button type="button" className="login-demo-chip" onClick={() => setStep("chooser")}>
                    Back
                  </button>
                  <button className="login-submit google-next-btn" type="submit">
                    Next
                  </button>
                </div>
              </form>
            )}

            {step === "password" && (
              <form onSubmit={onPasswordSubmit}>
                <h1>Welcome</h1>
                <button type="button" className="google-account-chip" onClick={() => setStep("email")}>
                  {email}
                </button>
                <p className="login-sub">Enter your password</p>

                <label className="login-field">
                  <span>Password</span>
                  <div className="login-password-wrap">
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Please enter your password"
                      minLength={6}
                      required
                      autoComplete="current-password"
                      autoFocus
                    />
                    <button
                      type="button"
                      className="login-eye"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </label>

                {error && <p className="login-error">{error}</p>}

                <div className="google-step-actions">
                  <button type="button" className="login-demo-chip" onClick={() => setStep("email")}>
                    Back
                  </button>
                  <button className="login-submit google-next-btn" disabled={loading} type="submit">
                    {loading ? "PLEASE WAIT..." : "NEXT"}
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="login-art" aria-hidden>
            <Image
              src="/login-hero.png"
              alt=""
              fill
              priority
              className="login-art-image"
              sizes="(max-width: 900px) 100vw, 62vw"
            />
          </div>
        </div>
      </div>

      <Link href="/" className="login-back">
        ← Back to home
      </Link>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16.1 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.3 35.3 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.3 4.1-4.2 5.5l.1.1 6.3 5.3C39.1 40.3 44 36 44 24c0-1.3-.1-2.7-.4-3.5z"
      />
    </svg>
  );
}
