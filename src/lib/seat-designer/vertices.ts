import type { ChartObject, Point } from "../../types/seat-chart.ts";
import { seatsAlongPolyline } from "./geometry.ts";

export function verticesOf(object: ChartObject): readonly Point[] {
  if (object.type === "section" || object.type === "area") return object.points;
  if (object.type === "row") return object.path ?? [object.start, object.end];
  if (object.type === "line") return object.points ?? [object.start, object.end];
  if (object.type === "rectangle" && object.shape === "polygon") return object.points ?? [];
  return [];
}

function withVertices(object: ChartObject, points: readonly Point[]): ChartObject {
  if (object.type === "section" || object.type === "area") return { ...object, points };
  if (object.type === "row") {
    return {
      ...object,
      start: points[0],
      end: points[points.length - 1],
      path: points,
      seats: seatsAlongPolyline(points, object.seatCount, object.label, object.categoryKey),
    };
  }
  if (object.type === "line") {
    return { ...object, start: points[0], end: points[points.length - 1], points };
  }
  if (object.type === "rectangle" && object.shape === "polygon") return { ...object, points };
  return object;
}

function minimumVertices(object: ChartObject): number {
  return object.type === "row" || object.type === "line" ? 2 : 3;
}

export function insertVertex(object: ChartObject, index: number, point: Point): ChartObject {
  if (object.locked) return object;
  const points = [...verticesOf(object)];
  if (points.length === 0 || index < 0 || index > points.length) return object;
  points.splice(index, 0, point);
  return withVertices(object, points);
}

export function moveVertex(object: ChartObject, index: number, point: Point): ChartObject {
  if (object.locked) return object;
  const points = [...verticesOf(object)];
  if (!points[index]) return object;
  points[index] = point;
  return withVertices(object, points);
}

export function removeVertex(object: ChartObject, index: number): ChartObject {
  if (object.locked) return object;
  const points = [...verticesOf(object)];
  if (!points[index] || points.length <= minimumVertices(object)) return object;
  points.splice(index, 1);
  return withVertices(object, points);
}
