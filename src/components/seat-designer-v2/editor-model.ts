import type { ChartObject, Floor, Point, SeatChartAsset } from "@/types/seat-chart";
import type { SeatChartVenue } from "@/lib/seat-charts/types";
import type { V2ToolId } from "./tool-catalog";
import { constrainToAngleStep, type MultipleRowLayout } from "./row-geometry";

export type V2Point = Point;
export type V2ReferencePlan = {
  readonly asset: SeatChartAsset;
  readonly href: string;
  readonly name: string;
  readonly opacity: number;
  readonly locked: boolean;
  readonly visible: boolean;
  readonly aspectRatioLocked: boolean;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rotation: number;
};

export type V2Draft = {
  readonly start: V2Point;
  readonly current: V2Point;
  readonly points: readonly V2Point[];
};

export type V2EditorState = {
  readonly tool: V2ToolId;
  readonly name: string;
  readonly venue: SeatChartVenue | null;
  readonly objects: readonly ChartObject[];
  readonly selectedIds: readonly string[];
  readonly selectedSeatIds: readonly string[];
  readonly referencePlan: V2ReferencePlan | null;
  readonly rowSpacing: number;
  readonly seatSpacing: number;
  readonly multipleRowLayout: MultipleRowLayout;
  readonly focalPoint: V2Point | null;
  readonly draft: V2Draft | null;
  readonly pan: V2Point;
  readonly zoom: number;
  readonly showGrid: boolean;
  readonly selectionLayer: "all" | "interactive";
  readonly status: string;
  readonly chartId: string;
  readonly assets: readonly SeatChartAsset[];
  readonly floors: readonly Floor[];
  readonly activeFloorId: string;
  readonly activeSectionId: string | null;
};

export const INITIAL_STATE: V2EditorState = {
  tool: "row",
  name: "새 좌석 배치도",
  venue: null,
  objects: [],
  selectedIds: [],
  selectedSeatIds: [],
  referencePlan: null,
  rowSpacing: 14,
  seatSpacing: 5,
  multipleRowLayout: "aligned",
  focalPoint: null,
  draft: null,
  pan: { x: 0, y: 0 },
  zoom: 1,
  showGrid: true,
  selectionLayer: "all",
  status: "새 도면",
  chartId: `chart_${crypto.randomUUID()}`,
  assets: [],
  floors: [{ id: "floor_1", name: "1층", abbreviation: "1F", index: 1 }],
  activeFloorId: "floor_1",
  activeSectionId: null,
};

export function constrainedEnd(start: V2Point, end: V2Point, shift: boolean): V2Point {
  return shift ? constrainToAngleStep(start, end, 15) : end;
}

export function countPlaces(objects: readonly ChartObject[]): number {
  return objects.reduce((total, object) => {
    if (object.type === "row" || object.type === "table") return total + object.seats.length;
    if (object.type === "area" || object.type === "section") return total + (object.capacity ?? 0);
    return total;
  }, 0);
}
