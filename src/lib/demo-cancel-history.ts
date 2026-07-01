import { z } from "zod";

const demoCancelHistoryStorageKey = "ticketground:demo-cancel-history";
const demoCancelHistoryChangeEvent = "ticketground:demo-cancel-history-change";
const emptyDemoCancelHistory: readonly DemoCancelHistoryEntry[] = [];

let cachedDemoCancelHistoryRaw: string | null = null;
let cachedDemoCancelHistorySnapshot = emptyDemoCancelHistory;

const demoCancelHistoryEntrySchema = z.object({
  reservationId: z.string(),
  showTitle: z.string(),
  venue: z.string(),
  date: z.string(),
  time: z.string(),
  seat: z.string(),
  reason: z.string(),
  refundAmount: z.number(),
  requestedAt: z.string(),
});

const demoCancelHistorySchema = z.array(demoCancelHistoryEntrySchema);

export type DemoCancelHistoryEntry = z.infer<typeof demoCancelHistoryEntrySchema>;

export function readDemoCancelHistory(): readonly DemoCancelHistoryEntry[] {
  if (typeof window === "undefined") return emptyDemoCancelHistory;

  const storedHistory = window.localStorage.getItem(demoCancelHistoryStorageKey);
  if (!storedHistory) {
    cachedDemoCancelHistoryRaw = null;
    cachedDemoCancelHistorySnapshot = emptyDemoCancelHistory;
    return cachedDemoCancelHistorySnapshot;
  }

  if (storedHistory === cachedDemoCancelHistoryRaw) return cachedDemoCancelHistorySnapshot;

  try {
    const parsedHistory: unknown = JSON.parse(storedHistory);
    const history = demoCancelHistorySchema.safeParse(parsedHistory);
    cachedDemoCancelHistoryRaw = storedHistory;
    cachedDemoCancelHistorySnapshot = history.success ? history.data : emptyDemoCancelHistory;
    return cachedDemoCancelHistorySnapshot;
  } catch (error) {
    if (error instanceof SyntaxError) {
      cachedDemoCancelHistoryRaw = storedHistory;
      cachedDemoCancelHistorySnapshot = emptyDemoCancelHistory;
      return cachedDemoCancelHistorySnapshot;
    }
    throw error;
  }
}

export function subscribeDemoCancelHistory(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};

  window.addEventListener("storage", onStoreChange);
  window.addEventListener(demoCancelHistoryChangeEvent, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(demoCancelHistoryChangeEvent, onStoreChange);
  };
}

export function appendDemoCancelHistory(entry: DemoCancelHistoryEntry) {
  const retainedHistory = readDemoCancelHistory().filter((item) => item.reservationId !== entry.reservationId);
  window.localStorage.setItem(demoCancelHistoryStorageKey, JSON.stringify([entry, ...retainedHistory]));
  window.dispatchEvent(new Event(demoCancelHistoryChangeEvent));
}
