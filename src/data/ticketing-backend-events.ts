import type { TicketShow } from "@/types";

const fallbackBackendEventIdsBySlug: Readonly<Record<string, string>> = {
  "iu-world-tour": "event_kpop_001",
  "seventeen-tour": "event_kpop_001",
  "nct-wish-fanmeeting": "event_kpop_001",
  "day6-special-live": "event_kpop_001",
  "palette-festival": "event_festival_001",
  banksy: "event_festival_001",
  breadbarbershop: "event_festival_001",
};

export function getTicketShowBackendEventId(show: TicketShow) {
  if (show.backendEventId) return show.backendEventId;
  const mappedEventId = fallbackBackendEventIdsBySlug[show.slug];
  if (mappedEventId) return mappedEventId;
  return show.category === "콘서트" ? "event_kpop_001" : "event_musical_001";
}
