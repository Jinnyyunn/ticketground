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
  readonly pinnedRank: number | null;
}

interface ApiCatalogResponse {
  readonly ok: boolean;
  readonly data?: { readonly events: readonly ApiCatalogEvent[] };
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

export async function searchShowsAsync(query: string): Promise<TicketShow[]> {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  const shows = await getGeneralSaleShows();
  return shows.filter((show) =>
    [show.title, show.shortTitle, show.venue, show.category].some((value) => value.toLowerCase().includes(normalized)),
  );
}
