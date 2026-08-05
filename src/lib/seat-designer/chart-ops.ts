import type {
  ChartDocument,
  ChartObject,
  Point,
  RowObject,
  SectionObject,
  TableObject,
  Viewport,
} from "@/types/seat-chart";
import { mirrorPoints, seatsAlongLine, seatsAroundTable, uid } from "./geometry";

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
    switch (obj.type) {
      case "row":
        expandBounds(b, obj.start.x, obj.start.y, 8);
        expandBounds(b, obj.end.x, obj.end.y, 8);
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
        expandBounds(b, obj.center.x, obj.center.y, obj.radius + 20);
        break;
      case "booth":
      case "rectangle":
      case "image":
        expandBounds(b, obj.x, obj.y);
        expandBounds(b, obj.x + obj.width, obj.y + obj.height);
        break;
      case "line":
        expandBounds(b, obj.start.x, obj.start.y);
        expandBounds(b, obj.end.x, obj.end.y);
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
  return { ...chart, objects: chart.objects.filter((o) => !set.has(o.id)) };
}

export function addObject(chart: ChartDocument, obj: ChartObject): ChartDocument {
  return { ...chart, objects: [...chart.objects, obj] };
}

export function duplicateObjects(chart: ChartDocument, ids: readonly string[], offset = 24): ChartDocument {
  const set = new Set(ids);
  const clones: ChartObject[] = [];
  for (const obj of chart.objects) {
    if (!set.has(obj.id)) continue;
    clones.push(cloneOffset(obj, offset));
  }
  return { ...chart, objects: [...chart.objects, ...clones] };
}

function cloneOffset(obj: ChartObject, d: number): ChartObject {
  const id = uid(obj.type);
  const label = `${obj.label} 복사`;
  switch (obj.type) {
    case "row":
      return {
        ...obj,
        id,
        label,
        start: { x: obj.start.x + d, y: obj.start.y + d },
        end: { x: obj.end.x + d, y: obj.end.y + d },
        seats: seatsAlongLine(
          { x: obj.start.x + d, y: obj.start.y + d },
          { x: obj.end.x + d, y: obj.end.y + d },
          obj.seatCount,
          label,
          obj.curve,
          obj.categoryKey,
        ),
      };
    case "section":
      return {
        ...obj,
        id,
        label,
        points: obj.points.map((p) => ({ x: p.x + d, y: p.y + d })),
        nestedRows: obj.nestedRows?.map((r) => cloneOffset(r, d) as RowObject),
      };
    case "table":
      return {
        ...obj,
        id,
        label,
        center: { x: obj.center.x + d, y: obj.center.y + d },
        seats: seatsAroundTable(
          { x: obj.center.x + d, y: obj.center.y + d },
          obj.radius,
          obj.seatCount,
          label,
          obj.categoryKey,
        ),
      };
    case "booth":
    case "rectangle":
    case "image":
      return { ...obj, id, label, x: obj.x + d, y: obj.y + d };
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
      if (!set.has(obj.id)) return obj;
      return flipOne(obj, axis, origin);
    }),
  };
}

function flipOne(obj: ChartObject, axis: "h" | "v", origin: Point): ChartObject {
  const flipP = (p: Point): Point =>
    axis === "h"
      ? { x: origin.x - (p.x - origin.x), y: p.y }
      : { x: p.x, y: origin.y - (p.y - origin.y) };

  switch (obj.type) {
    case "row": {
      const start = flipP(obj.start);
      const end = flipP(obj.end);
      return {
        ...obj,
        start,
        end,
        seats: seatsAlongLine(start, end, obj.seatCount, obj.label, obj.curve, obj.categoryKey),
      };
    }
    case "section":
      return {
        ...obj,
        points: mirrorPoints(obj.points, axis, origin),
        nestedRows: obj.nestedRows?.map((r) => flipOne(r, axis, origin) as RowObject),
      };
    case "table": {
      const center = flipP(obj.center);
      return {
        ...obj,
        center,
        seats: seatsAroundTable(center, obj.radius, obj.seatCount, obj.label, obj.categoryKey),
      };
    }
    case "booth":
    case "rectangle":
    case "image": {
      const c = flipP({ x: obj.x + obj.width / 2, y: obj.y + obj.height / 2 });
      return { ...obj, x: c.x - obj.width / 2, y: c.y - obj.height / 2 };
    }
    case "area":
      return { ...obj, points: mirrorPoints(obj.points, axis, origin) };
    case "line":
      return { ...obj, start: flipP(obj.start), end: flipP(obj.end) };
    case "text":
    case "icon":
      return { ...obj, position: flipP(obj.position) };
    default:
      return obj;
  }
}

