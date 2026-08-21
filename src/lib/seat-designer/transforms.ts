import type { ChartObject, Point, RowObject, SeatPlace } from "../../types/seat-chart.ts";

export type ObjectBounds = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };

function boundsOf(points: readonly Point[]): ObjectBounds {
  if (points.length === 0) return { x: 0, y: 0, width: 1, height: 1 };
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(1, Math.max(...xs) - x), height: Math.max(1, Math.max(...ys) - y) };
}

function geometryPoints(object: ChartObject): readonly Point[] {
  switch (object.type) {
    case "row": return [...(object.path ?? [object.start, object.end]), ...object.seats];
    case "section": return object.points;
    case "table": {
      const width = object.shape === "rectangle" ? object.width ?? 120 : object.radius * 2;
      const height = object.shape === "rectangle" ? object.height ?? 36 : object.radius * 2;
      return [{ x: object.center.x - width / 2, y: object.center.y - height / 2 }, { x: object.center.x + width / 2, y: object.center.y + height / 2 }, ...object.seats];
    }
    case "booth":
    case "rectangle":
    case "image": return [{ x: object.x, y: object.y }, { x: object.x + object.width, y: object.y + object.height }];
    case "area": return object.points;
    case "line": return object.points ?? [object.start, object.end];
    case "text": return [{ x: object.position.x - 20, y: object.position.y - (object.fontSize ?? 14) }, { x: object.position.x + 20, y: object.position.y + 4 }];
    case "icon": {
      const radius = (object.size ?? 40) / 2;
      return [{ x: object.position.x - radius, y: object.position.y - radius }, { x: object.position.x + radius, y: object.position.y + radius }];
    }
  }
}

export function objectBounds(object: ChartObject): ObjectBounds {
  return boundsOf(geometryPoints(object));
}

function affine(from: ObjectBounds, to: ObjectBounds) {
  const scaleX = to.width / Math.max(from.width, 1);
  const scaleY = to.height / Math.max(from.height, 1);
  return (point: Point): Point => ({
    x: to.x + (point.x - from.x) * scaleX,
    y: to.y + (point.y - from.y) * scaleY,
  });
}

function seatWith(seat: SeatPlace, transform: (point: Point) => Point): SeatPlace {
  const point = transform(seat);
  return { ...seat, x: point.x, y: point.y };
}

function rowWith(row: RowObject, transform: (point: Point) => Point): RowObject {
  return {
    ...row,
    start: transform(row.start),
    end: transform(row.end),
    path: row.path?.map(transform),
    seats: row.seats.map((seat) => seatWith(seat, transform)),
  };
}

export function resizeObject(object: ChartObject, next: ObjectBounds): ChartObject {
  if (object.locked) return object;
  const previous = objectBounds(object);
  const transform = affine(previous, {
    x: next.x,
    y: next.y,
    width: Math.max(1, next.width),
    height: Math.max(1, next.height),
  });
  const scaleX = Math.max(1, next.width) / previous.width;
  const scaleY = Math.max(1, next.height) / previous.height;
  switch (object.type) {
    case "row": return rowWith(object, transform);
    case "section": return { ...object, points: object.points.map(transform), nestedRows: object.nestedRows?.map((row) => rowWith(row, transform)) };
    case "table": {
      if (object.shape === "round") {
        const scale = Math.max(0.01, Math.min(next.width / previous.width, next.height / previous.height));
        const center = { x: next.x + next.width / 2, y: next.y + next.height / 2 };
        const uniformTransform = (point: Point): Point => ({
          x: center.x + (point.x - object.center.x) * scale,
          y: center.y + (point.y - object.center.y) * scale,
        });
        return { ...object, center, radius: Math.max(1, object.radius * scale), seats: object.seats.map((seat) => seatWith(seat, uniformTransform)) };
      }
      return { ...object, center: transform(object.center), radius: Math.max(1, object.radius * (scaleX + scaleY) / 2), width: object.width === undefined ? undefined : object.width * scaleX, height: object.height === undefined ? undefined : object.height * scaleY, seats: object.seats.map((seat) => seatWith(seat, transform)) };
    }
    case "booth":
    case "image": return { ...object, x: next.x, y: next.y, width: Math.max(1, next.width), height: Math.max(1, next.height) };
    case "rectangle": return { ...object, x: next.x, y: next.y, width: Math.max(1, next.width), height: Math.max(1, next.height), points: object.points?.map(transform) };
    case "area": return { ...object, points: object.points.map(transform) };
    case "line": return { ...object, start: transform(object.start), end: transform(object.end), points: object.points?.map(transform) };
    case "text": return { ...object, position: transform(object.position), fontSize: Math.max(6, (object.fontSize ?? 14) * Math.min(scaleX, scaleY)) };
    case "icon": return { ...object, position: transform(object.position), size: Math.max(8, (object.size ?? 40) * Math.min(scaleX, scaleY)) };
  }
}

export function rotateObject(object: ChartObject, rotation: number): ChartObject {
  if (object.locked) return object;
  const normalized = ((rotation % 360) + 360) % 360;
  return { ...object, rotation: normalized };
}
