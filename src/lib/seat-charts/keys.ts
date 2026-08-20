import { randomUUID } from "node:crypto";

export type ChartKey = `chart_${string}`;
export type RevisionId = `rev_${string}`;

export function createChartKey(): ChartKey {
  return `chart_${randomUUID().replaceAll("-", "")}`;
}

export function createRevisionId(): RevisionId {
  return `rev_${randomUUID().replaceAll("-", "")}`;
}
