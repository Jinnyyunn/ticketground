import type { ChartDocument, SeatChartDocumentV2 } from "@/types/seat-chart";
import type { ChartKey, RevisionId } from "./keys";
import { z } from "zod";

export const seatChartVenueSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});

export type SeatChartVenue = z.infer<typeof seatChartVenueSchema>;

export type SeatChartRecord = {
  readonly id: string;
  readonly chart: ChartDocument;
  readonly boundVenue: SeatChartVenue | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type SeatChartSummary = {
  readonly id: string;
  readonly name: string;
  readonly published: boolean;
  readonly publishedAt?: string;
  readonly placeCount: number;
  readonly boundVenue: SeatChartVenue | null;
  readonly updatedAt: string;
  readonly venueType?: string;
};

export type SeatChartDraftRecord = {
  readonly chartKey: ChartKey;
  readonly document: SeatChartDocumentV2;
  readonly updatedAt: string;
};

export type SeatChartPublishedRevision = {
  readonly revisionId: RevisionId;
  readonly chartKey: ChartKey;
  readonly venueId: string;
  readonly document: SeatChartDocumentV2;
  readonly contentHash: string;
  readonly publishedAt: string;
  readonly publishedBy: string;
};

export type SeatChartVenueActiveRevision = {
  readonly venueId: string;
  readonly chartKey: ChartKey;
  readonly revisionId: RevisionId;
  readonly publishedAt: string;
};
