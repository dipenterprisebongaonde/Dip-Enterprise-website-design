import { Suspense } from "react";
import { LoginScreen } from "@/components/LoginScreen";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="login-shell" />}>
      <LoginScreen />
    </Suspense>
  );
}
