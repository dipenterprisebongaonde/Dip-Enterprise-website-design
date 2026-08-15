import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";

export default function SignupPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5 py-10">
      <Link href="/" className="mb-6 text-sm font-semibold text-[var(--accent)]">
        ← Back to home
      </Link>
      <AuthForm mode="signup" />
    </div>
  );
}
