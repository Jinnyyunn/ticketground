import type { ChartObject, Point, RowObject } from "@/types/seat-chart";

export type ObjectBounds = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
export type AlignmentMode = "left" | "center" | "right" | "top" | "middle" | "bottom";
export type DistributionMode = "horizontal" | "vertical";

function pointsBounds(points: readonly Point[]): ObjectBounds {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(1, Math.max(...xs) - x), height: Math.max(1, Math.max(...ys) - y) };
}

export function objectBounds(object: ChartObject): ObjectBounds {
  if (object.type === "row") return pointsBounds(object.seats);
  if (object.type === "table") return { x: object.center.x - (object.width ?? object.radius * 2) / 2 - 18, y: object.center.y - (object.height ?? object.radius * 2) / 2 - 18, width: (object.width ?? object.radius * 2) + 36, height: (object.height ?? object.radius * 2) + 36 };
  if (object.type === "booth" || object.type === "image" || object.type === "rectangle") return { x: object.x, y: object.y, width: object.width, height: object.height };
  if (object.type === "line") return pointsBounds(object.points ?? [object.start, object.end]);
  if (object.type === "text" || object.type === "icon") return { x: object.position.x - 30, y: object.position.y - 30, width: 60, height: 60 };
  return pointsBounds(object.points);
}

function moved(point: Point, delta: Point): Point { return { x: point.x + delta.x, y: point.y + delta.y }; }

export function translateObject(object: ChartObject, delta: Point): ChartObject {
  if (object.type === "row") return { ...object, start: moved(object.start, delta), end: moved(object.end, delta), path: object.path?.map((point) => moved(point, delta)), seats: object.seats.map((seat) => ({ ...seat, ...moved(seat, delta) })) };
  if (object.type === "table") return { ...object, center: moved(object.center, delta), seats: object.seats.map((seat) => ({ ...seat, ...moved(seat, delta) })) };
  if (object.type === "booth" || object.type === "image") return { ...object, x: object.x + delta.x, y: object.y + delta.y };
  if (object.type === "rectangle") return { ...object, x: object.x + delta.x, y: object.y + delta.y, points: object.points?.map((point) => moved(point, delta)) };
  if (object.type === "line") return { ...object, start: moved(object.start, delta), end: moved(object.end, delta), points: object.points?.map((point) => moved(point, delta)) };
  if (object.type === "text" || object.type === "icon") return { ...object, position: moved(object.position, delta) };
  if (object.type === "section") return { ...object, points: object.points.map((point) => moved(point, delta)), nestedRows: object.nestedRows?.map((row) => translateObject(row, delta)).filter((item): item is RowObject => item.type === "row") };
  return { ...object, points: object.points.map((point) => moved(point, delta)) };
}

function duplicateRow(row: RowObject, delta: Point): RowObject {
  const movedRow = translateObject(row, delta);
  if (movedRow.type !== "row") return row;
  return {
    ...movedRow,
    id: `row_${crypto.randomUUID()}`,
    label: `${row.label} 복사본`,
    seats: movedRow.seats.map((seat) => ({ ...seat, id: `seat_${crypto.randomUUID()}` })),
  };
}

export function duplicateObject(object: ChartObject, delta: Point = { x: 12, y: 12 }): ChartObject {
  if (object.type === "row") return duplicateRow(object, delta);
  const movedObject = translateObject(object, delta);
  const id = `${object.type}_${crypto.randomUUID()}`;
  const label = `${object.label} 복사본`;
  if (movedObject.type === "table") return { ...movedObject, id, label, seats: movedObject.seats.map((seat) => ({ ...seat, id: `seat_${crypto.randomUUID()}` })) };
  if (movedObject.type === "section") return { ...movedObject, id, label, nestedRows: movedObject.nestedRows?.map((row) => duplicateRow(row, { x: 0, y: 0 })) };
  return { ...movedObject, id, label };
}

export function alignObjects(objects: readonly ChartObject[], selectedIds: readonly string[], mode: AlignmentMode): readonly ChartObject[] {
  const selected = objects.filter((object) => selectedIds.includes(object.id));
  if (selected.length < 2) return objects;
  const bounds = selected.map(objectBounds);
  const left = Math.min(...bounds.map((item) => item.x));
  const top = Math.min(...bounds.map((item) => item.y));
  const right = Math.max(...bounds.map((item) => item.x + item.width));
  const bottom = Math.max(...bounds.map((item) => item.y + item.height));
  return objects.map((object) => {
    if (!selectedIds.includes(object.id)) return object;
    const item = objectBounds(object);
    const dx = mode === "left" ? left - item.x : mode === "center" ? (left + right - item.width) / 2 - item.x : mode === "right" ? right - item.width - item.x : 0;
    const dy = mode === "top" ? top - item.y : mode === "middle" ? (top + bottom - item.height) / 2 - item.y : mode === "bottom" ? bottom - item.height - item.y : 0;
    return translateObject(object, { x: dx, y: dy });
  });
}

