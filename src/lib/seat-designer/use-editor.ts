"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import type {
  ChartDocument,
  ChartObject,
  EditorSettings,
  Point,
  SelectionLayer,
  ToolId,
  ToolMode,
  Viewport,
  RowObject,
  SeatChartAsset,
  OverlayImage,
} from "@/types/seat-chart";
import {
  addObject,
  alignCenter,
  applyCategory,
  cloneObjectWithOffset,
  createRow,
  duplicateObjects,
  flipObjects,
  removeObjects,
  setAreaCapacity,
  setDecorationProps,
  setObjectAdvanced,
  setObjectLabel,
  setRowEndpoints,
  setRowGeometry,
  setTableProps,
  translateMany,
  normalizeOverlay,
} from "./chart-ops";
import { referenceAssetSizeError } from "./reference-asset-policy";
import { snapPoint, uid } from "./geometry";
import { ko } from "./i18n";
import { buildTemplate, type TemplateId } from "./templates";
import { blockingValidationItems, validateChart } from "./validation";
import { toggleSelection } from "./selection";
import {
  addZone as addZoneToChart,
  removeZone as removeZoneFromChart,
  renameZone as renameZoneInChart,
  setSeatProperties,
} from "./chart-structure";
import type { SeatChartVenue } from "@/lib/seat-charts/types";
import { defaultModeForTool, primaryToolForMode } from "./tool-catalog";
import { createObjectsForMode } from "./tools/create-objects";
import { resizeObject, rotateObject, type ObjectBounds } from "./transforms";
import { insertVertex, moveVertex, removeVertex, verticesOf } from "./vertices";
import { withChartAsset } from "./assets";

const STORAGE_KEY = "ticketground.seat-designer.chart.v5";
const TUTORIAL_KEY = "ticketground.seat-designer.tutorial.v1";
const ICON_CYCLE = ["stage", "entrance", "wc", "star"] as const;

export type EditorState = {
  chart: ChartDocument;
  past: HistorySnapshot[];
  future: HistorySnapshot[];
  selectedIds: string[];
  selectedSeatIds: string[];
  tool: ToolId;
  toolMode: ToolMode;
  settings: EditorSettings;
  viewport: Viewport;
  /** Bumps when chart should be re-centered/fitted in the canvas. */
  fitGeneration: number;
  draftPoints: Point[];
  clipboard: ChartObject[];
  preview: boolean;
  categoriesOpen: boolean;
  chartSettingsOpen: boolean;
  floorsOpen: boolean;
  tutorialOpen: boolean;
  boundVenue: SeatChartVenue | null;
  status: string;
  serverStatus: string;
  searchQuery: string;
  searchOpen: boolean;
  restoredLocalDraft: boolean;
  assetRequestIds: Record<string, string>;
  chartGeneration: number;
};

type HistorySnapshot = {
  readonly chart: ChartDocument;
  readonly selectedIds: readonly string[];
  readonly selectedSeatIds: readonly string[];
};

type Action =
  | { type: "LOAD"; chart: ChartDocument }
  | { type: "RESTORE_LOCAL"; chart: ChartDocument }
  | { type: "BEGIN_ASSET_REQUEST"; key: string; requestId: string }
  | { type: "END_ASSET_REQUEST"; key: string; requestId: string }
  | { type: "ADD_OBJECT"; object: ChartObject; asset?: SeatChartAsset; status: string; select?: boolean; targetChartId?: string; targetChartGeneration?: number; requestKey?: string; requestId?: string }
  | { type: "PATCH_IMAGE_ASSET"; id: string; href: string; aspectRatio: number; label: string; asset: SeatChartAsset; status: string; targetChartId: string; targetChartGeneration: number; requestKey: string; requestId: string }
  | { type: "SET_OVERLAY_ASSET"; key: "backgroundImage" | "referenceChart"; href: string; fallback: OverlayImage; replacesHref?: string; asset: SeatChartAsset; status: string; targetChartId: string; targetChartGeneration: number; requestKey: string; requestId: string }
  | { type: "SET_TOOL"; tool: ToolId }
  | { type: "SET_TOOL_MODE"; mode: ToolMode }
  | { type: "SET_VIEWPORT"; viewport: Partial<Viewport> }
  | { type: "SELECT"; ids: string[]; additive?: boolean }
  | { type: "SELECT_SEATS"; ids: string[]; additive?: boolean; remove?: boolean }
  | { type: "CLEAR_SELECTION" }
  | { type: "COMMIT"; chart: ChartDocument; status?: string }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "TOGGLE_SETTING"; key: keyof EditorSettings }
  | { type: "SET_LAYER"; layer: SelectionLayer }
  | { type: "SET_DRAFT"; points: Point[] }
  | { type: "SET_CLIPBOARD"; objects: ChartObject[] }
  | { type: "SET_PREVIEW"; preview: boolean }
  | { type: "SET_CATEGORIES_OPEN"; open: boolean }
  | { type: "SET_CHART_SETTINGS_OPEN"; open: boolean }
  | { type: "SET_FLOORS_OPEN"; open: boolean }
  | { type: "SET_TUTORIAL_OPEN"; open: boolean }
  | { type: "SET_STATUS"; status: string }
  | { type: "SET_NAME"; name: string }
  | { type: "REQUEST_FIT" }
  | { type: "SET_ACTIVE_FLOOR"; floorId: string }
  | { type: "SET_BOUND_VENUE"; venue: SeatChartVenue | null }
  | { type: "SET_SERVER_STATUS"; status: string }
  | { type: "SET_SEARCH_QUERY"; query: string }
  | { type: "SET_SEARCH_OPEN"; open: boolean };