export function alignCenter(chart: ChartDocument, ids: readonly string[]): ChartDocument {
  const set = new Set(ids);
  const selected = chart.objects.filter((o) => set.has(o.id));
  if (selected.length < 2) return chart;
  // Align midpoints of bounding boxes to average center X
  const centers = selected.map(objectCenter);
  const avgX = centers.reduce((s, c) => s + c.x, 0) / centers.length;
  return {
    ...chart,
    objects: chart.objects.map((obj) => {
      if (!set.has(obj.id)) return obj;
      const c = objectCenter(obj);
      const dx = avgX - c.x;
      return translateObject(obj, dx, 0);
    }),
  };
}

export function objectCenter(obj: ChartObject): Point {
  switch (obj.type) {
    case "row":
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
        seats: seatsAlongLine(start, end, obj.seatCount, obj.label, obj.curve, obj.categoryKey),
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
        seats: seatsAroundTable(center, obj.radius, obj.seatCount, obj.label, obj.categoryKey),
      };
    }
    case "booth":
    case "rectangle":
    case "image":
      return { ...obj, x: obj.x + dx, y: obj.y + dy };
    case "area":
      return { ...obj, points: obj.points.map(t) };
    case "line":
      return { ...obj, start: t(obj.start), end: t(obj.end) };
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
      if (!set.has(obj.id)) return obj;
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
  return updateObject(chart, id, { label } as Partial<ChartObject>);
}

export function setTableProps(
  chart: ChartDocument,
  id: string,
  patch: {
    seatCount?: number;
    radius?: number;
    bookAsWhole?: boolean;
    variableOccupancy?: boolean;
    minOccupancy?: number;
    maxOccupancy?: number;
    label?: string;
    displayedLabel?: string;
    viewFromSeatHref?: string | null;
  },
): ChartDocument {
  const obj = findObject(chart, id);
  if (!obj || obj.type !== "table") return chart;
  const seatCount = Math.max(1, Math.min(48, patch.seatCount ?? obj.seatCount));
  const radius = Math.max(8, patch.radius ?? obj.radius);
  const label = patch.label ?? obj.label;
  const variableOccupancy = patch.variableOccupancy ?? obj.variableOccupancy;
  const minOccupancy = Math.max(1, patch.minOccupancy ?? obj.minOccupancy ?? 1);
  const maxOccupancy = Math.max(minOccupancy, patch.maxOccupancy ?? obj.maxOccupancy ?? seatCount);
  return updateObject(chart, id, {
    seatCount,
    radius,
    label,
    bookAsWhole: patch.bookAsWhole ?? obj.bookAsWhole,
    variableOccupancy,
    minOccupancy,
    maxOccupancy,
    displayedLabel: patch.displayedLabel ?? obj.displayedLabel,
    viewFromSeatHref:
      patch.viewFromSeatHref === null ? undefined : (patch.viewFromSeatHref ?? obj.viewFromSeatHref),
    seats: seatsAroundTable(obj.center, radius, seatCount, label, obj.categoryKey),
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
  },
): ChartDocument {
  const obj = findObject(chart, id);
  if (!obj) return chart;
  return updateObject(chart, id, {
    label: patch.label ?? obj.label,
    displayedLabel: patch.displayedLabel ?? obj.displayedLabel,
    viewFromSeatHref:
      patch.viewFromSeatHref === null ? undefined : (patch.viewFromSeatHref ?? obj.viewFromSeatHref),
    zoneId: patch.zoneId === null ? undefined : (patch.zoneId ?? obj.zoneId),
    floorId: patch.floorId === null ? undefined : (patch.floorId ?? obj.floorId),
    locked: patch.locked ?? obj.locked,
  } as Partial<ChartObject>);
}

export function setRowGeometry(
  chart: ChartDocument,
  id: string,
  patch: { seatCount?: number; curve?: number; label?: string; smooth?: number; displayedLabel?: string },
): ChartDocument {
  const obj = findObject(chart, id);
  if (!obj || obj.type !== "row") return chart;
  const seatCount = Math.max(1, Math.min(200, patch.seatCount ?? obj.seatCount));
  const curve = patch.curve ?? obj.curve ?? 0;
  const label = patch.label ?? obj.label;
  return updateObject(chart, id, {
    seatCount,
    curve,
    label,
    smooth: patch.smooth ?? obj.smooth,
    displayedLabel: patch.displayedLabel ?? obj.displayedLabel,
    seats: seatsAlongLine(obj.start, obj.end, seatCount, label, curve, obj.categoryKey),
  });
}

export function setAreaCapacity(chart: ChartDocument, id: string, capacity: number): ChartDocument {
  const obj = findObject(chart, id);
  if (!obj || obj.type !== "area") return chart;
  return updateObject(chart, id, { capacity: Math.max(1, Math.floor(capacity)) });
}

export function setPolygonPoint(
  chart: ChartDocument,
  id: string,
  pointIndex: number,
  point: Point,
): ChartDocument {
  const obj = findObject(chart, id);
  if (!obj || (obj.type !== "section" && obj.type !== "area")) return chart;
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
  if (!obj || obj.type !== "row") return chart;
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
    objects: chart.objects.map((obj) => (set.has(obj.id) ? translateObject(obj, dx, dy) : obj)),
  };
}
