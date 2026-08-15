"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "login" | "signup";

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(event.currentTarget);
    const payload =
      mode === "login"
        ? {
            email: String(form.get("email") || ""),
            password: String(form.get("password") || ""),
          }
        : {
            name: String(form.get("name") || ""),
            email: String(form.get("email") || ""),
            password: String(form.get("password") || ""),
            companyName: String(form.get("companyName") || ""),
          };

    try {
      const res = await fetch(`/api/auth/${mode === "login" ? "login" : "signup"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong");
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
    <form onSubmit={onSubmit} className="panel mx-auto w-full max-w-md p-6 md:p-8">
      <div className="mb-6 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="DIP Enterprise" className="mx-auto h-20 w-20 rounded-full object-contain" />
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-[var(--navy)]">
          {mode === "login" ? "Sign in" : "Start your workspace"}
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {mode === "login"
            ? "Access your DIP Enterprise Cloud modules."
            : "Create a SaaS workspace and become the Super Admin."}
        </p>
      </div>

      <div className="space-y-3">
        {mode === "signup" && (
          <>
            <input className="field" name="name" placeholder="Full name" required />
            <input className="field" name="companyName" placeholder="Company / workspace name" />
          </>
        )}
        <input className="field" type="email" name="email" placeholder="Work email" required />
        <input
          className="field"
          type="password"
          name="password"
          placeholder="Password"
          minLength={6}
          required
        />
      </div>

      {error && <p className="mt-3 text-sm text-[var(--danger)]">{error}</p>}

      <button className="btn btn-primary mt-5 w-full" disabled={loading} type="submit">
        {loading ? "Please wait..." : mode === "login" ? "Log in" : "Create account"}
      </button>

      <p className="mt-4 text-center text-sm text-[var(--muted)]">
        {mode === "login" ? (
          <>
            New to the platform?{" "}
            <Link className="font-semibold text-[var(--accent)]" href="/signup">
              Sign up
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link className="font-semibold text-[var(--accent)]" href="/login">
              Log in
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
