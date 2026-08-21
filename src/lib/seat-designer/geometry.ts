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

export function constrainPointToAngle(origin: Point, point: Point, incrementDegrees: number): Point {
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0 || incrementDegrees <= 0) return point;
  const increment = incrementDegrees * Math.PI / 180;
  const angle = Math.round(Math.atan2(dy, dx) / increment) * increment;
  return {
    x: origin.x + Math.cos(angle) * distance,
    y: origin.y + Math.sin(angle) * distance,
  };
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

export function seatsAlongPolyline(
  points: readonly Point[],
  count: number,
  rowLabel: string,
  categoryKey?: string,
): SeatPlace[] {
  if (points.length < 2 || count <= 0) return [];
  const segments = points.slice(1).map((point, index) => ({
    start: points[index],
    end: point,
    length: dist(points[index], point),
  }));
  const total = segments.reduce((sum, segment) => sum + segment.length, 0);
  if (total === 0) return [];
  return Array.from({ length: count }, (_, index) => {
    const target = count === 1 ? total / 2 : total * index / (count - 1);
    let traversed = 0;
    let selected = segments[segments.length - 1];
    for (const segment of segments) {
      if (target <= traversed + segment.length) {
        selected = segment;
        break;
      }
      traversed += segment.length;
    }
    const ratio = selected.length === 0 ? 0 : (target - traversed) / selected.length;
    return {
      id: uid("seat"),
      label: `${rowLabel}-${index + 1}`,
      x: lerp(selected.start.x, selected.end.x, ratio),
      y: lerp(selected.start.y, selected.end.y, ratio),
      categoryKey,
    };
  });
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

export function seatsAroundRectangularTable(
  center: Point,
  width: number,
  height: number,
  chairs: { readonly top: number; readonly right: number; readonly bottom: number; readonly left: number },
  tableLabel: string,
  categoryKey?: string,
): SeatPlace[] {
  const left = center.x - width / 2;
  const right = center.x + width / 2;
  const top = center.y - height / 2;
  const bottom = center.y + height / 2;
  const result: SeatPlace[] = [];
  const append = (start: Point, end: Point, count: number, offset: Point) => {
    for (let index = 0; index < count; index += 1) {
      const ratio = (index + 1) / (count + 1);
      result.push({
        id: uid("seat"),
        label: `${tableLabel}-${result.length + 1}`,
        x: lerp(start.x, end.x, ratio) + offset.x,
        y: lerp(start.y, end.y, ratio) + offset.y,
        categoryKey,
      });
    }
  };
  append({ x: left, y: top }, { x: right, y: top }, chairs.top, { x: 0, y: -14 });
  append({ x: right, y: top }, { x: right, y: bottom }, chairs.right, { x: 14, y: 0 });
  append({ x: right, y: bottom }, { x: left, y: bottom }, chairs.bottom, { x: 0, y: 14 });
  append({ x: left, y: bottom }, { x: left, y: top }, chairs.left, { x: -14, y: 0 });
  return result;
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
