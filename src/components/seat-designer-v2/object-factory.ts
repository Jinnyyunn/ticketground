import type { AreaObject, ChartDocument, ChartObject, IconObject, Point, RowObject, SeatPlace, TableObject } from "@/types/seat-chart";
import type { V2EditorState, V2Point } from "./editor-model";
import type { V2ToolId } from "./tool-catalog";

const DEFAULT_CATEGORY = { key: "general", label: "일반석", color: "#7b8a9a" } as const;
const MIN_SIZE = 8;

function uid(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function rect(start: V2Point, end: V2Point) {
  return { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.max(MIN_SIZE, Math.abs(end.x - start.x)), height: Math.max(MIN_SIZE, Math.abs(end.y - start.y)) };
}

function rowSeats(start: V2Point, end: V2Point, spacing: number, rowId: string): readonly SeatPlace[] {
  const count = Math.max(2, Math.floor(Math.hypot(end.x - start.x, end.y - start.y) / Math.max(12, 10 + spacing)) + 1);
  return Array.from({ length: count }, (_, index) => {
    const progress = index / (count - 1);
    return { id: `${rowId}_seat_${index + 1}`, label: `${index + 1}`, x: start.x + (end.x - start.x) * progress, y: start.y + (end.y - start.y) * progress, categoryKey: DEFAULT_CATEGORY.key };
  });
}

function roundTableSeats(center: V2Point, radius: number, count: number, tableId: string): readonly SeatPlace[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / count;
    return { id: `${tableId}_seat_${index + 1}`, label: `${index + 1}`, x: center.x + Math.cos(angle) * (radius + 12), y: center.y + Math.sin(angle) * (radius + 12), categoryKey: DEFAULT_CATEGORY.key };
  });
}

function rectangularTableSeats(
  center: V2Point,
  width: number,
  height: number,
  chairs: NonNullable<TableObject["chairs"]>,
  tableId: string,
): readonly SeatPlace[] {
  const seats: SeatPlace[] = [];
  const addSide = (count: number, side: "top" | "right" | "bottom" | "left") => {
    for (let index = 0; index < count; index += 1) {
      const progress = (index + 1) / (count + 1);
      const horizontal = side === "top" || side === "bottom";
      const x = horizontal
        ? center.x - width / 2 + width * progress
        : center.x + (side === "right" ? width / 2 + 12 : -width / 2 - 12);
      const y = horizontal
        ? center.y + (side === "bottom" ? height / 2 + 12 : -height / 2 - 12)
        : center.y - height / 2 + height * progress;
      seats.push({ id: `${tableId}_seat_${seats.length + 1}`, label: `${seats.length + 1}`, x, y, categoryKey: DEFAULT_CATEGORY.key });
    }
  };
  addSide(chairs.top, "top");
  addSide(chairs.right, "right");
  addSide(chairs.bottom, "bottom");
  addSide(chairs.left, "left");
  return seats;
}

export function updateTableGeometry(
  table: TableObject,
  patch: Partial<Pick<TableObject, "radius" | "width" | "height" | "chairs" | "seatCount">>,
): TableObject {
  const next = { ...table, ...patch };
  const width = Math.max(24, next.width ?? 120);
  const height = Math.max(24, next.height ?? 36);
  if (next.shape === "rectangle") {
    const chairs = next.chairs ?? { top: 4, right: 0, bottom: 4, left: 0 };
    const seats = rectangularTableSeats(next.center, width, height, chairs, next.id);
    return { ...next, width, height, chairs, seatCount: seats.length, seats };
  }
  const seatCount = Math.max(1, next.seatCount);
  const radius = Math.max(12, next.radius);
  return { ...next, radius, seatCount, seats: roundTableSeats(next.center, radius, seatCount, next.id) };
}

export function createDraggedObject(tool: V2ToolId, start: V2Point, end: V2Point, state: Pick<V2EditorState, "seatSpacing" | "objects">): ChartObject | null {
  const box = rect(start, end);
  const common = { id: uid(tool), label: `${tool}-${state.objects.length + 1}`, layer: "interactive" as const, categoryKey: DEFAULT_CATEGORY.key };
  if (tool === "row" || tool === "multipleRows") {
    const id = uid("row");
    const seats = rowSeats(start, end, state.seatSpacing, id);
    return { ...common, id, type: "row", start, end, seatCount: seats.length, seats, rowStyle: tool === "multipleRows" ? "multiple" : "straight", rowSpacing: 14, seatSpacing: state.seatSpacing } satisfies RowObject;
  }
  if (tool === "rectangle" || tool === "ellipse") return { ...common, type: "rectangle", ...box, shape: tool, fill: "#d9dfe5", stroke: "#6b7280", opacity: 0.68 };
  if (tool === "rectangularArea" || tool === "ellipticArea") return { ...common, type: "area", points: [{ x: box.x, y: box.y }, { x: box.x + box.width, y: box.y }, { x: box.x + box.width, y: box.y + box.height }, { x: box.x, y: box.y + box.height }], capacity: 1, shape: tool === "rectangularArea" ? "rectangle" : "ellipse" } satisfies AreaObject;
  if (tool === "booth") return { ...common, type: "booth", ...box };
  if (tool === "line") return { ...common, type: "line", start, end, stroke: "#5b6570", points: [start, end] };
  return null;
}

