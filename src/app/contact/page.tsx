
import Link from "next/link";

export default function ContactPage() {
  return (
    <div className="app-shell">
      <Link href="/" className="text-sm font-semibold text-[var(--accent)]">
        ← Back to home
      </Link>
      <div className="panel mt-6 max-w-3xl p-6 md:p-10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="DIP Enterprise" className="h-16 w-16 rounded-full object-contain" />
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-[var(--navy)]">Contact Us</h1>
        <p className="mt-3 text-[var(--muted)]">
          Talk to DIP Enterprise about onboarding your branches onto the SaaS platform.
        </p>
        <div className="mt-8 space-y-3 text-base">
          <p>
            <span className="text-[var(--muted)]">Email:</span>{" "}
            dipenterprise.bongaon.de@gmail.com
          </p>
          <p>
            <span className="text-[var(--muted)]">Region:</span> Bongaon, West Bengal
          </p>
          <p>
            <span className="text-[var(--muted)]">Platform:</span> Operations · Inventory · CCTV ·
            Car Tracking
          </p>
        </div>
        <Link href="/signup" className="btn btn-primary mt-8 inline-flex">
          Create workspace
        </Link>
      </div>
    </div>
  );
}
