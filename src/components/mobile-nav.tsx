"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { categoryNav, categoryNavHighlight } from "@/data/content";
import { categoryHrefs, highlightCategoryHrefs, loginLink, signedInUtilityLinks, signupLink, utilityLinksBeforeAuth, type CategoryId, type HighlightCategoryId } from "@/components/header-links";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useSessionAuth } from "@/lib/use-session-auth";
import { cn } from "@/lib/utils";
import { dictionary as koDictionary } from "@/i18n/dictionaries/ko";
import type { Dictionary } from "@/i18n/get-dictionary";
import { defaultLocale, type Locale } from "@/i18n/config";
import { localizeHref } from "@/i18n/routing";

type MobileNavProps = {
  readonly className?: string;
  readonly dict?: Dictionary["header"];
  readonly mobileNavDict?: Dictionary["mobileNav"];
  readonly commonDict?: Dictionary["common"];
  readonly locale?: Locale;
  readonly languageSwitcherDict?: Dictionary["languageSwitcher"];
  readonly languageComingSoonLabel?: string;
};

export function MobileNav({
  className,
  dict = koDictionary.header,
  mobileNavDict = koDictionary.mobileNav,
  commonDict = koDictionary.common,
  locale = defaultLocale,
  languageSwitcherDict = koDictionary.languageSwitcher,
  languageComingSoonLabel = koDictionary.common.languageComingSoon,
}: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const { signedIn, signOut } = useSessionAuth();
  const close = () => setOpen(false);
  const categoryLabels: Record<CategoryId | HighlightCategoryId, string> = { ...dict.categories, ...dict.highlightCategories };

  function handleSignOut() {
    signOut();
    close();
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        aria-label={mobileNavDict.openMenu}
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
            <Dialog.Title className="text-2xl font-black">{mobileNavDict.title}</Dialog.Title>
            <Dialog.Close
              aria-label={mobileNavDict.closeMenu}
              className="grid size-10 place-items-center rounded-full border border-line bg-surface text-ink hover:bg-surface-2 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <X className="size-5" aria-hidden />
            </Dialog.Close>
          </div>

          <nav aria-label={mobileNavDict.ariaUtility} className="grid grid-cols-2 gap-2 border-b border-line py-4 text-sm font-black">
            <div className="col-span-2 flex items-center justify-between gap-3 rounded-lg border border-line bg-card px-3 py-2 text-ink">
              <span className="whitespace-nowrap">{mobileNavDict.themeMode}</span>
              <ThemeToggle className="h-9 w-16" lightLabel={commonDict.themeToggleLight} darkLabel={commonDict.themeToggleDark} />
            </div>
            <div className="col-span-2 flex items-center justify-between gap-3 rounded-lg border border-line bg-card px-3 py-2 text-ink">
              <span className="whitespace-nowrap">{languageSwitcherDict.label}</span>
              <LanguageSwitcher
                currentLocale={locale}
                label={languageSwitcherDict.label}
                names={languageSwitcherDict.names}
                comingSoonLabel={languageComingSoonLabel}
              />
            </div>
            {signedIn ? (
              <>
                {signedInUtilityLinks.map((link) => (
                  <Link key={link.href} href={localizeHref(locale, link.href)} onClick={close} className="rounded-lg border border-line bg-surface px-3 py-3 text-center">
                    {dict.utilityMy}
                  </Link>
                ))}
                <button type="button" onClick={handleSignOut} className="col-span-2 rounded-lg border border-line bg-ink px-3 py-3 text-center text-on-ink">
                  {dict.logout}
                </button>
              </>
            ) : (
              <>
                <Link href={localizeHref(locale, loginLink.href)} onClick={close} className="rounded-lg border border-line bg-ink px-3 py-3 text-center text-on-ink">
                  {dict.login}
                </Link>
                <Link href={localizeHref(locale, signupLink.href)} onClick={close} className="rounded-lg border border-line bg-surface px-3 py-3 text-center">
                  {dict.signup}
                </Link>
              </>
            )}
            <Link href="/mypage#identity" onClick={close} className="col-span-2 rounded-lg border border-ticketground/40 bg-ticketground/10 px-3 py-3 text-center text-ticketground">
              본인인증
            </Link>
          </nav>

          <nav aria-label={mobileNavDict.ariaCategory} className="grid gap-2 overflow-y-auto py-4 text-lg font-black">
            {[...categoryNav, ...categoryNavHighlight].map((id) => {
              const highlighted = (categoryNavHighlight as readonly string[]).includes(id);
              const href = highlighted ? highlightCategoryHrefs[id as HighlightCategoryId] : categoryHrefs[id as CategoryId];
              return (
                <Link
                  key={id}
                  href={localizeHref(locale, href ?? "/contents/search")}
                  onClick={close}
                  className={cn(
                    "rounded-lg px-3 py-3 transition-colors hover:bg-surface focus-visible:ring-3 focus-visible:ring-ring/50",
                    highlighted && "text-ticketground",
                  )}
                >
                  {categoryLabels[id]}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-line pt-4 text-center">
            {utilityLinksBeforeAuth.map((link) => (
              <Link
                key={link.href}
                href={localizeHref(locale, link.href)}
                onClick={close}
                className="text-sm font-normal text-ink-3 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {dict.utilityHelp}
              </Link>
            ))}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
