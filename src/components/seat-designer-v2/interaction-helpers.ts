import type { PointerEvent as ReactPointerEvent } from "react";
import type { ChartObject, Point, SeatPlace } from "@/types/seat-chart";
import { constrainedEnd, type V2EditorState, type V2Point } from "./editor-model";
import { boundsContains, createDraggedObject } from "./object-factory";
import type { V2ToolId } from "./tool-catalog";

export const DRAG_TOOLS: readonly V2ToolId[] = ["row", "multipleRows", "rectangularArea", "ellipticArea", "rectangle", "ellipse", "line"];
export const PATH_TOOLS: readonly V2ToolId[] = ["segmentedRow", "section", "polygonalArea", "polygon"];
export const POINT_TOOLS: readonly V2ToolId[] = ["roundTable", "rectangularTable", "booth", "text", "icon"];

export function canvasPoint(event: ReactPointerEvent<SVGSVGElement>, state: V2EditorState): V2Point {
  const bounds = event.currentTarget.getBoundingClientRect();
  const raw = { x: (event.clientX - bounds.left - state.pan.x) / state.zoom, y: (event.clientY - bounds.top - state.pan.y) / state.zoom };
  if (event.altKey || !state.snapToGrid) return raw;
  return { x: Math.round(raw.x / 5) * 5, y: Math.round(raw.y / 5) * 5 };
}

export function previewObject(state: V2EditorState, shift: boolean): ChartObject | null {
  if (!state.draft || !DRAG_TOOLS.includes(state.tool)) return null;
  return createDraggedObject(state.tool, state.draft.start, constrainedEnd(state.draft.start, state.draft.current, shift), state);
}

export function visibleObjects(state: V2EditorState): readonly ChartObject[] {
  return state.objects.filter((object) => (object.floorId ?? "floor_1") === state.activeFloorId && (state.activeSectionId ? object.sectionId === state.activeSectionId : object.sectionId === undefined || state.showSectionContents));
}

export function selectableObjects(state: V2EditorState, visible: readonly ChartObject[]): readonly ChartObject[] {
  return state.selectionLayer === "interactive" ? visible.filter((object) => object.layer === "interactive") : visible;
}

export function selectObjectIds(state: V2EditorState, visible: readonly ChartObject[], point: Point, additive: boolean): readonly string[] {
  const selectable = selectableObjects(state, visible);
  const hit = selectable.findLast((object) => boundsContains(object, point));
  if (!hit) return [];
  if (state.tool === "sameType") return selectable.filter((object) => object.type === hit.type).map((object) => object.id);
  return additive ? [...new Set([...state.selectedIds, hit.id])] : [hit.id];
}

export function findSeatAt(visible: readonly ChartObject[], point: Point): SeatPlace | null {
  const seats = visible.flatMap((object) => object.type === "row" || object.type === "table" ? object.seats : []);
  return seats.find((seat) => Math.hypot(seat.x - point.x, seat.y - point.y) <= 10) ?? null;
}

export function distanceToSegment(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const progress = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (start.x + progress * dx), point.y - (start.y + progress * dy));
}
