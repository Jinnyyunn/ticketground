"use client";

import {
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  ClipboardCopy,
  ClipboardPaste,
  Copy,
  Eye,
  Grid3X3,
  HelpCircle,
  KeyRound,
  Redo2,
  Save,
  Send,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  apiPublishChart,
  apiSaveChart,
  apiUploadReferenceAsset,
} from "@/lib/seat-charts/client";
import type {
  ChartObject,
  ImageObject,
  Point,
  RowObject,
} from "@/types/seat-chart";
import { CanvasObjects } from "./canvas-objects";
import {
  constrainedEnd,
  INITIAL_STATE,
  type V2EditorState,
  type V2Point,
  type V2ReferencePlan,
} from "./editor-model";
import { Inspector } from "./inspector";
import {
  boundsContains,
  chartDocument,
  createDraggedObject,
  createPathObject,
  createPointObject,
} from "./object-factory";
import {
  alignObjects,
  duplicateObject,
  objectBounds,
  resizeObject,
  rotateObject,
  translateObject,
  type AlignmentMode,
} from "./object-transform";
import { ReferenceStart } from "./reference-start";
import { ServiceCredentialsPanel } from "./service-credentials-panel";
import { Toolbar } from "./toolbar";
import { toolSpec, V2_TOOLS, type V2ToolId } from "./tool-catalog";

const DRAG_TOOLS: readonly V2ToolId[] = [
  "row",
  "multipleRows",
  "rectangularArea",
  "ellipticArea",
  "rectangle",
  "ellipse",
  "line",
];
const PATH_TOOLS: readonly V2ToolId[] = [
  "segmentedRow",
  "section",
  "polygonalArea",
  "polygon",
];
const POINT_TOOLS: readonly V2ToolId[] = [
  "roundTable",
  "rectangularTable",
  "booth",
  "text",
  "icon",
];

function canvasPoint(
  event: ReactPointerEvent<SVGSVGElement>,
  state: V2EditorState,
): V2Point {
  const bounds = event.currentTarget.getBoundingClientRect();
  const raw = {
    x: (event.clientX - bounds.left - state.pan.x) / state.zoom,
    y: (event.clientY - bounds.top - state.pan.y) / state.zoom,
  };
  if (event.altKey) return raw;
  return { x: Math.round(raw.x / 5) * 5, y: Math.round(raw.y / 5) * 5 };
}

function previewObject(
  state: V2EditorState,
  shift: boolean,
): ChartObject | null {
  if (!state.draft || !DRAG_TOOLS.includes(state.tool)) return null;
  return createDraggedObject(
    state.tool,
    state.draft.start,
    constrainedEnd(state.draft.start, state.draft.current, shift),
    state,
  );
}