const defaultSettings: EditorSettings = {
  snapToGrid: true,
  gridSize: 8,
  showSectionContents: true,
  alwaysShowLabels: false,
  darkCanvas: false,
  selectionLayer: "all",
  showReferenceChart: true,
  showBackgroundImage: true,
};

function initialState(): EditorState {
  return {
    chart: buildTemplate("blank"),
    past: [],
    future: [],
    selectedIds: [],
    selectedSeatIds: [],
    tool: "select",
    toolMode: "select",
    settings: defaultSettings,
    // Placeholder until canvas measures and fits (see DesignerCanvas)
    viewport: { x: 0, y: 0, zoom: 0.5 },
    fitGeneration: 1,
    draftPoints: [],
    clipboard: [],
    preview: false,
    categoriesOpen: false,
    chartSettingsOpen: false,
    floorsOpen: false,
    tutorialOpen: false,
    boundVenue: null,
    status: ko.toolHints.select,
    serverStatus: "",
    searchQuery: "",
    searchOpen: false,
    restoredLocalDraft: false,
    assetRequestIds: {},
    chartGeneration: 0,
  };
}

function pushHistory(state: EditorState, chart: ChartDocument, status?: string): EditorState {
  return {
    ...state,
    chart,
    past: [...state.past.slice(-79), { chart: state.chart, selectedIds: state.selectedIds, selectedSeatIds: state.selectedSeatIds }],
    future: [],
    status: status ?? state.status,
  };
}

function withoutAssetRequest(state: EditorState, key: string): Record<string, string> {
  return Object.fromEntries(Object.entries(state.assetRequestIds).filter(([requestKey]) => requestKey !== key));
}

function reducer(state: EditorState, action: Action): EditorState {
  switch (action.type) {
    case "LOAD":
      return {
        ...state,
        chart: action.chart,
        past: [],
        future: [],
        selectedIds: [],
        selectedSeatIds: [],
        fitGeneration: state.fitGeneration + 1,
        restoredLocalDraft: false,
        assetRequestIds: {},
        chartGeneration: state.chartGeneration + 1,
      };
    case "RESTORE_LOCAL":
      return {
        ...state,
        chart: action.chart,
        past: [],
        future: [],
        selectedIds: [],
        selectedSeatIds: [],
        fitGeneration: state.fitGeneration + 1,
        restoredLocalDraft: true,
        assetRequestIds: {},
        chartGeneration: state.chartGeneration + 1,
      };
    case "BEGIN_ASSET_REQUEST":
      return { ...state, assetRequestIds: { ...state.assetRequestIds, [action.key]: action.requestId } };
    case "END_ASSET_REQUEST":
      return state.assetRequestIds[action.key] === action.requestId
        ? { ...state, assetRequestIds: withoutAssetRequest(state, action.key) }
        : state;
    case "ADD_OBJECT": {
      if ((action.targetChartId && action.targetChartId !== state.chart.id) || (action.targetChartGeneration !== undefined && action.targetChartGeneration !== state.chartGeneration)) return state;
      if (action.requestKey && state.assetRequestIds[action.requestKey] !== action.requestId) return state;
      const assetRequestIds = action.requestKey ? withoutAssetRequest(state, action.requestKey) : state.assetRequestIds;
      const chart = addObject(state.chart, action.object);
      const next = pushHistory({ ...state, assetRequestIds }, action.asset ? withChartAsset(chart, action.asset) : chart, action.status);
      return action.select
        ? { ...next, selectedIds: [action.object.id], selectedSeatIds: [], tool: "select", toolMode: "select" }
        : next;
    }
    case "PATCH_IMAGE_ASSET": {
      if (action.targetChartId !== state.chart.id || action.targetChartGeneration !== state.chartGeneration || state.assetRequestIds[action.requestKey] !== action.requestId) return state;
      const current = state.chart.objects.find((object) => object.id === action.id);
      if (!current || current.type !== "image") return state;
      const assetRequestIds = withoutAssetRequest(state, action.requestKey);
      return pushHistory({ ...state, assetRequestIds }, withChartAsset({
        ...state.chart,
        objects: state.chart.objects.map((object) => object.id === action.id ? { ...current, href: action.href, height: current.width * action.aspectRatio, label: action.label } : object),
      }, action.asset), action.status);
    }
    case "SET_OVERLAY_ASSET": {
      if (action.targetChartId !== state.chart.id || action.targetChartGeneration !== state.chartGeneration || state.assetRequestIds[action.requestKey] !== action.requestId) return state;
      const current = action.key === "backgroundImage" ? normalizeOverlay(state.chart.backgroundImage) : state.chart.referenceChart;
      const assetRequestIds = withoutAssetRequest(state, action.requestKey);
      if (!current && action.replacesHref) return { ...state, assetRequestIds };
      const overlay = current ? { ...current, href: action.href } : action.fallback;
      return pushHistory({ ...state, assetRequestIds }, withChartAsset({ ...state.chart, [action.key]: overlay }, action.asset), action.status);
    }
    case "REQUEST_FIT":
      return { ...state, fitGeneration: state.fitGeneration + 1 };
    case "SET_TOOL":
      return {
        ...state,
        tool: action.tool,
        toolMode: defaultModeForTool(action.tool),
        draftPoints: [],
        status: toolStatus(action.tool),
      };
    case "SET_TOOL_MODE": {
      const tool = primaryToolForMode(action.mode);
      return {
        ...state,
        tool,
        toolMode: action.mode,
        draftPoints: [],
        status: toolStatus(tool),
      };
    }
    case "SET_VIEWPORT":
      return { ...state, viewport: { ...state.viewport, ...action.viewport } };
    case "SELECT": {
      const ids = action.additive
        ? [...action.ids.reduce<readonly string[]>((selected, id) => toggleSelection(selected, id), state.selectedIds)]
        : action.ids;
      return { ...state, selectedIds: ids, selectedSeatIds: [] };
    }
    case "SELECT_SEATS": {
      const ids = action.remove
        ? state.selectedSeatIds.filter((id) => !action.ids.includes(id))
        : action.additive
        ? Array.from(new Set([...state.selectedSeatIds, ...action.ids]))
        : action.ids;
      return { ...state, selectedSeatIds: ids, selectedIds: [] };
    }
    case "CLEAR_SELECTION":
      return { ...state, selectedIds: [], selectedSeatIds: [] };
    case "COMMIT":
      return pushHistory(state, action.chart, action.status);
    case "UNDO": {
      if (state.past.length === 0) return state;
      const prev = state.past[state.past.length - 1];
      return {
        ...state,
        chart: prev.chart,
        selectedIds: [...prev.selectedIds],
        selectedSeatIds: [...prev.selectedSeatIds],
        past: state.past.slice(0, -1),
        future: [{ chart: state.chart, selectedIds: state.selectedIds, selectedSeatIds: state.selectedSeatIds }, ...state.future],
        status: ko.undone,
      };
    }
    case "REDO": {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      return {
        ...state,
        chart: next.chart,
        selectedIds: [...next.selectedIds],
        selectedSeatIds: [...next.selectedSeatIds],
        past: [...state.past, { chart: state.chart, selectedIds: state.selectedIds, selectedSeatIds: state.selectedSeatIds }],
        future: state.future.slice(1),
        status: ko.redone,
      };
    }
    case "TOGGLE_SETTING":
      return {
        ...state,
        settings: {
          ...state.settings,
          [action.key]: !state.settings[action.key],
        },
      };
    case "SET_LAYER":
      return { ...state, settings: { ...state.settings, selectionLayer: action.layer } };
    case "SET_DRAFT":
      return { ...state, draftPoints: action.points };
    case "SET_CLIPBOARD":
      return { ...state, clipboard: action.objects };
    case "SET_PREVIEW":
      return { ...state, preview: action.preview };
    case "SET_CATEGORIES_OPEN":
      return { ...state, categoriesOpen: action.open };
    case "SET_CHART_SETTINGS_OPEN":
      return { ...state, chartSettingsOpen: action.open };
    case "SET_FLOORS_OPEN":
      return { ...state, floorsOpen: action.open };
    case "SET_TUTORIAL_OPEN":
      return { ...state, tutorialOpen: action.open };
    case "SET_ACTIVE_FLOOR":
      return {
        ...state,
        chart: { ...state.chart, activeFloorId: action.floorId },
        selectedIds: [],
        selectedSeatIds: [],
        fitGeneration: state.fitGeneration + 1,
      };
    case "SET_STATUS":
      return { ...state, status: action.status };
    case "SET_NAME":
      return pushHistory(state, { ...state.chart, name: action.name }, ko.renamed);
    case "SET_BOUND_VENUE":
      return { ...state, boundVenue: action.venue };
    case "SET_SERVER_STATUS":
      return { ...state, serverStatus: action.status };
    case "SET_SEARCH_QUERY":
      return { ...state, searchQuery: action.query };
    case "SET_SEARCH_OPEN":
      return { ...state, searchOpen: action.open };
    default:
      return state;
  }
}

