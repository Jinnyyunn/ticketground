import { useRef, useState, type Dispatch, type PointerEvent as ReactPointerEvent, type RefObject, type SetStateAction } from "react";
import type { ChartObject, Point, RowObject } from "@/types/seat-chart";
import { constrainedEnd, type V2EditorState, type V2Point } from "./editor-model";
import { canvasPoint, distanceToSegment, DRAG_TOOLS, findSeatAt, PATH_TOOLS, POINT_TOOLS, previewObject, selectableObjects, selectObjectIds } from "./interaction-helpers";
import { boundsContains, createPathObject, createPointObject } from "./object-factory";
import { objectBounds, resizeObject, rotateObject, translateObject } from "./object-transform";
import { insertPathNode, removePathNode } from "./node-geometry";
import { deriveSmartGuides, type SmartGuide } from "./smart-guides";

type PointerDeps = {
  readonly state: V2EditorState;
  readonly setState: Dispatch<SetStateAction<V2EditorState>>;
  readonly visibleObjects: readonly ChartObject[];
  readonly spacePressed: boolean;
  readonly setShift: Dispatch<SetStateAction<boolean>>;
  readonly setAltPressed: Dispatch<SetStateAction<boolean>>;
  readonly setSmartGuides: Dispatch<SetStateAction<readonly SmartGuide[]>>;
  readonly imageInput: RefObject<HTMLInputElement | null>;
  readonly setImagePoint: Dispatch<SetStateAction<V2Point | null>>;
  readonly multipleBase: RowObject | null;
  readonly setMultipleBase: Dispatch<SetStateAction<RowObject | null>>;
  readonly multiplePreview: readonly RowObject[] | null;
  readonly setPast: Dispatch<SetStateAction<readonly V2EditorState[]>>;
  readonly setFuture: Dispatch<SetStateAction<readonly V2EditorState[]>>;
  readonly commit: (next: V2EditorState) => void;
  readonly updateObject: (object: ChartObject) => void;
};

type ObjectDrag = { readonly kind: "move" | "resize" | "rotate"; readonly objectId: string; readonly start: V2Point };
type NodeDrag = { readonly objectId: string; readonly index: number };

