import type { ChartObject, Point } from "../../types/seat-chart.ts";
import { rotateAround, seatsAlongPolyline } from "./geometry.ts";
import { objectCenter } from "./chart-ops.ts";
import { pointInObjectFrame } from "./transforms.ts";

export function verticesOf(object: ChartObject): readonly Point[] {
  if (object.type === "section") return object.points;
  if (object.type === "area") return object.shape === "polygon" || object.shape === undefined ? object.points : [];
  if (object.type === "row") return object.path ?? [object.start, object.end];
  if (object.type === "line") return object.points ?? [object.start, object.end];
  if (object.type === "rectangle" && object.shape === "polygon") return object.points ?? [];
  return [];
}

function pointToSegmentDistance(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const ratio = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (start.x + ratio * dx), point.y - (start.y + ratio * dy));
}

export function insertionIndexForPoint(points: readonly Point[], point: Point, closed: boolean): number {
  const segmentCount = closed ? points.length : points.length - 1;
  let closestIndex = 0;
  let closestDistance = Infinity;
  for (let index = 0; index < segmentCount; index += 1) {
    const distance = pointToSegmentDistance(point, points[index], points[(index + 1) % points.length]);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  }
  return closestIndex + 1;
}

function withVertices(object: ChartObject, points: readonly Point[]): ChartObject {
  if (object.type === "section" || object.type === "area") return { ...object, points };
  if (object.type === "row") {
    const generated = seatsAlongPolyline(points, object.seatCount, object.label, object.categoryKey);
    if (generated.length === 0) return object;
    return {
      ...object,
      start: points[0],
      end: points[points.length - 1],
      path: points,
      seats: generated.map((seat, index) => object.seats[index] ? { ...object.seats[index], x: seat.x, y: seat.y } : seat),
    };
  }
  if (object.type === "line") {
    return { ...object, start: points[0], end: points[points.length - 1], points };
  }
  if (object.type === "rectangle" && object.shape === "polygon") {
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return {
      ...object,
      points,
      x,
      y,
      width: Math.max(...xs) - x,
      height: Math.max(...ys) - y,
    };
  }
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

export function pointForRenderedVertex(object: ChartObject, index: number, pointer: Point): Point | null {
  if (!object.rotation) return pointer;
  const renderedVertex = (local: Point): Point => {
    const candidate = moveVertex(object, index, local);
    const vertex = verticesOf(candidate)[index];
    return rotateAround(vertex, objectCenter(candidate), object.rotation ?? 0);
  };
  let local = pointInObjectFrame(pointer, objectCenter(object), object.rotation);
  const delta = 0.01;
  for (let iteration = 0; iteration < 12; iteration += 1) {
    const rendered = renderedVertex(local);
    const error = { x: rendered.x - pointer.x, y: rendered.y - pointer.y };
    if (Math.hypot(error.x, error.y) < 0.001) return local;
    const renderedX = renderedVertex({ x: local.x + delta, y: local.y });
    const renderedY = renderedVertex({ x: local.x, y: local.y + delta });
    const j00 = (renderedX.x - rendered.x) / delta;
    const j10 = (renderedX.y - rendered.y) / delta;
    const j01 = (renderedY.x - rendered.x) / delta;
    const j11 = (renderedY.y - rendered.y) / delta;
    const determinant = j00 * j11 - j01 * j10;
    if (Math.abs(determinant) < 0.000001) return null;
    local = {
      x: local.x - (j11 * error.x - j01 * error.y) / determinant,
      y: local.y - (-j10 * error.x + j00 * error.y) / determinant,
    };
  }
  return null;
}

export function removeVertex(object: ChartObject, index: number): ChartObject {
  if (object.locked) return object;
  const points = [...verticesOf(object)];
  if (!points[index] || points.length <= minimumVertices(object)) return object;
  points.splice(index, 1);
  return withVertices(object, points);
}
