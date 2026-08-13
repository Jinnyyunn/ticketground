import { StarIcon, TicketIcon, UserIcon } from "@/components/icons";

// Locale-neutral identifiers. Display labels for these come from
// src/i18n/dictionaries/*.ts (header.categories / header.highlightCategories)
// - never store a translated label as a lookup key, or every locale but
// Korean silently breaks category navigation.
export type CategoryId = "home" | "concert" | "musical" | "theater" | "classical" | "exhibition" | "kids" | "sports";
export type HighlightCategoryId = "resale" | "calendar";

export const utilityLinksBeforeAuth = [
  { id: "help", href: "/help", external: false },
  { id: "kakao-channel", href: "https://pf.kakao.com/_xmTniX/chat", external: true },
] as const;

export const signedInUtilityLinks = [{ id: "my", href: "/mypage" }] as const;

export const loginLink = { href: "/login" } as const;
export const signupLink = { href: "/signup" } as const;

export const publicIconLinks = [{ id: "watchlist", href: "/watchlist", Icon: StarIcon }] as const;

export const signedInIconLinks = [
  { id: "reservations", href: "/mypage#reservations", Icon: TicketIcon },
  { id: "my", href: "/mypage", Icon: UserIcon },
] as const;

export const categoryHrefs: Record<CategoryId, string> = {
  home: "/",
  musical: "/contents/genre/musical",
  concert: "/contents/genre/concert",
  theater: "/contents/genre/theater",
  classical: "/contents/genre/classic",
  exhibition: "/contents/genre/exhibition",
  kids: "/contents/genre/children",
  sports: "/contents/genre/sports",
};

export const highlightCategoryHrefs: Record<HighlightCategoryId, string> = {
  calendar: "/open",
  resale: "/resale",
};