export function useEditorPointer(deps: PointerDeps) {
  const { state, setState } = deps;
  const [panDrag, setPanDrag] = useState(false);
  const [nodeDrag, setNodeDrag] = useState<NodeDrag | null>(null);
  const [objectDrag, setObjectDrag] = useState<ObjectDrag | null>(null);
  const dragOrigin = useRef<V2EditorState | null>(null);
  const scoped = (object: ChartObject): ChartObject => ({ ...object, floorId: state.activeFloorId, sectionId: state.activeSectionId ?? undefined });

  function selectAt(point: Point, additive: boolean): void {
    const ids = selectObjectIds(state, deps.visibleObjects, point, additive);
    setState((current) => ({ ...current, selectedIds: ids, ...(ids.length ? {} : { selectedSeatIds: [] }) }));
  }
  function seatAt(point: Point, additive: boolean): void {
    const seat = findSeatAt(deps.visibleObjects, point);
    if (seat) setState((current) => ({ ...current, selectedSeatIds: additive ? [...new Set([...current.selectedSeatIds, seat.id])] : [seat.id] }));
  }
  function beginObjectDrag(point: Point, event: ReactPointerEvent<SVGSVGElement>): boolean {
    const selectable = selectableObjects(state, deps.visibleObjects);
    const handle = selectable.find((object) => {
      if (!state.selectedIds.includes(object.id)) return false;
      const bounds = objectBounds(object);
      return Math.hypot(point.x - (bounds.x + bounds.width / 2), point.y - (bounds.y - 22)) <= 12 || Math.hypot(point.x - (bounds.x + bounds.width + 5), point.y - (bounds.y + bounds.height + 5)) <= 14;
    });
    const target = handle ?? selectable.findLast((object) => boundsContains(object, point));
    if (!target) return false;
    const selectedIds = state.selectedIds.includes(target.id) ? state.selectedIds : [target.id];
    if (target.locked) { setState((current) => ({ ...current, selectedIds })); return true; }
    const bounds = objectBounds(target);
    const rotateDistance = Math.hypot(point.x - (bounds.x + bounds.width / 2), point.y - (bounds.y - 22));
    const cornerDistance = Math.hypot(point.x - (bounds.x + bounds.width), point.y - (bounds.y + bounds.height));
    dragOrigin.current = { ...state, selectedIds };
    setState((current) => ({ ...current, selectedIds }));
    setObjectDrag({ kind: rotateDistance <= 12 ? "rotate" : cornerDistance <= 14 ? "resize" : "move", objectId: target.id, start: point });
    event.currentTarget.setPointerCapture(event.pointerId);
    return true;
  }
  function pointerDown(event: ReactPointerEvent<SVGSVGElement>): void {
    let point = canvasPoint(event, state);
    const lastPathPoint = state.draft?.points.at(-1);
    if (PATH_TOOLS.includes(state.tool) && lastPathPoint && event.shiftKey) point = constrainedEnd(lastPathPoint, point, true);
    if (state.tool === "hand" || deps.spacePressed) { event.currentTarget.setPointerCapture(event.pointerId); setPanDrag(true); setState((current) => ({ ...current, draft: { start: point, current: point, points: [] } })); return; }
    if (state.tool === "select") { if (!event.shiftKey && beginObjectDrag(point, event)) return; selectAt(point, event.shiftKey); return; }
    if (state.tool === "sameType") { selectAt(point, event.shiftKey); return; }
    if (state.tool === "seatSelect" || state.tool === "brush") { seatAt(point, event.shiftKey); if (state.tool === "brush") event.currentTarget.setPointerCapture(event.pointerId); return; }
    if (state.tool === "focal") { deps.commit({ ...state, focalPoint: point }); return; }
    if (state.tool === "image") { deps.setImagePoint(point); deps.imageInput.current?.click(); return; }
    if (state.tool === "node") {
      const target = state.objects.find((object) => state.selectedIds.includes(object.id) && "points" in object && object.points?.some((item) => Math.hypot(item.x - point.x, item.y - point.y) < 10));
      if (target && "points" in target && target.points) { const index = target.points.findIndex((item) => Math.hypot(item.x - point.x, item.y - point.y) < 10); if (index >= 0) { dragOrigin.current = state; setNodeDrag({ objectId: target.id, index }); event.currentTarget.setPointerCapture(event.pointerId); } }
      return;
    }
    if (PATH_TOOLS.includes(state.tool)) {
      if (state.tool === "segmentedRow" && (state.draft?.points.length ?? 0) >= 2 && lastPathPoint && Math.hypot(lastPathPoint.x - point.x, lastPathPoint.y - point.y) <= 12) { finishPath(); return; }
      const points = [...(state.draft?.points ?? []), point];
      setState((current) => ({ ...current, draft: { start: points[0] ?? point, current: point, points } }));
      return;
    }
    if (POINT_TOOLS.includes(state.tool)) { const object = createPointObject(state.tool, point, state.objects.length); if (object) deps.commit({ ...state, objects: [...state.objects, scoped(object)], selectedIds: [object.id] }); return; }
    if (DRAG_TOOLS.includes(state.tool)) { event.currentTarget.setPointerCapture(event.pointerId); setState((current) => ({ ...current, draft: { start: point, current: point, points: [] } })); }
  }
  function pointerMove(event: ReactPointerEvent<SVGSVGElement>): void {
    const rawPoint = canvasPoint(event, state);
    const guideResult = event.altKey || !state.draft ? { point: rawPoint, guides: [] as readonly SmartGuide[] } : deriveSmartGuides(rawPoint, { origin: state.draft.start, centers: deps.visibleObjects.map((object) => { const bounds = objectBounds(object); return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }; }), projections: deps.visibleObjects.flatMap((object) => { const bounds = objectBounds(object); return [{ x: bounds.x, y: bounds.y }, { x: bounds.x + bounds.width, y: bounds.y + bounds.height }]; }) });
    const point = guideResult.point;
    deps.setSmartGuides(guideResult.guides); deps.setAltPressed(event.altKey);
    if (objectDrag && dragOrigin.current) {
      const origin = dragOrigin.current; const primary = origin.objects.find((object) => object.id === objectDrag.objectId); if (!primary) return;
      const delta = { x: point.x - objectDrag.start.x, y: point.y - objectDrag.start.y }; const bounds = objectBounds(primary); const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
      const startAngle = Math.atan2(objectDrag.start.y - center.y, objectDrag.start.x - center.x); const angle = Math.atan2(point.y - center.y, point.x - center.x) - startAngle; const scale = { x: Math.max(0.1, (point.x - bounds.x) / Math.max(1, bounds.width)), y: Math.max(0.1, (point.y - bounds.y) / Math.max(1, bounds.height)) };
      setState((current) => ({ ...current, objects: origin.objects.map((object) => !origin.selectedIds.includes(object.id) ? object : objectDrag.kind === "resize" ? resizeObject(object, { x: bounds.x, y: bounds.y }, scale) : objectDrag.kind === "rotate" ? rotateObject(object, center, angle) : translateObject(object, delta)) })); return;
    }
    if (nodeDrag) { setState((current) => ({ ...current, objects: current.objects.map((object) => object.id === nodeDrag.objectId && "points" in object && object.points ? { ...object, points: object.points.map((node, index) => index === nodeDrag.index ? point : node) } : object) })); return; }
    if (state.tool === "brush" && event.buttons === 1) { seatAt(point, true); return; }
    if (!state.draft) return;
    deps.setShift(event.shiftKey);
    if (panDrag) { const dx = (point.x - state.draft.start.x) * state.zoom; const dy = (point.y - state.draft.start.y) * state.zoom; setState((current) => ({ ...current, pan: { x: current.pan.x + dx, y: current.pan.y + dy }, draft: current.draft ? { start: point, current: point, points: current.draft.points } : null })); return; }
    setState((current) => ({ ...current, draft: current.draft ? { ...current.draft, current: point } : null }));
  }
  function pointerUp(event: ReactPointerEvent<SVGSVGElement>): void {
    const release = () => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); };
    if (panDrag) { setPanDrag(false); setState((current) => ({ ...current, draft: null })); release(); return; }
    if (objectDrag || nodeDrag) { const origin = dragOrigin.current; if (origin) deps.setPast((items) => [...items, origin]); deps.setFuture([]); setState((current) => ({ ...current, status: "저장되지 않은 변경" })); setObjectDrag(null); setNodeDrag(null); dragOrigin.current = null; release(); return; }
    if (state.tool === "brush") { release(); return; }
    if (!state.draft || !DRAG_TOOLS.includes(state.tool)) return;
    const object = previewObject(state, event.shiftKey);
    if (object) {
      if (state.tool === "multipleRows" && object.type === "row" && !deps.multipleBase) { deps.setMultipleBase(object); setState((current) => ({ ...current, draft: null, status: "기준 행 완료 · 두 번째 드래그로 행 수를 정하세요" })); deps.setSmartGuides([]); release(); return; }
      const objects = (state.tool === "multipleRows" && deps.multiplePreview ? deps.multiplePreview : [object]).map(scoped);
      deps.commit({ ...state, objects: [...state.objects, ...objects], selectedIds: objects.map((item) => item.id) }); deps.setMultipleBase(null);
    } else setState((current) => ({ ...current, draft: null }));
    deps.setSmartGuides([]); release();
  }
  function finishPath(): void {
    if (!state.draft || !PATH_TOOLS.includes(state.tool)) return;
    const object = createPathObject(state.tool, state.draft.points, state.objects.length);
    if (object) deps.commit({ ...state, objects: [...state.objects, scoped(object)], selectedIds: [object.id] }); else setState((current) => ({ ...current, draft: null }));
  }
  function editNode(event: ReactPointerEvent<SVGSVGElement>): void {
    if (state.tool !== "node") { finishPath(); return; }
    event.preventDefault(); const point = canvasPoint(event, state); const target = state.objects.find((object) => state.selectedIds.includes(object.id) && "points" in object && object.points && object.points.length >= 2);
    if (!target || !("points" in target) || !target.points) return;
    const segment = target.points.map((start, index) => ({ index, start, end: target.points?.[(index + 1) % target.points.length] ?? start })).toSorted((left, right) => distanceToSegment(point, left.start, left.end) - distanceToSegment(point, right.start, right.end))[0];
    if (segment) deps.updateObject({ ...target, points: insertPathNode(target.points, segment.index, point) });
  }
  function removeNode(event: ReactPointerEvent<SVGSVGElement>): void {
    if (state.tool !== "node") return;
    event.preventDefault(); const point = canvasPoint(event, state); const target = state.objects.find((object) => state.selectedIds.includes(object.id) && "points" in object && object.points && object.points.length > (object.type === "line" ? 2 : 3));
    if (!target || !("points" in target) || !target.points) return;
    const index = target.points.findIndex((node) => Math.hypot(node.x - point.x, node.y - point.y) <= 12);
    if (index >= 0) deps.updateObject({ ...target, points: removePathNode(target.points, index, target.type === "line" ? 2 : 3) });
  }
  return { pointerDown, pointerMove, pointerUp, finishPath, editNode, removeNode };
}
