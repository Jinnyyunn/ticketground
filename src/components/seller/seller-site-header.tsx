"use client";

import { useState } from "react";
import type { SellerSession } from "./seller-types";

async function sellerLogout(csrf: string): Promise<void> {
  await fetch("/api/seller/logout", { method: "POST", credentials: "include", headers: { "x-tig-seller-csrf": csrf } });
}

export function SellerSiteHeader({ session, onLoggedOut }: { readonly session: SellerSession | null; readonly onLoggedOut: () => void }) {
  const [loggingOut, setLoggingOut] = useState(false);

  const logout = async (): Promise<void> => {
    if (!session) return;
    setLoggingOut(true);
    try {
      await sellerLogout(session.csrf);
    } finally {
      setLoggingOut(false);
      onLoggedOut();
    }
  };

  return (
    <header className="border-b border-line bg-ink text-on-ink">
      <div className="ticketground-container flex h-16 items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-black">Ticketground</span>
          <span className="rounded-full bg-on-ink/10 px-2 py-1 text-xs font-black">기업 판매자 시스템</span>
        </div>
        {session ? (
          <div className="flex items-center gap-3">
            <p className="hidden text-sm font-bold text-on-ink/80 sm:block">{session.organizationName} · {session.username}</p>
            <button className="h-9 rounded-lg border border-on-ink/25 px-3 text-sm font-black text-on-ink disabled:opacity-50" disabled={loggingOut} onClick={logout} type="button">
              로그아웃
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