export function distributeObjects(
  objects: readonly ChartObject[],
  selectedIds: readonly string[],
  mode: DistributionMode,
): readonly ChartObject[] {
  const selected = objects
    .filter((object) => selectedIds.includes(object.id))
    .map((object) => ({ object, bounds: objectBounds(object) }));
  if (selected.length < 3) return objects;
  const axis = mode === "horizontal" ? "x" : "y";
  const size = mode === "horizontal" ? "width" : "height";
  const ordered = selected.toSorted(
    (left, right) =>
      left.bounds[axis] + left.bounds[size] / 2 -
      (right.bounds[axis] + right.bounds[size] / 2),
  );
  const first = ordered[0];
  const last = ordered.at(-1);
  if (!first || !last) return objects;
  const firstCenter = first.bounds[axis] + first.bounds[size] / 2;
  const lastCenter = last.bounds[axis] + last.bounds[size] / 2;
  const step = (lastCenter - firstCenter) / (ordered.length - 1);
  const offsets = new Map(
    ordered.map(({ object, bounds }, index) => [
      object.id,
      firstCenter + step * index - (bounds[axis] + bounds[size] / 2),
    ]),
  );
  return objects.map((object) => {
    const offset = offsets.get(object.id);
    if (offset === undefined) return object;
    return translateObject(
      object,
      mode === "horizontal" ? { x: offset, y: 0 } : { x: 0, y: offset },
    );
  });
}

function scaled(point: Point, origin: Point, scale: Point): Point { return { x: origin.x + (point.x - origin.x) * scale.x, y: origin.y + (point.y - origin.y) * scale.y }; }

export function resizeObject(object: ChartObject, origin: Point, scale: Point): ChartObject {
  if (object.type === "row") return { ...object, start: scaled(object.start, origin, scale), end: scaled(object.end, origin, scale), path: object.path?.map((point) => scaled(point, origin, scale)), seats: object.seats.map((seat) => ({ ...seat, ...scaled(seat, origin, scale) })) };
  if (object.type === "table") return { ...object, center: scaled(object.center, origin, scale), radius: Math.max(8, object.radius * Math.max(scale.x, scale.y)), width: object.width ? Math.max(8, object.width * scale.x) : undefined, height: object.height ? Math.max(8, object.height * scale.y) : undefined, seats: object.seats.map((seat) => ({ ...seat, ...scaled(seat, origin, scale) })) };
  if (object.type === "booth") { const start = scaled({ x: object.x, y: object.y }, origin, scale); return { ...object, x: start.x, y: start.y, width: Math.max(8, object.width * scale.x), height: Math.max(8, object.height * scale.y) }; }
  if (object.type === "image") {
    const start = scaled({ x: object.x, y: object.y }, origin, scale);
    const uniform = object.aspectRatioLocked === false
      ? scale
      : { x: Math.max(scale.x, scale.y), y: Math.max(scale.x, scale.y) };
    return {
      ...object,
      x: start.x,
      y: start.y,
      width: Math.max(8, object.width * uniform.x),
      height: Math.max(8, object.height * uniform.y),
    };
  }
  if (object.type === "rectangle") { const start = scaled({ x: object.x, y: object.y }, origin, scale); return { ...object, x: start.x, y: start.y, width: Math.max(8, object.width * scale.x), height: Math.max(8, object.height * scale.y), points: object.points?.map((point) => scaled(point, origin, scale)) }; }
  if (object.type === "line") return { ...object, start: scaled(object.start, origin, scale), end: scaled(object.end, origin, scale), points: object.points?.map((point) => scaled(point, origin, scale)) };
  if (object.type === "text" || object.type === "icon") return { ...object, position: scaled(object.position, origin, scale) };
  return { ...object, points: object.points.map((point) => scaled(point, origin, scale)) };
}

function rotated(point: Point, center: Point, angle: number): Point { const cosine = Math.cos(angle); const sine = Math.sin(angle); const x = point.x - center.x; const y = point.y - center.y; return { x: center.x + x * cosine - y * sine, y: center.y + x * sine + y * cosine }; }

export function rotateObject(object: ChartObject, center: Point, angle: number): ChartObject {
  if (object.type === "row") return { ...object, rotation: (object.rotation ?? 0) + angle * 180 / Math.PI, start: rotated(object.start, center, angle), end: rotated(object.end, center, angle), path: object.path?.map((point) => rotated(point, center, angle)), seats: object.seats.map((seat) => ({ ...seat, ...rotated(seat, center, angle) })) };
  if (object.type === "table") return { ...object, rotation: (object.rotation ?? 0) + angle * 180 / Math.PI, center: rotated(object.center, center, angle), seats: object.seats.map((seat) => ({ ...seat, ...rotated(seat, center, angle) })) };
  if (object.type === "line") return { ...object, rotation: (object.rotation ?? 0) + angle * 180 / Math.PI, start: rotated(object.start, center, angle), end: rotated(object.end, center, angle), points: object.points?.map((point) => rotated(point, center, angle)) };
  if (object.type === "text" || object.type === "icon") return { ...object, rotation: (object.rotation ?? 0) + angle * 180 / Math.PI, position: rotated(object.position, center, angle) };
  if (object.type === "rectangle" && object.points) return { ...object, rotation: (object.rotation ?? 0) + angle * 180 / Math.PI, points: object.points.map((point) => rotated(point, center, angle)) };
  return { ...object, rotation: (object.rotation ?? 0) + angle * 180 / Math.PI };
}
