import { z } from "zod";

const demoCancelHistoryStorageKey = "ticketground:demo-cancel-history";

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
  if (typeof window === "undefined") return [];

  const storedHistory = window.localStorage.getItem(demoCancelHistoryStorageKey);
  if (!storedHistory) return [];

  try {
    const parsedHistory: unknown = JSON.parse(storedHistory);
    const history = demoCancelHistorySchema.safeParse(parsedHistory);
    return history.success ? history.data : [];
  } catch (error) {
    if (error instanceof SyntaxError) return [];
    throw error;
  }
}

export function appendDemoCancelHistory(entry: DemoCancelHistoryEntry) {
  const retainedHistory = readDemoCancelHistory().filter((item) => item.reservationId !== entry.reservationId);
  window.localStorage.setItem(demoCancelHistoryStorageKey, JSON.stringify([entry, ...retainedHistory]));
}