export function createPointObject(tool: V2ToolId, point: V2Point, objectCount: number): ChartObject | null {
  const common = { id: uid(tool), label: `${tool}-${objectCount + 1}`, layer: "interactive" as const, categoryKey: DEFAULT_CATEGORY.key };
  if (tool === "booth") return { ...common, type: "booth", x: point.x - 25, y: point.y - 25, width: 50, height: 50 };
  if (tool === "roundTable" || tool === "rectangularTable") {
    const id = uid("table");
    const round = tool === "roundTable";
    const table = { ...common, id, type: "table", center: point, radius: round ? 28 : 18, seatCount: round ? 6 : 8, seats: [], shape: round ? "round" : "rectangle", width: round ? 56 : 120, height: round ? 56 : 36, chairs: round ? undefined : { top: 4, right: 0, bottom: 4, left: 0 } } satisfies TableObject;
    return updateTableGeometry(table, {});
  }
  if (tool === "text") return { ...common, type: "text", position: point, text: "텍스트", fontSize: 18, color: "#333333", weight: 500, align: "center" };
  if (tool === "icon") return { ...common, type: "icon", position: point, icon: "people", size: 40, color: "#495057" } satisfies IconObject;
  return null;
}

export function createPathObject(tool: V2ToolId, points: readonly Point[], objectCount: number): ChartObject | null {
  if (points.length < 2) return null;
  const common = { id: uid(tool), label: `${tool}-${objectCount + 1}`, layer: "interactive" as const, categoryKey: DEFAULT_CATEGORY.key };
  if (tool === "section") return points.length >= 3 ? { ...common, type: "section", points, fill: "#d9e9f8", capacity: 0 } : null;
  if (tool === "segmentedRow") {
    const id = uid("row");
    const seats = points.slice(0, -1).flatMap((point, index) => rowSeats(point, points[index + 1] ?? point, 5, `${id}_${index}`)).filter((seat, index, all) => index === 0 || Math.hypot(seat.x - (all[index - 1]?.x ?? seat.x), seat.y - (all[index - 1]?.y ?? seat.y)) > 2).map((seat, index) => ({ ...seat, label: `${index + 1}` }));
    return { ...common, id, type: "row", start: points[0] ?? { x: 0, y: 0 }, end: points.at(-1) ?? { x: 0, y: 0 }, seatCount: seats.length, seats, path: points, rowStyle: "segmented", rowSpacing: 14, seatSpacing: 5 } satisfies RowObject;
  }
  if (tool === "polygonalArea") return points.length >= 3 ? { ...common, type: "area", points, capacity: 1, shape: "polygon" } : null;
  if (tool === "polygon") {
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    return points.length >= 3 ? { ...common, type: "rectangle", x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys), shape: "polygon", points, fill: "#d9dfe5", stroke: "#6b7280" } : null;
  }
  if (tool === "line") return { ...common, type: "line", start: points[0] ?? { x: 0, y: 0 }, end: points.at(-1) ?? { x: 0, y: 0 }, points, stroke: "#5b6570" };
  return null;
}

export function chartDocument(state: V2EditorState): ChartDocument {
  return {
    id: state.chartId,
    name: state.name,
    categories: [DEFAULT_CATEGORY],
    objects: state.objects,
    floors: [{ id: "floor_1", name: "1층", index: 1 }],
    activeFloorId: "floor_1",
    focalPoint: state.focalPoint ?? undefined,
    referenceChart: state.referencePlan ? { href: state.referencePlan.href, x: state.referencePlan.x, y: state.referencePlan.y, width: state.referencePlan.width, height: state.referencePlan.height, opacity: state.referencePlan.opacity, locked: state.referencePlan.locked } : undefined,
    assets: state.assets,
    venueType: "sectionsAndFloors",
    zones: [],
  };
}

export function boundsContains(object: ChartObject, point: Point): boolean {
  if (object.type === "row") return object.seats.some((seat) => Math.hypot(seat.x - point.x, seat.y - point.y) <= 10);
  if (object.type === "table") return Math.hypot(object.center.x - point.x, object.center.y - point.y) <= object.radius + 20;
  if (object.type === "text" || object.type === "icon") return Math.hypot(object.position.x - point.x, object.position.y - point.y) <= 30;
  if (object.type === "booth" || object.type === "image" || object.type === "rectangle") return point.x >= object.x && point.x <= object.x + object.width && point.y >= object.y && point.y <= object.y + object.height;
  if (object.type === "line") return Math.min(object.start.x, object.end.x) - 8 <= point.x && point.x <= Math.max(object.start.x, object.end.x) + 8 && Math.min(object.start.y, object.end.y) - 8 <= point.y && point.y <= Math.max(object.start.y, object.end.y) + 8;
  const xs = object.points.map((item) => item.x);
  const ys = object.points.map((item) => item.y);
  return point.x >= Math.min(...xs) && point.x <= Math.max(...xs) && point.y >= Math.min(...ys) && point.y <= Math.max(...ys);
}
