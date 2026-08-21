import type { ChartDocument, SeatChartAsset } from "../../types/seat-chart.ts";

export function withChartAsset(chart: ChartDocument, asset: SeatChartAsset): ChartDocument {
  return {
    ...chart,
    assets: [...(chart.assets ?? []).filter((candidate) => candidate.id !== asset.id), asset],
  };
}
