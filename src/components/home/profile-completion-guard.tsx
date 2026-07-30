"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  clearSessionUser,
  getSession,
  SESSION_USER_CHANGED_EVENT,
  storedSessionUserId,
  TicketgroundApiError,
} from "@/lib/ticketground-api";

type ProfileGateState =
  | { readonly kind: "checking" }
  | { readonly kind: "allowed" }
  | { readonly kind: "unavailable" };

export function ProfileCompletionGuard({ children }: { readonly children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<ProfileGateState>({ kind: "checking" });

  useEffect(() => {
    let active = true;
    let validationId = 0;

    const validateProfile = async () => {
      const currentValidationId = ++validationId;
      const userId = storedSessionUserId();
      if (!userId) {
        setState({ kind: "allowed" });
        return;
      }

      setState({ kind: "checking" });
      try {
        const session = await getSession(userId);
        if (!active || currentValidationId !== validationId || storedSessionUserId() !== userId) return;
        if (!session.profileConfirmed) {
          router.replace("/login");
          return;
        }
        setState({ kind: "allowed" });
      } catch (error: unknown) {
        if (!active || currentValidationId !== validationId || storedSessionUserId() !== userId) return;
        if (error instanceof TicketgroundApiError && error.code === "USER_NOT_FOUND") {
          clearSessionUser();
          return;
        }
        setState({ kind: "unavailable" });
      }
    };

    const syncProfile = () => {
      void validateProfile();
    };

    syncProfile();
    window.addEventListener("storage", syncProfile);
    window.addEventListener(SESSION_USER_CHANGED_EVENT, syncProfile);
    return () => {
      active = false;
      validationId += 1;
      window.removeEventListener("storage", syncProfile);
      window.removeEventListener(SESSION_USER_CHANGED_EVENT, syncProfile);
    };
  }, [router]);

  if (state.kind === "allowed") return children;

  if (state.kind === "unavailable") {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-6 text-center">
        <div>
          <p role="alert" className="text-sm font-bold text-ink-3">
            프로필 상태를 확인할 수 없습니다. 다시 로그인해 주세요.
          </p>
          <Link
            href="/login"
            replace
            className="mt-4 inline-flex h-10 items-center rounded-sm bg-ink px-4 text-sm font-black text-on-ink focus-visible:ring-3 focus-visible:ring-ring/40"
          >
            로그인으로 이동
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background">
      <p role="status" className="text-sm font-bold text-ink-3">
        프로필 확인 중
      </p>
    </main>
  );
}
