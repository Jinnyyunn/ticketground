import type { ChartDocument, ChartObject, ObjectLayer, Point, SelectionLayer } from "../../types/seat-chart.ts";
import { objectCenter } from "./chart-ops.ts";
import { rotateAround } from "./geometry.ts";
import { objectBounds } from "./transforms.ts";

type Bounds = { readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number };

export function toggleSelection(current: readonly string[], id: string): readonly string[] {
  return current.includes(id) ? current.filter((value) => value !== id) : [...current, id];
}

export function brushSeatSelection(
  current: readonly string[],
  hits: readonly string[],
  mode: "add" | "remove",
): readonly string[] {
  const selected = new Set(current);
  for (const hit of hits) {
    if (mode === "add") selected.add(hit);
    else selected.delete(hit);
  }
  return [...selected];
}

export function seatIdsNearPoint(
  chart: Pick<ChartDocument, "objects" | "activeFloorId">,
  point: Point,
  radius: number,
): readonly string[] {
  const hits: string[] = [];
  for (const object of chart.objects) {
    if (object.floorId && object.floorId !== chart.activeFloorId) continue;
    const seats = object.type === "row" || object.type === "table"
      ? object.seats
      : object.type === "section"
        ? object.nestedRows?.flatMap((row) => row.seats) ?? []
        : [];
    const center = objectCenter(object);
    for (const seat of seats) {
      const rendered = object.rotation ? rotateAround(seat, center, object.rotation) : seat;
      if (Math.hypot(rendered.x - point.x, rendered.y - point.y) < radius) hits.push(seat.id);
    }
  }
  return hits;
}

export function sameTypeSelection(chart: Pick<ChartDocument, "objects">, id: string): readonly string[] {
  const target = chart.objects.find((object) => object.id === id);
  if (!target) return [];
  return chart.objects.filter((object) => !object.locked && object.type === target.type).map((object) => object.id);
}

function boundsOf(object: ChartObject): Bounds {
  const bounds = objectBounds(object);
  const rotation = object.rotation ?? 0;
  if (rotation === 0) return { minX: bounds.x, minY: bounds.y, maxX: bounds.x + bounds.width, maxY: bounds.y + bounds.height };
  const center = objectCenter(object);
  const corners = [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height },
  ].map((point) => rotateAround(point, center, rotation));
  return {
    minX: Math.min(...corners.map((point) => point.x)),
    minY: Math.min(...corners.map((point) => point.y)),
    maxX: Math.max(...corners.map((point) => point.x)),
    maxY: Math.max(...corners.map((point) => point.y)),
  };
}

function matchesLayer(layer: ObjectLayer, selectedLayer: SelectionLayer): boolean {
  return selectedLayer === "all" || layer === selectedLayer;
}

export function marqueeObjectSelection(
  chart: Pick<ChartDocument, "objects">,
  start: Point,
  end: Point,
  layer: SelectionLayer,
): readonly string[] {
  const marquee = { minX: Math.min(start.x, end.x), minY: Math.min(start.y, end.y), maxX: Math.max(start.x, end.x), maxY: Math.max(start.y, end.y) };
  const containsOnly = end.x >= start.x;
  return chart.objects.filter((object) => {
    if (object.locked || !matchesLayer(object.layer, layer)) return false;
    const bounds = boundsOf(object);
    if (containsOnly) return bounds.minX >= marquee.minX && bounds.minY >= marquee.minY && bounds.maxX <= marquee.maxX && bounds.maxY <= marquee.maxY;
    return bounds.maxX >= marquee.minX && bounds.maxY >= marquee.minY && bounds.minX <= marquee.maxX && bounds.minY <= marquee.maxY;
  }).map((object) => object.id);
}

export function mutatePolygonNode<ObjectType extends Extract<ChartObject, { readonly type: "section" | "area" }>>(
  object: ObjectType,
  action: { readonly type: "add" | "move"; readonly index: number; readonly point: Point } | { readonly type: "remove"; readonly index: number },
): ObjectType {
  const points = [...object.points];
  if (action.type === "add") points.splice(action.index, 0, action.point);
  if (action.type === "move" && points[action.index]) points[action.index] = action.point;
  if (action.type === "remove" && points.length > 3) points.splice(action.index, 1);
  return { ...object, points };
}