export function SeatDesignerV2() {
  const [started, setStarted] = useState(false);
  const [state, setState] = useState<V2EditorState>(INITIAL_STATE);
  const [past, setPast] = useState<readonly V2EditorState[]>([]);
  const [future, setFuture] = useState<readonly V2EditorState[]>([]);
  const [shift, setShift] = useState(false);
  const [preview, setPreview] = useState(false);
  const [credentialsOpen, setCredentialsOpen] = useState(false);
  const [pendingUploads, setPendingUploads] = useState(0);
  const [imagePoint, setImagePoint] = useState<V2Point | null>(null);
  const [nodeDrag, setNodeDrag] = useState<{
    readonly objectId: string;
    readonly index: number;
  } | null>(null);
  const [objectDrag, setObjectDrag] = useState<{
    readonly kind: "move" | "resize" | "rotate";
    readonly objectId: string;
    readonly start: V2Point;
  } | null>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const dragOrigin = useRef<V2EditorState | null>(null);
  const copiedObjects = useRef<readonly ChartObject[]>([]);
  const stateRef = useRef(state);
  const referenceRequest = useRef(0);
  stateRef.current = state;
  const activeSpec = toolSpec(state.tool);
  const draftPreview = useMemo(
    () => previewObject(state, shift),
    [shift, state],
  );

  function commit(next: V2EditorState): void {
    setPast((items) => [...items, { ...state, draft: null }]);
    setFuture([]);
    const committed = { ...next, draft: null, status: "저장되지 않은 변경" };
    stateRef.current = committed;
    setState(committed);
  }

  function commitCurrent(
    update: (current: V2EditorState) => V2EditorState,
  ): void {
    const current = stateRef.current;
    const committed = {
      ...update(current),
      draft: null,
      status: "저장되지 않은 변경",
    };
    setPast((items) => [...items, { ...current, draft: null }]);
    setFuture([]);
    stateRef.current = committed;
    setState(committed);
  }

  function selectTool(tool: V2ToolId): void {
    setState((current) => ({
      ...current,
      tool,
      draft: null,
      status: `${toolSpec(tool).label} 도구`,
    }));
  }
  function start(
    plan: V2ReferencePlan | null,
    venue: NonNullable<V2EditorState["venue"]>,
  ): void {
    setState((current) => ({
      ...current,
      venue,
      referencePlan: plan,
      assets: plan ? [plan.asset] : [],
      status: "편집 준비됨",
    }));
    setStarted(true);
  }
  function undo(): void {
    const previous = past.at(-1);
    if (!previous) return;
    setFuture((items) => [{ ...state, draft: null }, ...items]);
    setPast((items) => items.slice(0, -1));
    setState(previous);
  }
  function redo(): void {
    const next = future[0];
    if (!next) return;
    setPast((items) => [...items, { ...state, draft: null }]);
    setFuture((items) => items.slice(1));
    setState(next);
  }
  function deleteSelected(): void {
    if (state.selectedIds.length === 0) return;
    commit({
      ...state,
      objects: state.objects.filter(
        (object) =>
          !state.selectedIds.includes(object.id) || object.locked === true,
      ),
      selectedIds: [],
    });
  }
  function duplicateSelected(): void {
    const copies = state.objects
      .filter(
        (object) =>
          state.selectedIds.includes(object.id) && object.locked !== true,
      )
      .map((object) => duplicateObject(object));
    if (copies.length)
      commit({
        ...state,
        objects: [...state.objects, ...copies],
        selectedIds: copies.map((object) => object.id),
      });
  }
  function copySelected(): void {
    copiedObjects.current = state.objects.filter(
      (object) =>
        state.selectedIds.includes(object.id) && object.locked !== true,
    );
    setState((current) => ({
      ...current,
      status: copiedObjects.current.length
        ? `${copiedObjects.current.length}개 객체 복사됨`
        : "복사할 객체를 선택하세요",
    }));
  }
  function pasteCopied(): void {
    const copies = copiedObjects.current.map((object) =>
      duplicateObject(object),
    );
    if (copies.length)
      commit({
        ...state,
        objects: [...state.objects, ...copies],
        selectedIds: copies.map((object) => object.id),
      });
  }
  function alignSelected(mode: AlignmentMode): void {
    if (state.selectedIds.length < 2) return;
    commit({
      ...state,
      objects: alignObjects(state.objects, state.selectedIds, mode),
    });
  }

  function selectAt(point: Point, additive: boolean): void {
    const selectable =
      state.selectionLayer === "interactive"
        ? state.objects.filter((object) => object.layer === "interactive")
        : state.objects;
    const hit = selectable.findLast((object) => boundsContains(object, point));
    if (!hit) {
      setState((current) => ({
        ...current,
        selectedIds: [],
        selectedSeatIds: [],
      }));
      return;
    }
    const ids =
      state.tool === "sameType"
        ? selectable
            .filter((object) => object.type === hit.type)
            .map((object) => object.id)
        : additive
          ? [...new Set([...state.selectedIds, hit.id])]
          : [hit.id];
    setState((current) => ({ ...current, selectedIds: ids }));
  }

  function beginObjectDrag(
    point: Point,
    event: ReactPointerEvent<SVGSVGElement>,
  ): boolean {
    const selectable =
      state.selectionLayer === "interactive"
        ? state.objects.filter((object) => object.layer === "interactive")
        : state.objects;
    const handleObject = selectable.find((object) => {
      if (!state.selectedIds.includes(object.id)) return false;
      const bounds = objectBounds(object);
      const onRotation =
        Math.hypot(
          point.x - (bounds.x + bounds.width / 2),
          point.y - (bounds.y - 22),
        ) <= 12;
      const onResize =
        Math.hypot(
          point.x - (bounds.x + bounds.width + 5),
          point.y - (bounds.y + bounds.height + 5),
        ) <= 14;
      return onRotation || onResize;
    });
    const hit =
      handleObject ??
      selectable.findLast((object) => boundsContains(object, point));
    if (!hit) return false;
    const selectedIds = state.selectedIds.includes(hit.id)
      ? state.selectedIds
      : [hit.id];
    if (hit.locked) {
      setState((current) => ({ ...current, selectedIds }));
      return true;
    }
    const bounds = objectBounds(hit);
    const rotateDistance = Math.hypot(
      point.x - (bounds.x + bounds.width / 2),
      point.y - (bounds.y - 22),
    );
    const cornerDistance = Math.hypot(
      point.x - (bounds.x + bounds.width),
      point.y - (bounds.y + bounds.height),
    );
    const kind =
      rotateDistance <= 12
        ? "rotate"
        : cornerDistance <= 14
          ? "resize"
          : "move";
    dragOrigin.current = { ...state, selectedIds };
    setState((current) => ({ ...current, selectedIds }));
    setObjectDrag({ kind, objectId: hit.id, start: point });
    event.currentTarget.setPointerCapture(event.pointerId);
    return true;
  }

  function seatAt(point: Point, additive: boolean): void {
    const seats = state.objects.flatMap((object) =>
      object.type === "row" || object.type === "table" ? object.seats : [],
    );
    const hit = seats.find(
      (seat) => Math.hypot(seat.x - point.x, seat.y - point.y) <= 10,
    );
    if (!hit) return;
    setState((current) => ({
      ...current,
      selectedSeatIds: additive
        ? [...new Set([...current.selectedSeatIds, hit.id])]
        : [hit.id],
    }));
  }

  function pointerDown(event: ReactPointerEvent<SVGSVGElement>): void {
    const point = canvasPoint(event, state);
    if (state.tool === "select") {
      if (!event.shiftKey && beginObjectDrag(point, event)) return;
      selectAt(point, event.shiftKey);
      return;
    }
    if (state.tool === "sameType") {
      selectAt(point, event.shiftKey);
      return;
    }
    if (state.tool === "seatSelect" || state.tool === "brush") {
      seatAt(point, event.shiftKey);
      if (state.tool === "brush")
        event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    if (state.tool === "focal") {
      commit({ ...state, focalPoint: point });
      return;
    }
    if (state.tool === "image") {
      setImagePoint(point);
      imageInput.current?.click();
      return;
    }
    if (state.tool === "node") {
      const target = state.objects.find(
        (object) =>
          state.selectedIds.includes(object.id) &&
          "points" in object &&
          object.points?.some(
            (item) => Math.hypot(item.x - point.x, item.y - point.y) < 10,
          ),
      );
      if (target && "points" in target && target.points) {
        const index = target.points.findIndex(
          (item) => Math.hypot(item.x - point.x, item.y - point.y) < 10,
        );
        if (index >= 0) {
          dragOrigin.current = state;
          setNodeDrag({ objectId: target.id, index });
          event.currentTarget.setPointerCapture(event.pointerId);
        }
      }
      return;
    }
    if (PATH_TOOLS.includes(state.tool)) {
      const points = [...(state.draft?.points ?? []), point];
      setState((current) => ({
        ...current,
        draft: { start: points[0] ?? point, current: point, points },
      }));
      return;
    }
    if (POINT_TOOLS.includes(state.tool)) {
      const object = createPointObject(state.tool, point, state.objects.length);
      if (object)
        commit({
          ...state,
          objects: [...state.objects, object],
          selectedIds: [object.id],
        });
      return;
    }
    if (state.tool === "hand" || DRAG_TOOLS.includes(state.tool)) {
      event.currentTarget.setPointerCapture(event.pointerId);
      setState((current) => ({
        ...current,
        draft: { start: point, current: point, points: [] },
      }));
    }
  }

  function pointerMove(event: ReactPointerEvent<SVGSVGElement>): void {
    const point = canvasPoint(event, state);
    if (objectDrag && dragOrigin.current) {
      const originState = dragOrigin.current;
      const primary = originState.objects.find(
        (object) => object.id === objectDrag.objectId,
      );
      if (!primary) return;
      const delta = {
        x: point.x - objectDrag.start.x,
        y: point.y - objectDrag.start.y,
      };
      const bounds = objectBounds(primary);
      const center = {
        x: bounds.x + bounds.width / 2,
        y: bounds.y + bounds.height / 2,
      };
      const startAngle = Math.atan2(
        objectDrag.start.y - center.y,
        objectDrag.start.x - center.x,
      );
      const angle =
        Math.atan2(point.y - center.y, point.x - center.x) - startAngle;
      const scale = {
        x: Math.max(0.1, (point.x - bounds.x) / Math.max(1, bounds.width)),
        y: Math.max(0.1, (point.y - bounds.y) / Math.max(1, bounds.height)),
      };
      setState((current) => ({
        ...current,
        objects: originState.objects.map((object) => {
          if (!originState.selectedIds.includes(object.id)) return object;
          if (objectDrag.kind === "resize")
            return resizeObject(object, { x: bounds.x, y: bounds.y }, scale);
          if (objectDrag.kind === "rotate")
            return rotateObject(object, center, angle);
          return translateObject(object, delta);
        }),
      }));
      return;
    }
    if (nodeDrag) {
      setState((current) => ({
        ...current,
        objects: current.objects.map((object) =>
          object.id === nodeDrag.objectId && "points" in object && object.points
            ? {
                ...object,
                points: object.points.map((node, index) =>
                  index === nodeDrag.index ? point : node,
                ),
              }
            : object,
        ),
      }));
      return;
    }
    if (state.tool === "brush" && event.buttons === 1) {
      seatAt(point, true);
      return;
    }
    if (!state.draft) return;
    setShift(event.shiftKey);
    if (state.tool === "hand") {
      const dx = (point.x - state.draft.start.x) * state.zoom;
      const dy = (point.y - state.draft.start.y) * state.zoom;
      setState((current) => ({
        ...current,
        pan: { x: current.pan.x + dx, y: current.pan.y + dy },
        draft: current.draft
          ? { start: point, current: point, points: current.draft.points }
          : null,
      }));
      return;
    }
    setState((current) => ({
      ...current,
      draft: current.draft ? { ...current.draft, current: point } : null,
    }));
  }

  function pointerUp(event: ReactPointerEvent<SVGSVGElement>): void {
    if (objectDrag || nodeDrag) {
      const origin = dragOrigin.current;
      if (origin) setPast((items) => [...items, origin]);
      setFuture([]);
      setState((current) => ({ ...current, status: "저장되지 않은 변경" }));
      setObjectDrag(null);
      setNodeDrag(null);
      dragOrigin.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId))
        event.currentTarget.releasePointerCapture(event.pointerId);
      return;
    }
    if (state.tool === "brush") {
      if (event.currentTarget.hasPointerCapture(event.pointerId))
        event.currentTarget.releasePointerCapture(event.pointerId);
      return;
    }
    if (!state.draft || !DRAG_TOOLS.includes(state.tool)) return;
    const object = previewObject(state, event.shiftKey);
    if (object) {
      const objects =
        state.tool === "multipleRows" && object.type === "row"
          ? multipleRows(object, state.rowSpacing)
          : [object];
      commit({
        ...state,
        objects: [...state.objects, ...objects],
        selectedIds: objects.map((item) => item.id),
      });
    } else setState((current) => ({ ...current, draft: null }));
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function finishPath(): void {
    if (!state.draft || !PATH_TOOLS.includes(state.tool)) return;
    const object = createPathObject(
      state.tool,
      state.draft.points,
      state.objects.length,
    );
    if (object)
      commit({
        ...state,
        objects: [...state.objects, object],
        selectedIds: [object.id],
      });
    else setState((current) => ({ ...current, draft: null }));
  }
  function editNode(event: ReactPointerEvent<SVGSVGElement>): void {
    if (state.tool !== "node") {
      finishPath();
      return;
    }
    event.preventDefault();
    const point = canvasPoint(event, state);
    const target = state.objects.find(
      (object) =>
        state.selectedIds.includes(object.id) &&
        "points" in object &&
        object.points &&
        object.points.length >= 2,
    );
    if (!target || !("points" in target) || !target.points) return;
    const segment = target.points
      .map((start, index) => ({
        index,
        start,
        end: target.points?.[(index + 1) % target.points.length] ?? start,
      }))
      .toSorted(
        (left, right) =>
          distanceToSegment(point, left.start, left.end) -
          distanceToSegment(point, right.start, right.end),
      )[0];
    if (!segment) return;
    const points = [
      ...target.points.slice(0, segment.index + 1),
      point,
      ...target.points.slice(segment.index + 1),
    ];
    updateObject({ ...target, points });
  }
  function removeNode(event: ReactPointerEvent<SVGSVGElement>): void {
    if (state.tool !== "node") return;
    event.preventDefault();
    const point = canvasPoint(event, state);
    const target = state.objects.find(
      (object) =>
        state.selectedIds.includes(object.id) &&
        "points" in object &&
        object.points &&
        object.points.length > (object.type === "line" ? 2 : 3),
    );
    if (!target || !("points" in target) || !target.points) return;
    const index = target.points.findIndex(
      (node) => Math.hypot(node.x - point.x, node.y - point.y) <= 12,
    );
    if (index >= 0)
      updateObject({
        ...target,
        points: target.points.filter((_, itemIndex) => itemIndex !== index),
      });
  }
  function updateObject(next: ChartObject): void {
    commit({
      ...state,
      objects: state.objects.map((object) =>
        object.id === next.id ? next : object,
      ),
    });
  }

  async function uploadObject(file: File): Promise<void> {
    const targetPoint = imagePoint ?? { x: 320, y: 220 };
    setPendingUploads((count) => count + 1);
    setState((current) => ({ ...current, status: "이미지 불러오는 중…" }));
    try {
      const uploaded = await apiUploadReferenceAsset({
        file,
        purpose: "object",
      });
      const object: ImageObject = {
        id: `image_${crypto.randomUUID()}`,
        label: "이미지",
        layer: "background",
        type: "image",
        x: targetPoint.x,
        y: targetPoint.y,
        width: 240,
        height: 180,
        href: uploaded.url,
        opacity: 1,
      };
      commitCurrent((current) => ({
        ...current,
        objects: [...current.objects, object],
        assets: [...current.assets, uploaded.asset],
        selectedIds: [object.id],
      }));
    } catch {
      setState((current) => ({
        ...current,
        status: "이미지를 불러오지 못했습니다",
      }));
    } finally {
      setImagePoint(null);
      setPendingUploads((count) => Math.max(0, count - 1));
    }
  }
  async function replaceReference(file: File): Promise<void> {
    const request = referenceRequest.current + 1;
    referenceRequest.current = request;
    setPendingUploads((count) => count + 1);
    setState((current) => ({ ...current, status: "참조 도면 교체 중…" }));
    try {
      const uploaded = await apiUploadReferenceAsset({
        file,
        purpose: "reference",
      });
      if (request !== referenceRequest.current) return;
      setState((current) => {
        const next = {
          ...current,
          referencePlan: current.referencePlan
            ? {
                ...current.referencePlan,
                asset: uploaded.asset,
                href: uploaded.url,
                name: file.name,
              }
            : null,
          assets: current.referencePlan
            ? [
                ...current.assets.filter((asset) => asset.kind !== "reference"),
                uploaded.asset,
              ]
            : current.assets,
          status: current.referencePlan ? "참조 도면 교체됨" : current.status,
        };
        stateRef.current = next;
        return next;
      });
    } catch {
      setState((current) => ({
        ...current,
        status: "참조 도면을 교체하지 못했습니다",
      }));
    } finally {
      setPendingUploads((count) => Math.max(0, count - 1));
    }
  }

  function removeReference(): void {
    referenceRequest.current += 1;
    setState((current) => {
      const next = {
        ...current,
        referencePlan: null,
        assets: current.assets.filter((asset) => asset.kind !== "reference"),
        status: "참조 도면 제거됨",
      };
      stateRef.current = next;
      return next;
    });
  }
  async function save(): Promise<void> {
    if (!state.venue) return;
    setState((current) => ({ ...current, status: "저장 중…" }));
    try {
      await apiSaveChart(chartDocument(state), state.venue);
      setState((current) => ({ ...current, status: "초안 저장 완료" }));
    } catch (cause) {
      setState((current) => ({
        ...current,
        status: cause instanceof Error ? "저장 실패" : "저장할 수 없음",
      }));
    }
  }
  async function publish(): Promise<void> {
    if (!state.venue) return;
    setState((current) => ({ ...current, status: "게시 중…" }));
    try {
      const saved = await apiSaveChart(chartDocument(state), state.venue);
      await apiPublishChart(saved.id, true, state.venue);
      setState((current) => ({ ...current, status: "게시 완료" }));
    } catch (cause) {
      setState((current) => ({
        ...current,
        status: cause instanceof Error ? "게시 실패" : "게시할 수 없음",
      }));
    }
  }

  useEffect(() => {
    function keydown(event: KeyboardEvent): void {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      )
        return;
      if (event.metaKey || event.ctrlKey) {
        const key = event.key.toLowerCase();
        if (key === "z") {
          event.preventDefault();
          if (event.shiftKey) redo();
          else undo();
          return;
        }
        if (key === "c") {
          event.preventDefault();
          copySelected();
          return;
        }
        if (key === "v") {
          event.preventDefault();
          pasteCopied();
          return;
        }
      }
      if (event.key === "Delete" || event.key === "Backspace") deleteSelected();
      else if (event.key === "Escape")
        setState((current) => ({ ...current, draft: null, selectedIds: [] }));
      else if (event.key === "Enter") finishPath();
      else {
        const match = V2_TOOLS.find(
          (tool) => tool.shortcut?.toLowerCase() === event.key.toLowerCase(),
        );
        if (match) selectTool(match.id);
      }
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  });

  return (
    <div
      className="flex h-[100dvh] min-h-[620px] flex-col overflow-hidden bg-white text-[13px] text-[#333]"
      data-testid="seat-designer-v2-shell"
    >
      {!started && (
        <ReferenceStart
          onBlank={(venue) => start(null, venue)}
          onReady={(plan, venue) => start(plan, venue)}
        />
      )}
      <header className="flex h-[46px] shrink-0 items-center border-b border-[#ddd] bg-[#fafafa]">
        <div className="flex min-w-0 flex-1 items-center gap-3 px-3">
          <button
            type="button"
            title="닫기"
            className="grid size-8 place-items-center rounded hover:bg-[#eee]"
          >
            <X className="size-4" />
          </button>
          <input
            aria-label="좌석 배치도 이름"
            className="min-w-0 max-w-52 bg-transparent text-sm outline-none"
            value={state.name}
            onChange={(event) => {
              const name = event.currentTarget.value;
              setState((current) => ({ ...current, name }));
            }}
          />
          <span className="hidden rounded bg-[#e9f7ed] px-2 py-1 text-xs text-[#287b42] sm:inline">
            {state.status}
          </span>
        </div>
        <div className="flex items-center gap-1 px-2">
          <TopButton label="미리보기" onClick={() => setPreview(true)}>
            <Eye />
          </TopButton>
          <TopButton label="실행 취소" onClick={undo} disabled={!past.length}>
            <Undo2 />
          </TopButton>
          <TopButton label="다시 실행" onClick={redo} disabled={!future.length}>
            <Redo2 />
          </TopButton>
          <TopButton
            label="격자"
            onClick={() =>
              setState((current) => ({
                ...current,
                showGrid: !current.showGrid,
              }))
            }
          >
            <Grid3X3 />
          </TopButton>
          <span className="hidden xl:contents">
            <TopButton
              label="왼쪽 정렬"
              onClick={() => alignSelected("left")}
              disabled={state.selectedIds.length < 2}
            >
              <AlignHorizontalJustifyStart />
            </TopButton>
            <TopButton
              label="가운데 정렬"
              onClick={() => alignSelected("center")}
              disabled={state.selectedIds.length < 2}
            >
              <AlignHorizontalJustifyCenter />
            </TopButton>
            <TopButton
              label="오른쪽 정렬"
              onClick={() => alignSelected("right")}
              disabled={state.selectedIds.length < 2}
            >
              <AlignHorizontalJustifyEnd />
            </TopButton>
            <TopButton
              label="위 정렬"
              onClick={() => alignSelected("top")}
              disabled={state.selectedIds.length < 2}
            >
              <AlignVerticalJustifyStart />
            </TopButton>
            <TopButton
              label="중간 정렬"
              onClick={() => alignSelected("middle")}
              disabled={state.selectedIds.length < 2}
            >
              <AlignVerticalJustifyCenter />
            </TopButton>
            <TopButton
              label="아래 정렬"
              onClick={() => alignSelected("bottom")}
              disabled={state.selectedIds.length < 2}
            >
              <AlignVerticalJustifyEnd />
            </TopButton>
          </span>
          <span className="hidden md:contents">
            <TopButton label="복사" onClick={copySelected}>
              <ClipboardCopy />
            </TopButton>
            <TopButton
              label="붙여넣기"
              onClick={pasteCopied}
              disabled={!copiedObjects.current.length}
            >
              <ClipboardPaste />
            </TopButton>
            <TopButton label="복제" onClick={duplicateSelected}>
              <Copy />
            </TopButton>
            <TopButton label="삭제" onClick={deleteSelected}>
              <Trash2 />
            </TopButton>
            <TopButton
              label="API 연결"
              onClick={() => setCredentialsOpen(true)}
            >
              <KeyRound />
            </TopButton>
            <TopButton label="도움말">
              <HelpCircle />
            </TopButton>
          </span>
          <button
            type="button"
            disabled={pendingUploads > 0}
            className="ml-1 hidden h-8 items-center gap-1 rounded border border-[#bbb] px-3 font-semibold disabled:cursor-not-allowed disabled:opacity-40 sm:flex"
            onClick={() => void save()}
          >
            <Save className="size-4" />
            저장
          </button>
          <button
            type="button"
            disabled={pendingUploads > 0}
            className="ml-1 flex h-8 items-center gap-1 rounded border border-[#087ffa] px-3 font-semibold text-[#087ffa] hover:bg-[#eaf4ff] disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => void publish()}
          >
            <Send className="size-4" />
            게시
          </button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <Toolbar active={state.tool} onSelect={selectTool} />
        <main className="relative min-w-0 flex-1 overflow-hidden bg-white">
          <label className="absolute left-3 top-3 z-10 w-44 rounded border border-[#d4d4d4] bg-white px-3 py-2 shadow-sm">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#777]">
              선택 레이어
            </span>
            <select
              data-testid="seat-designer-v2-selection-layer"
              className="w-full bg-transparent text-sm font-medium text-[#087ffa] outline-none"
              value={state.selectionLayer}
              onChange={(event) => {
                const selectionLayer = event.currentTarget.value as
                  "all" | "interactive";
                setState((current) => ({
                  ...current,
                  selectionLayer,
                  selectedIds: [],
                }));
              }}
            >
              <option value="all">전체 객체</option>
              <option value="interactive">상호작용 객체</option>
            </select>
          </label>
          <svg
            className="size-full touch-none"
            data-testid="seat-designer-v2-canvas"
            onPointerDown={pointerDown}
            onPointerMove={pointerMove}
            onPointerUp={pointerUp}
            onDoubleClick={editNode}
            onContextMenu={removeNode}
          >
            <defs>
              <pattern
                id="v2-grid"
                width="20"
                height="20"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 20 0 L 0 0 0 20"
                  fill="none"
                  stroke="#eeeeee"
                  strokeWidth="1"
                />
              </pattern>
            </defs>
            <rect
              width="100%"
              height="100%"
              fill={state.showGrid ? "url(#v2-grid)" : "white"}
            />
            <g
              transform={`translate(${state.pan.x} ${state.pan.y}) scale(${state.zoom})`}
            >
              {state.referencePlan?.visible && (
                <image
                  href={state.referencePlan.href}
                  x={state.referencePlan.x}
                  y={state.referencePlan.y}
                  width={state.referencePlan.width}
                  height={state.referencePlan.height}
                  opacity={state.referencePlan.opacity}
                  transform={`rotate(${state.referencePlan.rotation} ${state.referencePlan.x + state.referencePlan.width / 2} ${state.referencePlan.y + state.referencePlan.height / 2})`}
                  preserveAspectRatio="xMidYMid meet"
                  data-testid="seat-designer-v2-reference-plan"
                />
              )}
              <CanvasObjects
                objects={state.objects}
                selectedIds={state.selectedIds}
                selectedSeatIds={state.selectedSeatIds}
                nodeMode={state.tool === "node"}
              />
              {draftPreview && (
                <g opacity="0.68" data-testid="seat-designer-v2-row-preview">
                  <CanvasObjects
                    objects={[draftPreview]}
                    selectedIds={[]}
                    selectedSeatIds={[]}
                    nodeMode={false}
                  />
                  {draftPreview.type === "row" && (
                    <>
                      <line
                        x1={
                          draftPreview.start.x -
                          (draftPreview.end.x - draftPreview.start.x) * 2
                        }
                        y1={
                          draftPreview.start.y -
                          (draftPreview.end.y - draftPreview.start.y) * 2
                        }
                        x2={
                          draftPreview.end.x +
                          (draftPreview.end.x - draftPreview.start.x) * 2
                        }
                        y2={
                          draftPreview.end.y +
                          (draftPreview.end.y - draftPreview.start.y) * 2
                        }
                        stroke="#f59e0b"
                      />
                      <g
                        transform={`translate(${(draftPreview.start.x + draftPreview.end.x) / 2},${(draftPreview.start.y + draftPreview.end.y) / 2 - 20})`}
                        data-testid="seat-designer-v2-row-count"
                      >
                        <rect
                          x="-14"
                          y="-12"
                          width="28"
                          height="24"
                          rx="4"
                          fill="#111"
                        />
                        <text
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill="white"
                          fontSize="12"
                        >
                          {draftPreview.seats.length}
                        </text>
                      </g>
                    </>
                  )}
                </g>
              )}
              {state.draft && PATH_TOOLS.includes(state.tool) && (
                <polyline
                  points={state.draft.points
                    .map((point) => `${point.x},${point.y}`)
                    .join(" ")}
                  fill="none"
                  stroke="#087ffa"
                  strokeWidth="2"
                />
              )}
              {state.focalPoint && (
                <g
                  transform={`translate(${state.focalPoint.x} ${state.focalPoint.y})`}
                  data-testid="seat-designer-v2-focal-point"
                >
                  <circle r="10" fill="none" stroke="#e11d48" />
                  <path d="M-15 0H15M0-15V15" stroke="#e11d48" />
                </g>
              )}
            </g>
          </svg>
          <div className="absolute bottom-3 left-3 flex items-center rounded-full border border-[#ddd] bg-white p-1 shadow-sm">
            <button
              className="size-8"
              type="button"
              onClick={() =>
                setState((current) => ({
                  ...current,
                  zoom: Math.max(0.25, current.zoom - 0.1),
                }))
              }
            >
              −
            </button>
            <span className="w-12 text-center text-xs">
              {Math.round(state.zoom * 100)}%
            </span>
            <button
              className="size-8"
              type="button"
              onClick={() =>
                setState((current) => ({
                  ...current,
                  zoom: Math.min(3, current.zoom + 0.1),
                }))
              }
            >
              ＋
            </button>
          </div>
        </main>
        <div className="hidden lg:block">
          <Inspector
            state={state}
            onState={setState}
            onObject={updateObject}
            onReplaceReference={(file) => void replaceReference(file)}
            onRemoveReference={removeReference}
          />
        </div>
      </div>
      <footer
        className="flex h-9 shrink-0 items-center gap-2 overflow-x-auto border-t border-[#ddd] bg-white px-4 whitespace-nowrap"
        data-testid="seat-designer-v2-help-strip"
      >
        <strong>{activeSpec.label}</strong>
        {activeSpec.help.map((part, index) =>
          index % 2 === 0 ? (
            <kbd
              key={`${part}-${index}`}
              className="rounded bg-[#eee] px-2 py-1 text-[11px] font-semibold"
            >
              {part}
            </kbd>
          ) : (
            <span key={`${part}-${index}`} className="text-[#555]">
              {part}
            </span>
          ),
        )}
      </footer>
      <input
        ref={imageInput}
        type="file"
        className="sr-only"
        accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) void uploadObject(file);
          event.currentTarget.value = "";
        }}
      />
      {preview && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-6"
          data-testid="seat-designer-v2-preview"
        >
          <div className="relative h-[80dvh] w-[90vw] rounded bg-white shadow-2xl">
            <button
              type="button"
              className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-full bg-white shadow"
              onClick={() => setPreview(false)}
            >
              <X className="size-4" />
            </button>
            <svg className="size-full">
              <CanvasObjects
                objects={state.objects}
                selectedIds={[]}
                selectedSeatIds={[]}
                nodeMode={false}
              />
            </svg>
          </div>
        </div>
      )}
      {credentialsOpen && (
        <ServiceCredentialsPanel onClose={() => setCredentialsOpen(false)} />
      )}
    </div>
  );
}

function multipleRows(
  base: RowObject,
  rowSpacing: number,
): readonly RowObject[] {
  return Array.from({ length: 4 }, (_, index) => ({
    ...base,
    id: `row_${crypto.randomUUID()}`,
    label: `${base.label}-${index + 1}`,
    start: { x: base.start.x, y: base.start.y + index * rowSpacing },
    end: { x: base.end.x, y: base.end.y + index * rowSpacing },
    seats: base.seats.map((seat) => ({
      ...seat,
      id: `seat_${crypto.randomUUID()}`,
      y: seat.y + index * rowSpacing,
    })),
  }));
}
function distanceToSegment(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0)
    return Math.hypot(point.x - start.x, point.y - start.y);
  const progress = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared,
    ),
  );
  return Math.hypot(
    point.x - (start.x + progress * dx),
    point.y - (start.y + progress * dy),
  );
}
function TopButton({
  label,
  children,
  onClick,
  disabled = false,
}: {
  readonly label: string;
  readonly children: ReactNode;
  readonly onClick?: () => void;
  readonly disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-8 place-items-center rounded hover:bg-[#eee] disabled:opacity-30 [&>svg]:size-4"
    >
      {children}
    </button>
  );
}
