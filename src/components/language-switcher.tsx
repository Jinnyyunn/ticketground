"use client";

import { Select } from "@base-ui/react/select";
import { usePathname, useSearchParams } from "next/navigation";
import { Check, ChevronDown, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { locales, type Locale } from "@/i18n/config";
import { isLocalizedPathname, localizeHref } from "@/i18n/routing";

type LanguageSwitcherProps = {
  readonly currentLocale: Locale;
  readonly label: string;
  readonly names: Record<Locale, string>;
  readonly comingSoonLabel: string;
  readonly className?: string;
};

export function LanguageSwitcher({ currentLocale, label, names, comingSoonLabel, className }: LanguageSwitcherProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeIsLocalized = isLocalizedPathname(pathname);
  const items = locales.map((locale) => ({ value: locale, label: names[locale] }));

  function handleValueChange(value: unknown) {
    const nextLocale = value as Locale;
    if (nextLocale === currentLocale) return;
    const search = searchParams.toString();
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    // A full navigation, not router.push(): the locale comes from a
    // proxy-set request header the root layout reads once per request
    // (src/i18n/request-locale.ts). Next's App Router intentionally keeps
    // a shared layout mounted across client-side transitions between
    // sibling routes, so a soft push here would update the URL bar
    // without ever re-running the root layout - <html lang> and the
    // loaded dictionary would silently stay on the old locale.
    window.location.assign(localizeHref(nextLocale, pathname, search ? `?${search}` : "", hash));
  }

  return (
    <Select.Root items={items} value={currentLocale} onValueChange={handleValueChange}>
      <Select.Trigger
        aria-label={label}
        className={cn(
          "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-card px-3 text-xs font-bold text-ink-2 transition-colors hover:text-ticketground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          className,
        )}
      >
        <Globe className="size-3.5 shrink-0" aria-hidden />
        <Select.Value />
        <Select.Icon>
          <ChevronDown className="size-3.5 shrink-0" aria-hidden />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        {/* z-[100]: must clear MobileNav's Dialog.Popup (z-[90]) since this
            switcher also renders inside that modal drawer on mobile, not
            just the z-50 desktop header. */}
        <Select.Positioner side="bottom" align="end" sideOffset={8} alignItemWithTrigger={false} className="z-[100]">
          <Select.Popup className="min-w-[168px] rounded-lg border border-line bg-card p-1 shadow-ticket-2">
            <Select.List>
              {locales.map((locale) => {
                const disabled = locale !== currentLocale && !routeIsLocalized;
                return (
                  <Select.Item
                    key={locale}
                    value={locale}
                    disabled={disabled}
                    className={cn(
                      "flex cursor-pointer items-center justify-between gap-2 rounded-md px-3 py-2 text-sm font-bold text-ink outline-none data-[highlighted]:bg-surface",
                      disabled && "cursor-not-allowed text-ink-4 data-[highlighted]:bg-transparent",
                    )}
                  >
                    <Select.ItemText>{names[locale]}</Select.ItemText>
                    {disabled ? (
                      <span className="text-[10px] font-bold text-ink-4">{comingSoonLabel}</span>
                    ) : (
                      <Select.ItemIndicator>
                        <Check className="size-4 shrink-0" aria-hidden />
                      </Select.ItemIndicator>
                    )}
                  </Select.Item>
                );
              })}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