function toolStatus(tool: ToolId): string {
  return ko.toolHints[tool];
}

export function useSeatEditor() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const dragRef = useRef<{
    mode: "pan" | "move" | "marquee" | "draw" | "brush" | "node" | "row-end";
    startScreen: Point;
    startWorld: Point;
    originViewport: Viewport;
    originChart?: ChartDocument;
    nodeObjectId?: string;
    nodeIndex?: number;
    rowEnd?: "start" | "end";
    moved?: boolean;
  } | null>(null);
  const iconIndexRef = useRef(0);

  useEffect(() => {
    try {
      if (localStorage.getItem(TUTORIAL_KEY) === "done") {
        dispatch({ type: "SET_TUTORIAL_OPEN", open: false });
      }
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ChartDocument;
        if (parsed?.objects && parsed?.categories) {
          dispatch({ type: "RESTORE_LOCAL", chart: parsed });
          dispatch({ type: "SET_STATUS", status: ko.loadedSaved });
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  const validation = useMemo(() => validateChart(state.chart), [state.chart]);
  const allValid = blockingValidationItems(state.chart).length === 0;

  const saveLocal = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.chart));
    dispatch({ type: "SET_STATUS", status: ko.saved });
  }, [state.chart]);

  const saveToServer = useCallback(async () => {
    try {
      dispatch({ type: "SET_SERVER_STATUS", status: "서버 저장 중…" });
      const { apiSaveChart } = await import("@/lib/seat-charts/client");
      const rec = await apiSaveChart(state.chart, state.boundVenue);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rec.chart));
      dispatch({ type: "LOAD", chart: rec.chart });
      dispatch({ type: "SET_BOUND_VENUE", venue: rec.boundVenue });
      dispatch({ type: "SET_STATUS", status: "서버에 저장됨" });
      dispatch({ type: "SET_SERVER_STATUS", status: `저장 완료 · ${rec.updatedAt}` });
      return true;
    } catch {
      dispatch({ type: "SET_SERVER_STATUS", status: "서버 저장 실패" });
      dispatch({ type: "SET_STATUS", status: "서버 저장 실패" });
      return false;
    }
  }, [state.chart, state.boundVenue]);

  const publishToServer = useCallback(
    async (publish = true) => {
      if (publish && !state.boundVenue) {
        dispatch({ type: "SET_SERVER_STATUS", status: "공연장을 먼저 선택하세요." });
        return;
      }
      try {
        // ensure saved first
        const { apiSaveChart, apiPublishChart } = await import("@/lib/seat-charts/client");
        dispatch({ type: "SET_SERVER_STATUS", status: publish ? "게시 중…" : "게시 취소 중…" });
        const saved = await apiSaveChart(state.chart, state.boundVenue);
        const rec = await apiPublishChart(saved.id, publish, saved.boundVenue);
        dispatch({ type: "LOAD", chart: rec.chart });
        dispatch({ type: "SET_BOUND_VENUE", venue: rec.boundVenue });
        dispatch({
          type: "SET_STATUS",
          status: publish ? "게시됨" : "게시 취소됨",
        });
        dispatch({
          type: "SET_SERVER_STATUS",
          status: publish ? "게시됨" : "게시 취소됨",
        });
      } catch {
        dispatch({ type: "SET_SERVER_STATUS", status: "게시 실패" });
      }
    },
    [state.chart, state.boundVenue],
  );

  const loadFromServer = useCallback(async (id: string) => {
    try {
      dispatch({ type: "SET_SERVER_STATUS", status: "차트 불러오는 중…" });
      const { apiGetChart } = await import("@/lib/seat-charts/client");
      const rec = await apiGetChart(id);
      dispatch({ type: "LOAD", chart: rec.chart });
      dispatch({ type: "SET_BOUND_VENUE", venue: rec.boundVenue });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rec.chart));
      dispatch({ type: "SET_STATUS", status: `불러옴: ${rec.chart.name}` });
      dispatch({ type: "SET_SERVER_STATUS", status: `서버 차트 · ${rec.updatedAt}` });
    } catch {
      dispatch({ type: "SET_SERVER_STATUS", status: "불러오기 실패" });
    }
  }, []);

  const deleteFromServer = useCallback(async (id: string) => {
    try {
      const { apiDeleteChart } = await import("@/lib/seat-charts/client");
      await apiDeleteChart(id);
      dispatch({ type: "SET_SERVER_STATUS", status: "서버에서 삭제됨" });
    } catch {
      dispatch({ type: "SET_SERVER_STATUS", status: "삭제 실패" });
    }
  }, []);

  const selectBySearch = useCallback(
    (query: string) => {
      const q = query.trim().toLowerCase();
      if (!q) {
        dispatch({ type: "CLEAR_SELECTION" });
        return;
      }
      const ids: string[] = [];
      const seatIds: string[] = [];
      for (const obj of state.chart.objects) {
        if (obj.label.toLowerCase().includes(q) || (obj.displayedLabel ?? "").toLowerCase().includes(q)) {
          ids.push(obj.id);
        }
        if (obj.type === "row") {
          for (const s of obj.seats) {
            if (s.label.toLowerCase().includes(q) || (s.displayedLabel ?? "").toLowerCase().includes(q)) {
              seatIds.push(s.id);
            }
          }
        }
        if (obj.type === "table") {
          for (const s of obj.seats) {
            if (s.label.toLowerCase().includes(q)) seatIds.push(s.id);
          }
        }
        if (obj.type === "section" && obj.nestedRows) {
          for (const row of obj.nestedRows) {
            if (row.label.toLowerCase().includes(q)) ids.push(row.id);
            for (const s of row.seats) {
              if (s.label.toLowerCase().includes(q)) seatIds.push(s.id);
            }
          }
        }
      }
      if (seatIds.length) dispatch({ type: "SELECT_SEATS", ids: seatIds });
      else if (ids.length) dispatch({ type: "SELECT", ids });
      else dispatch({ type: "SET_STATUS", status: `검색 결과 없음: ${query}` });
      if (ids.length || seatIds.length) {
        dispatch({
          type: "SET_STATUS",
          status: `검색 ${ids.length + seatIds.length}건 선택`,
        });
      }
    },
    [state.chart.objects],
  );

  const exportJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(state.chart, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${state.chart.name.replace(/\s+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    dispatch({ type: "SET_STATUS", status: ko.exported });
  }, [state.chart]);

  const importJson = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const chart = JSON.parse(String(reader.result)) as ChartDocument;
        dispatch({ type: "LOAD", chart });
        dispatch({ type: "SET_STATUS", status: ko.imported });
      } catch {
        dispatch({ type: "SET_STATUS", status: ko.importFailed });
      }
    };
    reader.readAsText(file);
  }, []);

  const loadTemplate = useCallback((id: TemplateId) => {
    dispatch({ type: "LOAD", chart: buildTemplate(id) });
    dispatch({ type: "SET_STATUS", status: ko.loadedDemo });
  }, []);

  const startFromReference = useCallback((input: {
    readonly name: string;
    readonly href: string;
    readonly width: number;
    readonly height: number;
    readonly rows?: readonly RowObject[];
    readonly asset: SeatChartAsset;
  }) => {
    const chart = buildTemplate("blank");
    dispatch({
      type: "LOAD",
      chart: withChartAsset({
        ...chart,
        name: input.name,
        objects: input.rows ?? [],
        referenceChart: {
          href: input.href,
          x: 100,
          y: 80,
          width: input.width,
          height: input.height,
          opacity: 0.48,
          locked: true,
        },
      }, input.asset),
    });
    dispatch({
      type: "SET_STATUS",
      status: input.rows?.length ? `참조 도면에서 ${input.rows.length}개 행 생성` : "참조 도면으로 시작",
    });
  }, []);

  const resetDemo = useCallback(() => {
    loadTemplate("blank");
  }, [loadTemplate]);

  const deleteSelected = useCallback(() => {
    if (state.selectedIds.length === 0) return;
    dispatch({
      type: "COMMIT",
      chart: removeObjects(state.chart, state.selectedIds),
      status: `${ko.deleted} (${state.selectedIds.length})`,
    });
    dispatch({ type: "CLEAR_SELECTION" });
  }, [state.chart, state.selectedIds]);

  const copySelected = useCallback(() => {
    const objs = state.chart.objects.filter((o) => state.selectedIds.includes(o.id) && !o.locked);
    dispatch({ type: "SET_CLIPBOARD", objects: objs });
    dispatch({ type: "SET_STATUS", status: `${ko.copied} (${objs.length})` });
  }, [state.chart.objects, state.selectedIds]);

  const pasteClipboard = useCallback(() => {
    if (state.clipboard.length === 0) return;
    const clones = state.clipboard.map((obj) => {
      const json = JSON.parse(JSON.stringify(obj)) as ChartObject;
      return cloneObjectWithOffset(json, 32);
    });
    dispatch({
      type: "COMMIT",
      chart: { ...state.chart, objects: [...state.chart.objects, ...clones] },
      status: `${ko.pasted} (${clones.length})`,
    });
    dispatch({ type: "SELECT", ids: clones.map((c) => c.id) });
  }, [state.chart, state.clipboard]);

  const duplicateSelected = useCallback(() => {
    if (state.selectedIds.length === 0) return;
    const next = duplicateObjects(state.chart, state.selectedIds);
    const newIds = next.objects.slice(state.chart.objects.length).map((o) => o.id);
    dispatch({ type: "COMMIT", chart: next, status: ko.duplicated });
    dispatch({ type: "SELECT", ids: newIds });
  }, [state.chart, state.selectedIds]);

  const flip = useCallback(
    (axis: "h" | "v") => {
      if (state.selectedIds.length === 0) return;
      const origin = state.chart.focalPoint ?? { x: 900, y: 820 };
      dispatch({
        type: "COMMIT",
        chart: flipObjects(state.chart, state.selectedIds, axis, origin),
        status: axis === "h" ? ko.flippedH : ko.flippedV,
      });
    },
    [state.chart, state.selectedIds],
  );

  const align = useCallback(() => {
    if (state.selectedIds.length < 2) return;
    dispatch({
      type: "COMMIT",
      chart: alignCenter(state.chart, state.selectedIds),
      status: ko.aligned,
    });
  }, [state.chart, state.selectedIds]);

  const setCategoryOnSelection = useCallback(
    (categoryKey: string) => {
      if (state.selectedIds.length === 0) return;
      dispatch({
        type: "COMMIT",
        chart: applyCategory(state.chart, state.selectedIds, categoryKey),
        status: ko.categoryApplied,
      });
    },
    [state.chart, state.selectedIds],
  );

  const updateCategories = useCallback(
    (categories: ChartDocument["categories"]) => {
      dispatch({
        type: "COMMIT",
        chart: { ...state.chart, categories: [...categories] },
        status: ko.categoriesUpdated,
      });
    },
    [state.chart],
  );

  const screenToWorld = useCallback(
    (sx: number, sy: number, rect: DOMRect, disableSnap = false): Point => {
      const x = (sx - rect.left - state.viewport.x) / state.viewport.zoom;
      const y = (sy - rect.top - state.viewport.y) / state.viewport.zoom;
      return snapPoint({ x, y }, state.settings.gridSize, state.settings.snapToGrid && !disableSnap);
    },
    [state.viewport, state.settings.gridSize, state.settings.snapToGrid],
  );

  const commitCreatedObjects = useCallback(
    (start: Point, end: Point, points: readonly Point[]) => {
      const sequence = state.chart.objects.length + 1;
      const objects = createObjectsForMode({
        mode: state.toolMode,
        start,
        end,
        points,
        sequence,
        floorId: state.chart.activeFloorId,
        categoryKey: state.chart.categories[0]?.key,
      });
      if (objects.length === 0) return false;
      dispatch({
        type: "COMMIT",
        chart: { ...state.chart, objects: [...state.chart.objects, ...objects] },
        status: `${objects.length}개 객체 추가`,
      });
      dispatch({ type: "SELECT", ids: objects.map((object) => object.id) });
      return true;
    },
    [state.chart, state.toolMode],
  );

  const addImageFileAtPoint = useCallback(async (file: File, world: Point) => {
    if (referenceAssetSizeError(file.size)) {
      dispatch({ type: "SET_STATUS", status: "이미지는 10MB 이하여야 합니다." });
      return false;
    }
    const targetChartId = state.chart.id;
    const targetChartGeneration = state.chartGeneration;
    const requestKey = `object:${uid("asset-slot")}`;
    const requestId = uid("asset-request");
    dispatch({ type: "BEGIN_ASSET_REQUEST", key: requestKey, requestId });
    try {
      const { apiUploadReferenceAsset } = await import("@/lib/seat-charts/client");
      const { asset, url: href } = await apiUploadReferenceAsset({ file, purpose: "object" });
      const scale = Math.min(1, 560 / asset.width, 420 / asset.height);
      const object: ChartObject = {
        id: uid("image"),
        type: "image",
        label: file.name || "이미지",
        layer: "background",
        floorId: state.chart.activeFloorId,
        x: world.x,
        y: world.y,
        width: asset.width * scale,
        height: asset.height * scale,
        href,
      };
      dispatch({ type: "ADD_OBJECT", object, asset, status: ko.imageAdded, select: true, targetChartId, targetChartGeneration, requestKey, requestId });
      return true;
    } catch {
      dispatch({ type: "END_ASSET_REQUEST", key: requestKey, requestId });
      dispatch({ type: "SET_STATUS", status: "이미지 업로드 실패" });
      return false;
    }
  }, [state.chart.activeFloorId, state.chart.id, state.chartGeneration]);

  const placeObjectAt = useCallback(
    (world: Point) => {
      const { tool, toolMode, chart, settings, draftPoints } = state;
      const cat = chart.categories[0]?.key;
      const floorId = chart.activeFloorId;

      if (tool === "focal") {
        dispatch({
          type: "COMMIT",
          chart: { ...chart, focalPoint: world },
          status: ko.focalSet,
        });
        return;
      }

      if (tool === "table" && toolMode === "tableRound") {
        commitCreatedObjects(world, { x: world.x + 28, y: world.y }, [world]);
        return;
      }

      if (tool === "text") {
        const text = window.prompt(ko.textPrompt, ko.defaultLabel) ?? ko.defaultLabel;
        const obj: ChartObject = {
          id: uid("text"),
          type: "text",
          label: text,
          layer: "foreground",
          floorId,
          position: world,
          text,
          fontSize: 14,
          color: settings.darkCanvas ? "#eee" : "#333",
        };
        dispatch({ type: "COMMIT", chart: addObject(chart, obj), status: ko.textAdded });
        return;
      }

      if (tool === "icon") {
        const icon = ICON_CYCLE[iconIndexRef.current % ICON_CYCLE.length];
        iconIndexRef.current += 1;
        const labels: Record<(typeof ICON_CYCLE)[number], string> = {
          stage: "무대 아이콘",
          entrance: "입구",
          wc: "화장실",
          star: "별",
        };
        const obj: ChartObject = {
          id: uid("icon"),
          type: "icon",
          label: labels[icon],
          layer: "foreground",
          floorId,
          position: world,
          icon,
          size: 40,
        };
        dispatch({ type: "COMMIT", chart: addObject(chart, obj), status: ko.iconAdded });
        dispatch({ type: "SELECT", ids: [obj.id] });
        return;
      }

      if (tool === "image") {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/png,image/jpeg,image/gif,image/webp,image/svg+xml";
        input.onchange = () => {
          const file = input.files?.[0];
          if (!file) return;
          void addImageFileAtPoint(file, world);
        };
        input.click();
        return;
      }

      if (tool === "row") {
        if (toolMode === "rowSegmented") {
          dispatch({ type: "SET_DRAFT", points: [...draftPoints, world] });
          dispatch({ type: "SET_STATUS", status: `구간이 있는 열 (${draftPoints.length + 1}개 노드)` });
          return;
        }
        if (draftPoints.length === 0) {
          dispatch({ type: "SET_DRAFT", points: [world] });
          dispatch({ type: "SET_STATUS", status: ko.rowEnd });
        } else {
          const start = draftPoints[0];
          const label = `열 ${chart.objects.filter((o) => o.type === "row").length + 1}`;
          const row = { ...createRow(start, world, 12, label, cat), floorId };
          dispatch({ type: "COMMIT", chart: addObject(chart, row), status: ko.rowAdded });
          dispatch({ type: "SET_DRAFT", points: [] });
          dispatch({ type: "SELECT", ids: [row.id] });
        }
        return;
      }

      if (tool === "line") {
        dispatch({ type: "SET_DRAFT", points: [...draftPoints, world] });
        dispatch({ type: "SET_STATUS", status: `선 (${draftPoints.length + 1}개 노드, Enter로 완료)` });
        return;
      }

      if (
        tool === "section" ||
        toolMode === "areaPolygon" ||
        toolMode === "shapePolygon"
      ) {
        dispatch({ type: "SET_DRAFT", points: [...draftPoints, world] });
        dispatch({
          type: "SET_STATUS",
          status: `${tool === "section" ? ko.sectionPoints : "다각형 노드"} (${draftPoints.length + 1})`,
        });
      }
    },
    [addImageFileAtPoint, commitCreatedObjects, state],
  );

  const finishPolygon = useCallback(() => {
    const { tool, toolMode, draftPoints } = state;
    const minimum = tool === "line" || toolMode === "rowSegmented" ? 2 : 3;
    const supportsNodes =
      tool === "section" ||
      tool === "line" ||
      toolMode === "rowSegmented" ||
      toolMode === "areaPolygon" ||
      toolMode === "shapePolygon";
    if (!supportsNodes || draftPoints.length < minimum) {
      dispatch({ type: "SET_DRAFT", points: [] });
      return;
    }
    commitCreatedObjects(draftPoints[0], draftPoints[draftPoints.length - 1], draftPoints);
    dispatch({ type: "SET_DRAFT", points: [] });
  }, [commitCreatedObjects, state]);

  const finishRectangle = useCallback(
    (a: Point, b: Point) => {
      const width = Math.abs(b.x - a.x);
      const height = Math.abs(b.y - a.y);
      const isRow = state.toolMode === "row" || state.toolMode === "rowsMultiple";
      if (isRow && Math.hypot(width, height) < 8) return;
      const defaultRectangularTable = state.toolMode === "tableRectangular" && width < 4 && height < 4;
      if (!isRow && state.tool !== "booth" && !defaultRectangularTable && (width < 4 || height < 4)) return;
      commitCreatedObjects(a, b, [a, b]);
    },
    [commitCreatedObjects, state.tool, state.toolMode],
  );

  // keyboard
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target?.matches("input, textarea, select") || target?.isContentEditable) return;
      const meta = e.metaKey || e.ctrlKey;
      if (e.key === " " && !meta) {
        e.preventDefault();
        return;
      }
      if (meta && e.key.toLowerCase() === "z" && e.shiftKey) {
        e.preventDefault();
        dispatch({ type: "REDO" });
        return;
      }
      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        dispatch({ type: "UNDO" });
        return;
      }
      if (meta && e.key.toLowerCase() === "c") {
        e.preventDefault();
        copySelected();
        return;
      }
      if (meta && e.key.toLowerCase() === "v") {
        e.preventDefault();
        pasteClipboard();
        return;
      }
      if (meta && e.key.toLowerCase() === "j") {
        e.preventDefault();
        duplicateSelected();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA") return;
        e.preventDefault();
        deleteSelected();
        return;
      }
      if (e.key === "Enter" && state.draftPoints.length > 0) {
        e.preventDefault();
        finishPolygon();
        return;
      }
      if (e.key === "Escape") {
        dispatch({ type: "CLEAR_SELECTION" });
        dispatch({ type: "SET_DRAFT", points: [] });
        return;
      }
      const toolMap: Record<string, ToolId> = {
        v: "select",
        x: "selectSeats",
        c: "brush",
        z: "selectSame",
        a: "node",
        f: "focal",
        r: "row",
        s: "section",
        e: "table",
        b: "booth",
        g: "area",
        h: "rectangle",
        l: "line",
        t: "text",
        i: "image",
        o: "icon",
      };
      if (!meta && toolMap[e.key.toLowerCase()]) {
        dispatch({ type: "SET_TOOL", tool: toolMap[e.key.toLowerCase()] });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [copySelected, pasteClipboard, duplicateSelected, deleteSelected, finishPolygon, state.draftPoints.length]);

  const patchSelectedLabel = useCallback(
    (label: string) => {
      if (state.selectedIds.length !== 1) return;
      dispatch({
        type: "COMMIT",
        chart: setObjectLabel(state.chart, state.selectedIds[0], label),
        status: ko.renamed,
      });
    },
    [state.chart, state.selectedIds],
  );

  const patchRow = useCallback(
    (patch: { seatCount?: number; curve?: number; label?: string }) => {
      if (state.selectedIds.length !== 1) return;
      dispatch({
        type: "COMMIT",
        chart: setRowGeometry(state.chart, state.selectedIds[0], patch),
        status: "열 속성 변경",
      });
    },
    [state.chart, state.selectedIds],
  );

  const patchTable = useCallback(
    (patch: Parameters<typeof setTableProps>[2]) => {
      if (state.selectedIds.length !== 1) return;
      dispatch({
        type: "COMMIT",
        chart: setTableProps(state.chart, state.selectedIds[0], patch),
        status: "테이블 속성 변경",
      });
    },
    [state.chart, state.selectedIds],
  );

  const patchArea = useCallback(
    (capacity: number) => {
      if (state.selectedIds.length !== 1) return;
      dispatch({
        type: "COMMIT",
        chart: setAreaCapacity(state.chart, state.selectedIds[0], capacity),
        status: "영역 수용 인원 변경",
      });
    },
    [state.chart, state.selectedIds],
  );

  const patchAdvanced = useCallback(
    (patch: Parameters<typeof setObjectAdvanced>[2]) => {
      if (state.selectedIds.length !== 1) return;
      dispatch({
        type: "COMMIT",
        chart: setObjectAdvanced(state.chart, state.selectedIds[0], patch),
        status: "객체 속성 변경",
      });
    },
    [state.chart, state.selectedIds],
  );

  const patchDecoration = useCallback(
    (patch: Parameters<typeof setDecorationProps>[2]) => {
      if (state.selectedIds.length !== 1) return;
      dispatch({
        type: "COMMIT",
        chart: setDecorationProps(state.chart, state.selectedIds[0], patch),
        status: "도형 속성 변경",
      });
    },
    [state.chart, state.selectedIds],
  );

  const replaceSelectedImage = useCallback(async (file: File) => {
    if (state.selectedIds.length !== 1) return false;
    if (referenceAssetSizeError(file.size)) {
      dispatch({ type: "SET_STATUS", status: "이미지는 10MB 이하여야 합니다." });
      return false;
    }
    const selected = state.chart.objects.find((object) => object.id === state.selectedIds[0]);
    if (!selected || selected.type !== "image") return false;
    const targetChartId = state.chart.id;
    const targetChartGeneration = state.chartGeneration;
    const requestKey = `image:${selected.id}`;
    const requestId = uid("asset-request");
    dispatch({ type: "BEGIN_ASSET_REQUEST", key: requestKey, requestId });
    try {
      const { apiUploadReferenceAsset } = await import("@/lib/seat-charts/client");
      const uploaded = await apiUploadReferenceAsset({ file, purpose: "object" });
      const ratio = uploaded.asset.height / uploaded.asset.width;
      dispatch({
        type: "PATCH_IMAGE_ASSET",
        id: selected.id,
        href: uploaded.url,
        aspectRatio: ratio,
        label: file.name,
        asset: uploaded.asset,
        status: "이미지 교체",
        targetChartId,
        targetChartGeneration,
        requestKey,
        requestId,
      });
      return true;
    } catch {
      dispatch({ type: "END_ASSET_REQUEST", key: requestKey, requestId });
      dispatch({ type: "SET_STATUS", status: "이미지 교체 실패" });
      return false;
    }
  }, [state.chart, state.chartGeneration, state.selectedIds]);

  const updateChartMeta = useCallback(
    (patch: Partial<ChartDocument>, status = "차트 설정 변경") => {
      dispatch({
        type: "COMMIT",
        chart: { ...state.chart, ...patch },
        status,
      });
    },
    [state.chart],
  );

  const addPolygonNode = useCallback((objectId: string, index: number, point: Point) => {
    const object = state.chart.objects.find((candidate) => candidate.id === objectId);
    if (!object || verticesOf(object).length === 0) return;
    const updated = insertVertex(object, index, point);
    dispatch({
      type: "COMMIT",
      chart: { ...state.chart, objects: state.chart.objects.map((candidate) => candidate.id === objectId ? updated : candidate) },
      status: "노드 추가",
    });
  }, [state.chart]);

  const removePolygonNode = useCallback((objectId: string, index: number) => {
    const object = state.chart.objects.find((candidate) => candidate.id === objectId);
    if (!object || verticesOf(object).length === 0) return;
    const updated = removeVertex(object, index);
    dispatch({
      type: "COMMIT",
      chart: { ...state.chart, objects: state.chart.objects.map((candidate) => candidate.id === objectId ? updated : candidate) },
      status: "노드 삭제",
    });
  }, [state.chart]);

  const publishChart = useCallback(() => {
    void publishToServer(!state.chart.published);
  }, [publishToServer, state.chart.published]);

  const addFloor = useCallback(() => {
    const index = state.chart.floors.length + 1;
    const floor = { id: uid("floor"), name: `${index}층`, index };
    dispatch({
      type: "COMMIT",
      chart: { ...state.chart, floors: [...state.chart.floors, floor] },
      status: "층 추가됨",
    });
  }, [state.chart]);

  const renameFloor = useCallback(
    (floorId: string, name: string) => {
      dispatch({
        type: "COMMIT",
        chart: {
          ...state.chart,
          floors: state.chart.floors.map((f) => (f.id === floorId ? { ...f, name } : f)),
        },
        status: "층 이름 변경",
      });
    },
    [state.chart],
  );

  const removeFloor = useCallback(
    (floorId: string) => {
      if (state.chart.floors.length <= 1) return;
      const floors = state.chart.floors.filter((f) => f.id !== floorId);
      const activeFloorId =
        state.chart.activeFloorId === floorId ? floors[0].id : state.chart.activeFloorId;
      dispatch({
        type: "COMMIT",
        chart: {
          ...state.chart,
          floors,
          activeFloorId,
          objects: state.chart.objects.map((o) =>
            o.floorId === floorId ? { ...o, floorId: floors[0].id } : o,
          ),
        },
        status: "층 삭제됨",
      });
    },
    [state.chart],
  );

  const addZone = useCallback(() => {
    const zones = [...(state.chart.zones ?? [])];
    const id = uid("zone");
    dispatch({
      type: "COMMIT",
      chart: { ...addZoneToChart(state.chart, { id, name: `존 ${zones.length + 1}` }), venueType: state.chart.venueType ?? "zones" },
      status: "존 추가됨",
    });
  }, [state.chart]);

  const renameZone = useCallback((zoneId: string, name: string) => {
    dispatch({ type: "COMMIT", chart: renameZoneInChart(state.chart, zoneId, name), status: "존 이름 변경" });
  }, [state.chart]);

  const removeZone = useCallback((zoneId: string) => {
    dispatch({ type: "COMMIT", chart: removeZoneFromChart(state.chart, zoneId), status: "존 삭제" });
  }, [state.chart]);

  const patchSelectedSeats = useCallback((patch: Parameters<typeof setSeatProperties>[2]) => {
    if (state.selectedSeatIds.length === 0) return;
    dispatch({
      type: "COMMIT",
      chart: setSeatProperties(state.chart, state.selectedSeatIds, patch),
      status: `좌석 ${state.selectedSeatIds.length}개 속성 변경`,
    });
  }, [state.chart, state.selectedSeatIds]);

  const dismissTutorial = useCallback(() => {
    try {
      localStorage.setItem(TUTORIAL_KEY, "done");
    } catch {
      /* ignore */
    }
    dispatch({ type: "SET_TUTORIAL_OPEN", open: false });
  }, []);

  return {
    state,
    dispatch,
    validation,
    allValid,
    dragRef,
    saveLocal,
    saveToServer,
    publishToServer,
    loadFromServer,
    deleteFromServer,
    selectBySearch,
    exportJson,
    importJson,
    resetDemo,
    loadTemplate,
    startFromReference,
    deleteSelected,
    copySelected,
    pasteClipboard,
    duplicateSelected,
    flip,
    align,
    setCategoryOnSelection,
    updateCategories,
    screenToWorld,
    placeObjectAt,
    addImageFileAtPoint,
    finishPolygon,
    finishRectangle,
    patchSelectedLabel,
    patchRow,
    patchTable,
    patchArea,
    patchAdvanced,
    patchDecoration,
    replaceSelectedImage,
    updateChartMeta,
    addPolygonNode,
    removePolygonNode,
    publishChart,
    addFloor,
    renameFloor,
    removeFloor,
    addZone,
    renameZone,
    removeZone,
    patchSelectedSeats,
    dismissTutorial,
    commitTranslate: (ids: readonly string[], dx: number, dy: number) => {
      if (ids.length === 0 || (dx === 0 && dy === 0)) return;
      dispatch({
        type: "COMMIT",
        chart: translateMany(state.chart, ids, dx, dy),
        status: ko.moved,
      });
    },
    commitNodeMove: (objectId: string, pointIndex: number, point: Point) => {
      const object = state.chart.objects.find((candidate) => candidate.id === objectId);
      if (!object || verticesOf(object).length === 0) return;
      dispatch({
        type: "COMMIT",
        chart: {
          ...state.chart,
          objects: state.chart.objects.map((candidate) => candidate.id === objectId ? moveVertex(candidate, pointIndex, point) : candidate),
        },
        status: "노드 이동",
      });
    },
    commitRowEndpoints: (id: string, start: Point, end: Point) => {
      dispatch({
        type: "COMMIT",
        chart: setRowEndpoints(state.chart, id, start, end),
        status: "열 끝점 이동",
      });
    },
    commitResize: (id: string, bounds: ObjectBounds) => {
      dispatch({
        type: "COMMIT",
        chart: {
          ...state.chart,
          objects: state.chart.objects.map((object) => object.id === id ? resizeObject(object, bounds) : object),
        },
        status: "객체 크기 변경",
      });
    },
    commitRotation: (id: string, rotation: number) => {
      dispatch({
        type: "COMMIT",
        chart: {
          ...state.chart,
          objects: state.chart.objects.map((object) => object.id === id ? rotateObject(object, rotation) : object),
        },
        status: "객체 회전",
      });
    },
  };
}

export type SeatEditorApi = ReturnType<typeof useSeatEditor>;
