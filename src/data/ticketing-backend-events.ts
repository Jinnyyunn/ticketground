import type { TicketShow } from "@/types";

export function getTicketShowBackendEventId(show: TicketShow) {
  return show.backendEventId ?? "event_kpop_001";
}
