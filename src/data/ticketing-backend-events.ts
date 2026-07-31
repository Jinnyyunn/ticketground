import type { TicketShow } from "@/types";

export function getTicketShowBackendEventId(show: TicketShow) {
  return show.backendEventId ?? "event_kpop_001";
}

export function getTicketShowPerformanceDateId(show: TicketShow, date: string, time: string) {
  return show.backendPerformances.find((performance) => performance.date === date && performance.time === time)?.id;
}
