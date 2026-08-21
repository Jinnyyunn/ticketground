import type { Point } from "@/types/seat-chart";

export function insertPathNode(
  points: readonly Point[],
  afterIndex: number,
  point: Point,
): readonly Point[] {
  return [
    ...points.slice(0, afterIndex + 1),
    point,
    ...points.slice(afterIndex + 1),
  ];
}

export function removePathNode(
  points: readonly Point[],
  index: number,
  minimum: number,
): readonly Point[] {
  if (points.length <= minimum || index < 0 || index >= points.length) return points;
  return points.filter((_, itemIndex) => itemIndex !== index);
}
