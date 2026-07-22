import { headers } from "next/headers";
import { cache } from "react";
import type { TicketShow, TicketPrice } from "@/types";
import { categoryEnToKo } from "./show-categories";

interface ApiCatalogEvent {
  readonly id: string;
  readonly slug?: string;
  readonly category: string;
  readonly title: string;
  readonly shortTitle?: string;
  readonly venue: string;
  readonly date: string;
  readonly schedules?: ReadonlyArray<{ label: string; date: string; times: readonly string[] }>;
  readonly period?: string;
  readonly runtime?: string;
  readonly ageLimit?: string;
  readonly image: string;
  readonly badge?: string;
  readonly artistSlug?: string;
  readonly summary?: string;
  readonly casts?: readonly string[];
  readonly notices?: readonly string[];
  readonly prices: readonly TicketPrice[];
  readonly saleState: string;
  readonly sale: {
    readonly label: string;
    readonly note: string;
    readonly bookable: boolean;
    readonly displayPrice: number;
    readonly basePrice: number;
    readonly discountRate: number;
  };
  readonly checkoutNotice: string;
  readonly pinnedRank: number | null;
  readonly soldCount: number;
}

interface ApiCatalogResponse {
  readonly ok: boolean;
  readonly data?: { readonly events: readonly ApiCatalogEvent[] };
}

interface ApiPublicTicket {
  readonly id: string;
  readonly eventId: string;
  readonly seatLabel: string;
  readonly faceValue: number;
}

interface ApiStateResponse {
  readonly ok: boolean;
  readonly data?: { readonly tickets: readonly ApiPublicTicket[] };
}

async function catalogBaseUrl(): Promise<string> {
  const list = await headers();
  const host = list.get("host") ?? "localhost:4173";
  const proto = list.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

function toTicketShow(event: ApiCatalogEvent): TicketShow {
  return {
    slug: event.slug ?? event.id,
    backendEventId: event.id,
    category: categoryEnToKo[event.category] ?? "콘서트",
    title: event.title,
    shortTitle: event.shortTitle || event.title,
    venue: event.venue,
    period: event.period || event.date,
    runtime: event.runtime || "",
    ageLimit: event.ageLimit || "전체 관람가",
    poster: event.image,
    ranking: event.pinnedRank ? `고정 랭킹 ${event.pinnedRank}위` : undefined,
    pinnedRank: event.pinnedRank,
    soldCount: event.soldCount,
    saleState: event.saleState,
    sale: event.sale,
    checkoutNotice: event.checkoutNotice,
    badge: event.badge,
    artistSlug: event.artistSlug,
    prices: event.prices,
    schedules: (event.schedules ?? []).map((schedule) => ({
      label: schedule.label,
      date: schedule.date.replaceAll("-", "."),
      times: schedule.times,
    })),
    casts: event.casts ?? [],
    notices: event.notices ?? [],
    summary: event.summary || "",
  };
}

// Cached per-request (React.cache) so every page/component fetching the
// catalog during the same render tree shares one backend round trip.
export const getTicketShows = cache(async (): Promise<TicketShow[]> => {
  const base = await catalogBaseUrl();
  const response = await fetch(`${base}/api/catalog`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to load catalog: ${response.status}`);
  const payload = (await response.json()) as ApiCatalogResponse;
  if (!payload.ok || !payload.data) throw new Error("Catalog response was not ok");
  return payload.data.events.filter((event) => event.slug).map(toTicketShow);
});

export async function getGeneralSaleShows(): Promise<TicketShow[]> {
  const shows = await getTicketShows();
  return shows.filter((show) => show.badge !== "클린티켓");
}

export async function getShowBySlug(slug: string): Promise<TicketShow | undefined> {
  const shows = await getTicketShows();
  return shows.find((show) => show.slug === slug);
}

export async function getTicketById(ticketId: string): Promise<{ readonly ticket: ApiPublicTicket; readonly show: TicketShow } | undefined> {
  if (!ticketId) return undefined;
  const base = await catalogBaseUrl();
  const response = await fetch(`${base}/api/state?include=tickets`, { cache: "no-store" });
  if (!response.ok) return undefined;
  const payload = (await response.json()) as ApiStateResponse;
  const ticket = payload.data?.tickets.find((item) => item.id === ticketId);
  if (!ticket) return undefined;
  const shows = await getTicketShows();
  const show = shows.find((item) => item.backendEventId === ticket.eventId);
  if (!show) return undefined;
  return { ticket, show };
}

export interface GroupBookingCatalogEvent {
  readonly id: string;
  readonly title: string;
  readonly venue: string;
  readonly dates: readonly { readonly id: string; readonly startsAt: string; readonly label: string }[];
  readonly zones: readonly { readonly id: string; readonly name: string; readonly faceValue: number }[];
}

interface ApiCatalogEventWithZones extends ApiCatalogEvent {
  readonly dates?: readonly { readonly id: string; readonly startsAt: string; readonly label: string }[];
  readonly zones?: readonly { readonly id: string; readonly name: string; readonly faceValue: number }[];
}

// Separate from getTicketShows/TicketShow on purpose: the group-booking form
// needs raw zoneId/performanceDateId values that the public TicketShow shape
// intentionally drops, and this keeps that shared type untouched.
export async function getGroupBookingCatalogEvents(): Promise<GroupBookingCatalogEvent[]> {
  const base = await catalogBaseUrl();
  const response = await fetch(`${base}/api/catalog`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to load catalog: ${response.status}`);
  const payload = (await response.json()) as { readonly ok: boolean; readonly data?: { readonly events: readonly ApiCatalogEventWithZones[] } };
  if (!payload.ok || !payload.data) throw new Error("Catalog response was not ok");
  return payload.data.events
    .filter((event) => (event.dates?.length ?? 0) > 0 && (event.zones?.length ?? 0) > 0)
    .map((event) => ({
      id: event.id,
      title: event.title,
      venue: event.venue,
      dates: event.dates ?? [],
      zones: event.zones ?? [],
    }));
}

export async function searchShowsAsync(query: string): Promise<TicketShow[]> {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  const shows = await getGeneralSaleShows();
  return shows.filter((show) =>
    [show.title, show.shortTitle, show.venue, show.category].some((value) => value.toLowerCase().includes(normalized)),
  );
}
