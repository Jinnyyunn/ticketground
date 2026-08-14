import type { SeatChartSummary } from "./types";

export function selectPublishedChartForShow(
  charts: readonly SeatChartSummary[],
  showSlug: string,
): SeatChartSummary | undefined {
  return charts.find((chart) => chart.published && chart.boundShowSlugs.includes(showSlug));
}
