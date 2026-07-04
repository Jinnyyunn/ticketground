import { Suspense } from "react";
import { LoginPanel } from "@/components/ticketing/login-panel";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPanel initialMode="login" />
    </Suspense>
  );
}
