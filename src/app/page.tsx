import Link from "next/link";
import { ProductSlideshow } from "@/components/ProductSlideshow";

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 md:px-8">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="DIP Enterprise logo" className="h-12 w-12 rounded-full object-contain" />
          <div>
            <p className="brand-display text-lg tracking-[0.12em] text-[var(--navy)]">DIP ENTERPRISE</p>
            <p className="text-xs text-[var(--muted)]">Cloud SaaS platform</p>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <Link href="/contact" className="btn btn-ghost px-3 py-2 text-sm md:px-4">
            Contact Us
          </Link>
          <Link href="/login" className="btn btn-primary px-3 py-2 text-sm md:px-4">
            Log in
          </Link>
        </div>
      </header>

      <section className="relative mx-auto max-w-6xl overflow-hidden px-5 pb-10 pt-6 md:px-8">
        <div className="panel relative overflow-hidden rounded-[1.6rem] px-6 py-12 md:px-12 md:py-16">
          <div
            className="absolute inset-0 opacity-90"
            style={{
              background:
                "radial-gradient(700px 320px at 85% 20%, rgba(109,74,255,0.18), transparent 55%), radial-gradient(500px 260px at 10% 80%, rgba(74,163,255,0.14), transparent 50%)",
            }}
          />
          <div className="relative z-10 max-w-2xl">
            <p className="brand-display animate-fade-up text-5xl leading-none tracking-[0.06em] text-[var(--navy)] md:text-6xl">
              DIP ENTERPRISE
            </p>
            <p className="animate-fade-up animate-delay-1 mt-4 text-2xl font-semibold text-[var(--accent)] md:text-3xl">
              Secure. Track. Operate.
            </p>
            <p className="animate-fade-up animate-delay-2 mt-4 max-w-xl text-base text-[var(--muted)] md:text-lg">
              One SaaS workspace for inventory, branch operations, CCTV monitoring, and live fleet
              intelligence.
            </p>
            <div className="animate-fade-up animate-delay-3 mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className="btn btn-primary">
                Start free workspace
              </Link>
              <Link href="/login" className="btn btn-ghost">
                Go to login
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-10 md:px-8">
        <div className="mb-6">
          <h2 className="text-3xl font-bold tracking-tight text-[var(--navy)] md:text-4xl">Product suite</h2>
          <p className="mt-2 max-w-2xl text-[var(--muted)]">
            Explore the modules your teams use across operations, inventory, security, and mobility.
          </p>
        </div>
        <ProductSlideshow />
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-16 md:px-8">
        <h2 className="text-3xl font-bold tracking-tight text-[var(--navy)] md:text-4xl">Inventory</h2>
        <p className="mt-2 max-w-2xl text-[var(--muted)]">
          Add products and track product name with quantity in your branch workspace.
        </p>
      </section>
    </div>
  );
}
