"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { categoryNav, categoryNavHighlight } from "@/data/content";
import { categoryHrefs, loginLink, signedInUtilityLinks, signupLink, utilityLinksBeforeAuth } from "@/components/header-links";
import { ThemeToggle } from "@/components/theme-toggle";
import { useSessionAuth } from "@/lib/use-session-auth";
import { cn } from "@/lib/utils";

export function MobileNav({ className }: { readonly className?: string }) {
  const [open, setOpen] = useState(false);
  const { signedIn, signOut } = useSessionAuth();
  const close = () => setOpen(false);

  function handleSignOut() {
    signOut();
    close();
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        aria-label="전체 메뉴 열기"
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-full border border-line bg-card text-ink transition-colors hover:bg-surface focus-visible:ring-3 focus-visible:ring-ring/50",
          className,
        )}
      >
        <Menu className="size-5" aria-hidden />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[80] bg-scrim/45" />
        <Dialog.Popup className="fixed inset-y-0 right-0 z-[90] flex w-[min(360px,calc(100vw-32px))] flex-col bg-background p-5 text-ink shadow-ticket-3">
          <div className="flex items-center justify-between gap-3 border-b border-line pb-4">
            <Dialog.Title className="text-2xl font-black">전체 메뉴</Dialog.Title>
            <Dialog.Close
              aria-label="전체 메뉴 닫기"
              className="grid size-10 place-items-center rounded-full border border-line bg-surface text-ink hover:bg-surface-2 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <X className="size-5" aria-hidden />
            </Dialog.Close>
          </div>

          <nav aria-label="모바일 유틸리티" className="grid grid-cols-2 gap-2 border-b border-line py-4 text-sm font-black">
            <div className="col-span-2 flex items-center justify-between gap-3 rounded-lg border border-line bg-card px-3 py-2 text-ink">
              <span className="whitespace-nowrap">화면 모드</span>
              <ThemeToggle className="h-9 w-16" />
            </div>
            {utilityLinksBeforeAuth.map((link) => (
              <Link key={link.href} href={link.href} onClick={close} className="rounded-lg border border-line bg-surface px-3 py-3 text-center">
                {link.label}
              </Link>
            ))}
            {signedIn ? (
              <>
                {signedInUtilityLinks.map((link) => (
                  <Link key={link.href} href={link.href} onClick={close} className="rounded-lg border border-line bg-surface px-3 py-3 text-center">
                    {link.label}
                  </Link>
                ))}
                <button type="button" onClick={handleSignOut} className="col-span-2 rounded-lg border border-line bg-ink px-3 py-3 text-center text-on-ink">
                  로그아웃
                </button>
              </>
            ) : (
              <>
                <Link href={loginLink.href} onClick={close} className="rounded-lg border border-line bg-ink px-3 py-3 text-center text-on-ink">
                  {loginLink.label}
                </Link>
                <Link href={signupLink.href} onClick={close} className="rounded-lg border border-line bg-surface px-3 py-3 text-center">
                  {signupLink.label}
                </Link>
              </>
            )}
          </nav>

          <nav aria-label="모바일 카테고리" className="grid gap-2 overflow-y-auto py-4 text-lg font-black">
            {[...categoryNav, ...categoryNavHighlight].map((label) => (
              <Link
                key={label}
                href={categoryHrefs[label] ?? "/contents/search"}
                onClick={close}
                className={cn(
                  "rounded-lg px-3 py-3 transition-colors hover:bg-surface focus-visible:ring-3 focus-visible:ring-ring/50",
                  categoryNavHighlight.includes(label) && "text-ticketground",
                )}
              >
                {label}
              </Link>
            ))}
          </nav>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
