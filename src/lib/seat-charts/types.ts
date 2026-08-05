import type { ChartDocument } from "@/types/seat-chart";

export type SeatChartRecord = {
  readonly id: string;
  readonly chart: ChartDocument;
  /** Shows that use this published chart for booking */
  readonly boundShowSlugs: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type SeatChartSummary = {
  readonly id: string;
  readonly name: string;
  readonly published: boolean;
  readonly publishedAt?: string;
  readonly placeCount: number;
  readonly boundShowSlugs: readonly string[];
  readonly updatedAt: string;
  readonly venueType?: string;
};
