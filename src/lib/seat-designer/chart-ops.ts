import type {
  ChartDocument,
  ChartObject,
  Point,
  RowObject,
  SectionObject,
  TableObject,
  Viewport,
} from "@/types/seat-chart";
import { mirrorPoints, rotateAround, seatsAlongLine, seatsAlongPolyline, seatsAroundRectangularTable, seatsAroundTable, uid } from "./geometry.ts";
import { objectBounds, resizeObject } from "./transforms.ts";

export type ChartBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
};

function expandBounds(
  b: { minX: number; minY: number; maxX: number; maxY: number },
  x: number,
  y: number,
  pad = 0,
) {
  b.minX = Math.min(b.minX, x - pad);
  b.minY = Math.min(b.minY, y - pad);
  b.maxX = Math.max(b.maxX, x + pad);
  b.maxY = Math.max(b.maxY, y + pad);
}

/** Axis-aligned bounds of all chart objects (world coordinates). */
export function chartBounds(chart: ChartDocument): ChartBounds {
  const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  let any = false;

  const visit = (obj: ChartObject) => {
    any = true;
    if (obj.rotation) {
      const center = objectCenter(obj);
      const bounds = objectBounds(obj);
      const corners = [
        { x: bounds.x, y: bounds.y },
        { x: bounds.x + bounds.width, y: bounds.y },
        { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
        { x: bounds.x, y: bounds.y + bounds.height },
      ];
      const points = obj.type === "section" && obj.nestedRows
        ? [...corners, ...obj.nestedRows.flatMap((row) => row.seats)]
        : corners;
      const pad = obj.type === "row" ? 8 : 0;
      for (const point of points) {
        const rendered = rotateAround(point, center, obj.rotation);
        expandBounds(b, rendered.x, rendered.y, pad);
      }
      return;
    }
    switch (obj.type) {
      case "row":
        for (const point of obj.path ?? [obj.start, obj.end]) expandBounds(b, point.x, point.y, 8);
        for (const s of obj.seats) expandBounds(b, s.x, s.y, 6);
        break;
      case "section":
      case "area":
        for (const p of obj.points) expandBounds(b, p.x, p.y);
        if (obj.type === "section" && obj.nestedRows) {
          for (const row of obj.nestedRows) visit(row);
        }
        break;
      case "table":
        {
          const bounds = objectBounds(obj);
          expandBounds(b, bounds.x, bounds.y);
          expandBounds(b, bounds.x + bounds.width, bounds.y + bounds.height);
        }
        break;
      case "booth":
      case "rectangle":
      case "image":
        expandBounds(b, obj.x, obj.y);
        expandBounds(b, obj.x + obj.width, obj.y + obj.height);
        break;
      case "line":
        for (const point of obj.points ?? [obj.start, obj.end]) expandBounds(b, point.x, point.y);
        break;
      case "text":
      case "icon":
        expandBounds(b, obj.position.x, obj.position.y, 20);
        break;
    }
  };

  for (const obj of chart.objects) visit(obj);
  if (chart.focalPoint) {
    any = true;
    expandBounds(b, chart.focalPoint.x, chart.focalPoint.y, 12);
  }

  if (!any || !Number.isFinite(b.minX)) {
    return { minX: 0, minY: 0, maxX: 1000, maxY: 800, width: 1000, height: 800, centerX: 500, centerY: 400 };
  }

  const width = Math.max(b.maxX - b.minX, 1);
  const height = Math.max(b.maxY - b.minY, 1);
  return {
    ...b,
    width,
    height,
    centerX: (b.minX + b.maxX) / 2,
    centerY: (b.minY + b.maxY) / 2,
  };
}

/** Fit chart into the canvas with padding, centered. */
export function fitViewportToChart(
  chart: ChartDocument,
  viewWidth: number,
  viewHeight: number,
  padding = 48,
): Viewport {
  const bounds = chartBounds(chart);
  const availW = Math.max(viewWidth - padding * 2, 80);
  const availH = Math.max(viewHeight - padding * 2, 80);
  const zoom = Math.min(availW / bounds.width, availH / bounds.height, 2.5);
  const clamped = Math.max(0.12, Math.min(zoom, 2.5));
  return {
    zoom: clamped,
    x: viewWidth / 2 - bounds.centerX * clamped,
    y: viewHeight / 2 - bounds.centerY * clamped,
  };
}

export function countPlaces(chart: ChartDocument): number {
  let n = 0;
  const walk = (obj: ChartObject) => {
    // only count objects on active floor when multi-floor
    if (obj.floorId && obj.floorId !== chart.activeFloorId) return;
    if (obj.type === "row") n += obj.seats.length;
    else if (obj.type === "table") {
      if (obj.bookAsWhole) n += 1;
      else if (obj.variableOccupancy) n += obj.maxOccupancy ?? obj.seatCount;
      else n += obj.seats.length;
    } else if (obj.type === "booth") n += 1;
    else if (obj.type === "area") n += obj.capacity;
    else if (obj.type === "section") {
      if (obj.nestedRows) for (const row of obj.nestedRows) walk(row);
      else if (obj.capacity) n += obj.capacity;
    }
  };
  for (const obj of chart.objects) walk(obj);
  return n;
}

export function normalizeOverlay(
  value: ChartDocument["backgroundImage"],
): import("@/types/seat-chart").OverlayImage | undefined {
  if (!value) return undefined;
  if (typeof value === "string") {
    return { href: value, x: 0, y: 0, width: 1200, height: 900, opacity: 0.35 };
  }
  return value;
}

export function findObject(chart: ChartDocument, id: string): ChartObject | undefined {
  return chart.objects.find((o) => o.id === id);
}

export function isPlaceBearingObject(object: ChartObject): boolean {
  return object.type === "row"
    || object.type === "section"
    || object.type === "table"
    || object.type === "booth"
    || object.type === "area";
}

export function updateObject(
  chart: ChartDocument,
  id: string,
  patch: Partial<ChartObject>,
): ChartDocument {
  return {
    ...chart,
    objects: chart.objects.map((o) => (o.id === id ? ({ ...o, ...patch } as ChartObject) : o)),
  };
}

export function removeObjects(chart: ChartDocument, ids: readonly string[]): ChartDocument {
  const set = new Set(ids);
  return { ...chart, objects: chart.objects.filter((o) => !set.has(o.id) || o.locked) };
}

export function addObject(chart: ChartDocument, obj: ChartObject): ChartDocument {
  return { ...chart, objects: [...chart.objects, obj] };
}

export function duplicateObjects(chart: ChartDocument, ids: readonly string[], offset = 24): ChartDocument {
  const set = new Set(ids);
  const clones = cloneObjectsWithUniqueLabels(chart, chart.objects.filter((obj) => set.has(obj.id) && !obj.locked), offset);
  return { ...chart, objects: [...chart.objects, ...clones] };
}

function copyLabelKeys(objects: readonly ChartObject[]): readonly string[] {
  return objects.flatMap((object) => {
    const seatRoots = (object.type === "row" || object.type === "table")
      ? object.seats.map((seat) => seat.label.replace(/-\d+$/, ""))
      : [];
    const nested = object.type === "section" && object.nestedRows ? copyLabelKeys(object.nestedRows) : [];
    return [object.label, ...seatRoots, ...nested];
  });
}

export function cloneObjectsWithUniqueLabels(chart: ChartDocument, objects: readonly ChartObject[], d: number): readonly ChartObject[] {
  const normalize = (value: string) => value.trim().toLocaleLowerCase("ko-KR").replaceAll(/\s+/g, "");
  const used = new Set(copyLabelKeys(chart.objects).map(normalize));
  const nextLabel = (source: string) => {
    let candidate = `${source} 복사`;
    let copy = 2;
    while (used.has(normalize(candidate))) {
      candidate = `${source} 복사 ${copy}`;
      copy += 1;
    }
    used.add(normalize(candidate));
    return candidate;
  };
  return objects.map((object) => cloneObjectWithOffset(object, d, nextLabel));
}

export function cloneObjectWithOffset(obj: ChartObject, d: number, nextLabel: (source: string) => string = (source) => `${source} 복사`): ChartObject {
  const id = uid(obj.type);
  const label = nextLabel(obj.label);
  const cloneSeats = (seats: readonly import("@/types/seat-chart").SeatPlace[]) => seats.map((seat, index) => ({
    ...seat,
    id: uid("seat"),
    label: `${label}-${index + 1}`,
    x: seat.x + d,
    y: seat.y + d,
  }));
  switch (obj.type) {
    case "row":
      return {
        ...obj,
        id,
        label,
        start: { x: obj.start.x + d, y: obj.start.y + d },
        end: { x: obj.end.x + d, y: obj.end.y + d },
        path: obj.path?.map((point) => ({ x: point.x + d, y: point.y + d })),
        seats: cloneSeats(obj.seats),
      };
    case "section":
      return {
        ...obj,
        id,
        label,
        points: obj.points.map((p) => ({ x: p.x + d, y: p.y + d })),
        nestedRows: obj.nestedRows?.map((r) => cloneObjectWithOffset(r, d, nextLabel) as RowObject),
      };
    case "table":
      return {
        ...obj,
        id,
        label,
        center: { x: obj.center.x + d, y: obj.center.y + d },
        seats: cloneSeats(obj.seats),
      };
    case "booth":
    case "rectangle":
    case "image":
      return { ...obj, id, label, x: obj.x + d, y: obj.y + d, ...(obj.type === "rectangle" && obj.points ? { points: obj.points.map((point) => ({ x: point.x + d, y: point.y + d })) } : {}) };
    case "area":
      return {
        ...obj,
        id,
        label,
        points: obj.points.map((p) => ({ x: p.x + d, y: p.y + d })),
      };
    case "line":
      return {
        ...obj,
        id,
        label,
        start: { x: obj.start.x + d, y: obj.start.y + d },
        end: { x: obj.end.x + d, y: obj.end.y + d },
        points: obj.points?.map((point) => ({ x: point.x + d, y: point.y + d })),
      };
    case "text":
    case "icon":
      return {
        ...obj,
        id,
        label,
        position: { x: obj.position.x + d, y: obj.position.y + d },
      };
  }
}

export function flipObjects(
  chart: ChartDocument,
  ids: readonly string[],
  axis: "h" | "v",
  origin: Point,
): ChartDocument {
  const set = new Set(ids);
  return {
    ...chart,
    objects: chart.objects.map((obj) => {
      if (!set.has(obj.id) || obj.locked) return obj;
      return flipOne(obj, axis, origin);
    }),
  };
}

function flipOne(obj: ChartObject, axis: "h" | "v", origin: Point): ChartObject {
  const flipP = (p: Point): Point =>
    axis === "h"
      ? { x: origin.x - (p.x - origin.x), y: p.y }
      : { x: p.x, y: origin.y - (p.y - origin.y) };
  const rotation = obj.rotation === undefined ? undefined : ((-obj.rotation % 360) + 360) % 360;

  switch (obj.type) {
    case "row": {
      const start = flipP(obj.start);
      const end = flipP(obj.end);
      return {
        ...obj,
        rotation,
        start,
        end,
        path: obj.path?.map(flipP),
        seats: obj.seats.map((seat) => ({ ...seat, ...flipP(seat) })),
      };
    }
    case "section":
      return {
        ...obj,
        rotation,
        points: mirrorPoints(obj.points, axis, origin),
        nestedRows: obj.nestedRows?.map((r) => flipOne(r, axis, origin) as RowObject),
      };
    case "table": {
      const center = flipP(obj.center);
      return {
        ...obj,
        rotation,
        center,
        seats: obj.seats.map((seat) => ({ ...seat, ...flipP(seat) })),
      };
    }
    case "booth":
    case "rectangle":
    case "image": {
      const c = flipP({ x: obj.x + obj.width / 2, y: obj.y + obj.height / 2 });
      return { ...obj, rotation, x: c.x - obj.width / 2, y: c.y - obj.height / 2, ...(obj.type === "rectangle" && obj.points ? { points: obj.points.map(flipP) } : {}) };
    }
    case "area":
      return { ...obj, rotation, points: mirrorPoints(obj.points, axis, origin) };
    case "line":
      return { ...obj, rotation, start: flipP(obj.start), end: flipP(obj.end), points: obj.points?.map(flipP) };
    case "text":
    case "icon":
      return { ...obj, rotation, position: flipP(obj.position) };
    default:
      return obj;
  }
}

export function alignCenter(chart: ChartDocument, ids: readonly string[]): ChartDocument {
  const set = new Set(ids);
  const selected = chart.objects.filter((o) => set.has(o.id) && !o.locked);
  if (selected.length < 2) return chart;
  // Align midpoints of bounding boxes to average center X
  const centers = selected.map(objectCenter);
  const avgX = centers.reduce((s, c) => s + c.x, 0) / centers.length;
  return {
    ...chart,
    objects: chart.objects.map((obj) => {
      if (!set.has(obj.id) || obj.locked) return obj;
      const c = objectCenter(obj);
      const dx = avgX - c.x;
      return translateObject(obj, dx, 0);
    }),
  };
}

export function objectCenter(obj: ChartObject): Point {
  switch (obj.type) {
    case "row":
      if (obj.path?.length) {
        return { x: obj.path.reduce((sum, point) => sum + point.x, 0) / obj.path.length, y: obj.path.reduce((sum, point) => sum + point.y, 0) / obj.path.length };
      }
      return { x: (obj.start.x + obj.end.x) / 2, y: (obj.start.y + obj.end.y) / 2 };
    case "table":
      return obj.center;
    case "booth":
    case "rectangle":
    case "image":
      return { x: obj.x + obj.width / 2, y: obj.y + obj.height / 2 };
    case "section":
    case "area": {
      const sx = obj.points.reduce((s, p) => s + p.x, 0) / Math.max(obj.points.length, 1);
      const sy = obj.points.reduce((s, p) => s + p.y, 0) / Math.max(obj.points.length, 1);
      return { x: sx, y: sy };
    }
    case "line":
      if (obj.points?.length) {
        return { x: obj.points.reduce((sum, point) => sum + point.x, 0) / obj.points.length, y: obj.points.reduce((sum, point) => sum + point.y, 0) / obj.points.length };
      }
      return { x: (obj.start.x + obj.end.x) / 2, y: (obj.start.y + obj.end.y) / 2 };
    case "text":
    case "icon":
      return obj.position;
    default:
      return { x: 0, y: 0 };
  }
}

export function translateObject(obj: ChartObject, dx: number, dy: number): ChartObject {
  const t = (p: Point): Point => ({ x: p.x + dx, y: p.y + dy });
  switch (obj.type) {
    case "row": {
      const start = t(obj.start);
      const end = t(obj.end);
      return {
        ...obj,
        start,
        end,
        path: obj.path?.map(t),
        seats: obj.seats.map((seat) => ({ ...seat, ...t(seat) })),
      };
    }
    case "section":
      return {
        ...obj,
        points: obj.points.map(t),
        nestedRows: obj.nestedRows?.map((r) => translateObject(r, dx, dy) as RowObject),
      };
    case "table": {
      const center = t(obj.center);
      return {
        ...obj,
        center,
        seats: obj.seats.map((seat) => ({ ...seat, ...t(seat) })),
      };
    }
    case "booth":
    case "rectangle":
    case "image":
      return { ...obj, x: obj.x + dx, y: obj.y + dy, ...(obj.type === "rectangle" && obj.points ? { points: obj.points.map(t) } : {}) };
    case "area":
      return { ...obj, points: obj.points.map(t) };
    case "line":
      return { ...obj, start: t(obj.start), end: t(obj.end), points: obj.points?.map(t) };
    case "text":
    case "icon":
      return { ...obj, position: t(obj.position) };
    default:
      return obj;
  }
}

export function createRow(
  start: Point,
  end: Point,
  seatCount: number,
  label: string,
  categoryKey?: string,
  curve = 0,
): RowObject {
  return {
    id: uid("row"),
    type: "row",
    label,
    layer: "interactive",
    categoryKey,
    start,
    end,
    seatCount,
    curve,
    seats: seatsAlongLine(start, end, seatCount, label, curve, categoryKey),
  };
}

export function createSection(
  points: readonly Point[],
  label: string,
  categoryKey?: string,
  fill?: string,
  nestedRows?: readonly RowObject[],
): SectionObject {
  return {
    id: uid("section"),
    type: "section",
    label,
    layer: "interactive",
    categoryKey,
    points: [...points],
    fill,
    nestedRows,
  };
}

export function createTable(
  center: Point,
  radius: number,
  seatCount: number,
  label: string,
  categoryKey?: string,
): TableObject {
  return {
    id: uid("table"),
    type: "table",
    label,
    layer: "interactive",
    categoryKey,
    center,
    radius,
    seatCount,
    seats: seatsAroundTable(center, radius, seatCount, label, categoryKey),
  };
}

export function applyCategory(
  chart: ChartDocument,
  ids: readonly string[],
  categoryKey: string,
): ChartDocument {
  const set = new Set(ids);
  return {
    ...chart,
    objects: chart.objects.map((obj) => {
      if (!set.has(obj.id) || obj.locked) return obj;
      if (obj.type === "row") {
        return {
          ...obj,
          categoryKey,
          seats: obj.seats.map((s) => ({ ...s, categoryKey })),
        };
      }
      if (obj.type === "table") {
        return {
          ...obj,
          categoryKey,
          seats: obj.seats.map((s) => ({ ...s, categoryKey })),
        };
      }
      if (obj.type === "section") {
        return {
          ...obj,
          categoryKey,
          nestedRows: obj.nestedRows?.map((r) => ({
            ...r,
            categoryKey,
            seats: r.seats.map((s) => ({ ...s, categoryKey })),
          })),
        };
      }
      return { ...obj, categoryKey };
    }),
  };
}

export function setObjectLabel(chart: ChartDocument, id: string, label: string): ChartDocument {
  if (findObject(chart, id)?.locked) return chart;
  return updateObject(chart, id, { label } as Partial<ChartObject>);
}

export type TablePatch = {
    seatCount?: number;
    radius?: number;
    bookAsWhole?: boolean;
    variableOccupancy?: boolean;
    minOccupancy?: number;
    maxOccupancy?: number;
    width?: number;
    height?: number;
    chairs?: NonNullable<TableObject["chairs"]>;
    label?: string;
    displayedLabel?: string;
    viewFromSeatHref?: string | null;
};

export function setTableProps(
  chart: ChartDocument,
  id: string,
  patch: TablePatch,
): ChartDocument {
  const obj = findObject(chart, id);
  if (!obj || obj.type !== "table" || obj.locked) return chart;
  const numericValues = [patch.seatCount, patch.radius, patch.minOccupancy, patch.maxOccupancy, patch.width, patch.height].filter((value) => value !== undefined);
  if (numericValues.some((value) => !Number.isFinite(value))) return chart;
  const seatCount = Math.max(1, Math.min(48, patch.seatCount ?? obj.seatCount));
  const radius = Math.max(8, patch.radius ?? obj.radius);
  const label = patch.label ?? obj.label;
  const width = Math.max(20, patch.width ?? obj.width ?? 120);
  const height = Math.max(20, patch.height ?? obj.height ?? 36);
  const inputChairs = patch.chairs ?? obj.chairs ?? { top: 4, right: 0, bottom: 4, left: 0 };
  const normalizeChairCount = (value: number) => Math.max(0, Math.min(24, Math.round(value)));
  const chairs = {
    top: normalizeChairCount(inputChairs.top),
    right: normalizeChairCount(inputChairs.right),
    bottom: normalizeChairCount(inputChairs.bottom),
    left: normalizeChairCount(inputChairs.left),
  };
  const rectangularSeatCount = chairs.top + chairs.right + chairs.bottom + chairs.left;
  const variableOccupancy = patch.variableOccupancy ?? obj.variableOccupancy;
  const finalSeatCount = Math.max(1, obj.shape === "rectangle" ? rectangularSeatCount : seatCount);
  const minOccupancy = Math.min(finalSeatCount, Math.max(1, patch.minOccupancy ?? obj.minOccupancy ?? 1));
  const maxOccupancy = patch.maxOccupancy !== undefined
    ? Math.min(finalSeatCount, Math.max(minOccupancy, patch.maxOccupancy))
    : obj.maxOccupancy !== undefined
      ? Math.min(finalSeatCount, Math.max(minOccupancy, obj.maxOccupancy))
      : undefined;
  const generatedSeats = obj.shape === "rectangle"
    ? seatsAroundRectangularTable(obj.center, width, height, chairs, label, obj.categoryKey)
    : seatsAroundTable(obj.center, radius, seatCount, label, obj.categoryKey);
  const previousChairs = obj.chairs ?? { top: 4, right: 0, bottom: 4, left: 0 };
  const geometryChanged = obj.shape === "rectangle"
    ? width !== (obj.width ?? 120) || height !== (obj.height ?? 36) || Object.keys(chairs).some((side) => chairs[side as keyof typeof chairs] !== previousChairs[side as keyof typeof chairs])
    : radius !== obj.radius || seatCount !== obj.seatCount;
  const rectangularSeats = () => {
    const sides = ["top", "right", "bottom", "left"] as const;
    let previousOffset = 0;
    let nextOffset = 0;
    return sides.flatMap((side) => {
      const mapped = generatedSeats.slice(nextOffset, nextOffset + chairs[side]).map((seat, index) => {
        const previous = index < previousChairs[side] ? obj.seats[previousOffset + index] : undefined;
        return previous ? { ...previous, label: seat.label, x: seat.x, y: seat.y } : seat;
      });
      previousOffset += previousChairs[side];
      nextOffset += chairs[side];
      return mapped;
    });
  };
  const seats = geometryChanged
    ? obj.shape === "rectangle" ? rectangularSeats() : generatedSeats.map((seat, index) => obj.seats[index] ? { ...obj.seats[index], x: seat.x, y: seat.y } : seat)
    : obj.seats;
  return updateObject(chart, id, {
    radius,
    label,
    bookAsWhole: patch.bookAsWhole ?? obj.bookAsWhole,
    variableOccupancy,
    minOccupancy,
    maxOccupancy,
    displayedLabel: patch.displayedLabel ?? obj.displayedLabel,
    viewFromSeatHref:
      patch.viewFromSeatHref === null ? undefined : (patch.viewFromSeatHref ?? obj.viewFromSeatHref),
    width,
    height,
    chairs,
    seatCount: obj.shape === "rectangle" ? rectangularSeatCount : seatCount,
    seats,
  });
}

export function setObjectAdvanced(
  chart: ChartDocument,
  id: string,
  patch: {
    label?: string;
    displayedLabel?: string;
    viewFromSeatHref?: string | null;
    zoneId?: string | null;
    floorId?: string | null;
    locked?: boolean;
    layer?: ChartObject["layer"];
    rotation?: number;
  },
): ChartDocument {
  const obj = findObject(chart, id);
  if (!obj || (obj.locked && patch.locked !== false)) return chart;
  return updateObject(chart, id, {
    label: patch.label ?? obj.label,
    displayedLabel: patch.displayedLabel ?? obj.displayedLabel,
    viewFromSeatHref:
      patch.viewFromSeatHref === null ? undefined : (patch.viewFromSeatHref ?? obj.viewFromSeatHref),
    zoneId: patch.zoneId === null ? undefined : (patch.zoneId ?? obj.zoneId),
    floorId: patch.floorId === null ? undefined : (patch.floorId ?? obj.floorId),
    locked: patch.locked ?? obj.locked,
    layer: isPlaceBearingObject(obj) ? "interactive" : (patch.layer ?? obj.layer),
    rotation: Number.isFinite(patch.rotation) ? patch.rotation : obj.rotation,
  } as Partial<ChartObject>);
}

export function setRowGeometry(
  chart: ChartDocument,
  id: string,
  patch: { seatCount?: number; curve?: number; label?: string; smooth?: number; displayedLabel?: string },
): ChartDocument {
  const obj = findObject(chart, id);
  if (!obj || obj.type !== "row" || obj.locked) return chart;
  const numericValues = [patch.seatCount, patch.curve, patch.smooth].filter((value) => value !== undefined);
  if (numericValues.some((value) => !Number.isFinite(value))) return chart;
  const seatCount = Math.max(1, Math.min(200, patch.seatCount ?? obj.seatCount));
  const curve = patch.curve ?? obj.curve ?? 0;
  const label = patch.label ?? obj.label;
  const geometryChanged = seatCount !== obj.seatCount || label !== obj.label || (!obj.path?.length && curve !== (obj.curve ?? 0));
  const generatedSeats = obj.path?.length
    ? seatsAlongPolyline(obj.path, seatCount, label, obj.categoryKey)
    : seatsAlongLine(obj.start, obj.end, seatCount, label, curve, obj.categoryKey);
  const seats = geometryChanged
    ? generatedSeats.map((seat, index) => obj.seats[index]
      ? { ...obj.seats[index], label: seat.label, x: seat.x, y: seat.y }
      : seat)
    : obj.seats;
  return updateObject(chart, id, {
    seatCount,
    curve,
    label,
    smooth: patch.smooth ?? obj.smooth,
    displayedLabel: patch.displayedLabel ?? obj.displayedLabel,
    seats,
  });
}

export function setAreaCapacity(chart: ChartDocument, id: string, capacity: number): ChartDocument {
  const obj = findObject(chart, id);
  if (!obj || obj.type !== "area" || obj.locked) return chart;
  if (!Number.isFinite(capacity)) return chart;
  return updateObject(chart, id, { capacity: Math.max(1, Math.floor(capacity)) });
}

export type DecorationPatch = {
  readonly width?: number;
  readonly height?: number;
  readonly fill?: string;
  readonly stroke?: string;
  readonly rotation?: number;
  readonly text?: string;
  readonly fontSize?: number;
  readonly color?: string;
  readonly opacity?: number;
  readonly icon?: "stage" | "entrance" | "wc" | "star";
  readonly size?: number;
  readonly weight?: 400 | 500 | 600 | 700;
  readonly align?: "left" | "center" | "right";
};

export function setDecorationProps(chart: ChartDocument, id: string, patch: DecorationPatch): ChartDocument {
  const object = findObject(chart, id);
  if (!object || object.locked) return chart;
  const numeric = [patch.width, patch.height, patch.rotation, patch.fontSize, patch.opacity, patch.size].filter((value) => value !== undefined);
  if (numeric.some((value) => !Number.isFinite(value))) return chart;
  let next: ChartObject;
  if (object.type === "rectangle") {
    const width = Math.max(1, patch.width ?? object.width);
    const height = Math.max(1, patch.height ?? object.height);
    if (object.shape === "polygon" && object.points?.length) {
      const resized = resizeObject(object, { x: objectBounds(object).x, y: objectBounds(object).y, width, height });
      next = resized.type === "rectangle"
        ? { ...resized, fill: patch.fill ?? object.fill, stroke: patch.stroke ?? object.stroke, rotation: patch.rotation ?? object.rotation }
        : object;
    } else {
      next = { ...object, width, height, fill: patch.fill ?? object.fill, stroke: patch.stroke ?? object.stroke, rotation: patch.rotation ?? object.rotation };
    }
  }
  else if (object.type === "booth") next = { ...object, width: Math.max(1, patch.width ?? object.width), height: Math.max(1, patch.height ?? object.height), rotation: patch.rotation ?? object.rotation };
  else if (object.type === "line") next = { ...object, stroke: patch.stroke ?? object.stroke, rotation: patch.rotation ?? object.rotation };
  else if (object.type === "text") next = { ...object, text: patch.text ?? object.text, fontSize: Math.max(6, patch.fontSize ?? object.fontSize ?? 16), color: patch.color ?? object.color, weight: patch.weight ?? object.weight, align: patch.align ?? object.align, rotation: patch.rotation ?? object.rotation };
  else if (object.type === "image") next = { ...object, width: Math.max(1, patch.width ?? object.width), height: Math.max(1, patch.height ?? object.height), opacity: Math.max(0.05, Math.min(1, patch.opacity ?? object.opacity ?? 1)), rotation: patch.rotation ?? object.rotation };
  else if (object.type === "icon") next = { ...object, icon: patch.icon ?? object.icon, size: Math.max(8, patch.size ?? object.size ?? 40), color: patch.color ?? object.color, rotation: patch.rotation ?? object.rotation };
  else return chart;
  return { ...chart, objects: chart.objects.map((candidate) => candidate.id === id ? next : candidate) };
}

export function setPolygonPoint(
  chart: ChartDocument,
  id: string,
  pointIndex: number,
  point: Point,
): ChartDocument {
  const obj = findObject(chart, id);
  if (!obj || obj.locked || (obj.type !== "section" && obj.type !== "area")) return chart;
  if (pointIndex < 0 || pointIndex >= obj.points.length) return chart;
  const points = obj.points.map((p, i) => (i === pointIndex ? point : p));
  return updateObject(chart, id, { points });
}

export function setRowEndpoints(
  chart: ChartDocument,
  id: string,
  start: Point,
  end: Point,
): ChartDocument {
  const obj = findObject(chart, id);
  if (!obj || obj.type !== "row" || obj.locked) return chart;
  return updateObject(chart, id, {
    start,
    end,
    seats: seatsAlongLine(start, end, obj.seatCount, obj.label, obj.curve, obj.categoryKey),
  });
}

export function translateMany(
  chart: ChartDocument,
  ids: readonly string[],
  dx: number,
  dy: number,
): ChartDocument {
  const set = new Set(ids);
  return {
    ...chart,
    objects: chart.objects.map((obj) => (set.has(obj.id) && !obj.locked ? translateObject(obj, dx, dy) : obj)),
  };
}
