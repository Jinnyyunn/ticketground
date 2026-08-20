import type { SeatChartSummary } from "./types";

export function selectPublishedChartForVenue(
  charts: readonly SeatChartSummary[],
  venueId: string,
): SeatChartSummary | undefined {
  return charts
    .filter((chart) => chart.published && chart.boundVenue?.id === venueId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
}
