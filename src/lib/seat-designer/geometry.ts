import type { Point, SeatPlace } from "@/types/seat-chart";

export function uid(prefix = "obj"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function dist(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function snap(value: number, grid: number, enabled: boolean): number {
  if (!enabled || grid <= 0) return value;
  return Math.round(value / grid) * grid;
}

export function snapPoint(p: Point, grid: number, enabled: boolean): Point {
  return { x: snap(p.x, grid, enabled), y: snap(p.y, grid, enabled) };
}

/** Place seats along a line with optional quadratic-style midpoint bulge. */
export function seatsAlongLine(
  start: Point,
  end: Point,
  count: number,
  rowLabel: string,
  curve = 0,
  categoryKey?: string,
): SeatPlace[] {
  if (count <= 0) return [];
  const mx = (start.x + end.x) / 2;
  const my = (start.y + end.y) / 2;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * curve;
  const ny = (dx / len) * curve;
  const mid = { x: mx + nx, y: my + ny };

  const seats: SeatPlace[] = [];
  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    // quadratic bezier
    const x = (1 - t) * (1 - t) * start.x + 2 * (1 - t) * t * mid.x + t * t * end.x;
    const y = (1 - t) * (1 - t) * start.y + 2 * (1 - t) * t * mid.y + t * t * end.y;
    seats.push({
      id: uid("seat"),
      label: `${rowLabel}-${i + 1}`,
      x,
      y,
      categoryKey,
    });
  }
  return seats;
}

export function seatsAroundTable(
  center: Point,
  radius: number,
  count: number,
  tableLabel: string,
  categoryKey?: string,
): SeatPlace[] {
  const seats: SeatPlace[] = [];
  const r = radius + 14;
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2 - Math.PI / 2;
    seats.push({
      id: uid("seat"),
      label: `${tableLabel}-${i + 1}`,
      x: center.x + Math.cos(a) * r,
      y: center.y + Math.sin(a) * r,
      categoryKey,
    });
  }
  return seats;
}

export function pointInPolygon(point: Point, polygon: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function polygonPath(points: readonly Point[]): string {
  if (points.length === 0) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") + " Z";
}

export function rectCorners(x: number, y: number, w: number, h: number): Point[] {
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
}

export function boundsOfPoints(points: readonly Point[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}

export function rotateAround(p: Point, origin: Point, deg: number): Point {
  const r = (deg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const dx = p.x - origin.x;
  const dy = p.y - origin.y;
  return {
    x: origin.x + dx * cos - dy * sin,
    y: origin.y + dx * sin + dy * cos,
  };
}

export function mirrorPoints(points: readonly Point[], axis: "h" | "v", origin: Point): Point[] {
  return points.map((p) =>
    axis === "h"
      ? { x: origin.x - (p.x - origin.x), y: p.y }
      : { x: p.x, y: origin.y - (p.y - origin.y) },
  );
}
