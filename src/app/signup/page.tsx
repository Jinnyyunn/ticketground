import { Suspense } from "react";
import { LoginPanel } from "@/components/ticketing/login-panel";

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <LoginPanel initialMode="signup" />
    </Suspense>
  );
}
