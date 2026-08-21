import type { ChartObject, Point, SeatPlace, ToolMode } from "../../../types/seat-chart.ts";
import { seatsAlongPolyline, uid } from "../geometry.ts";

type CreationTool = Exclude<ChartObject["type"], never>;

type CreationInput = {
  readonly tool: CreationTool;
  readonly start: Point;
  readonly end: Point;
  readonly points: readonly Point[];
  readonly sequence: number;
  readonly floorId: string;
  readonly categoryKey?: string;
  readonly imageHref?: string;
  readonly mode?: ToolMode;
};

function lineSeats(start: Point, end: Point, count: number) {
  return Array.from({ length: count }, (_, index) => {
    const ratio = count === 1 ? 0 : index / (count - 1);
    return { id: uid("seat"), label: String(index + 1), x: start.x + (end.x - start.x) * ratio, y: start.y + (end.y - start.y) * ratio };
  });
}

function tableSeats(center: Point, radius: number, count: number) {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
    return { id: uid("seat"), label: String(index + 1), x: center.x + Math.cos(angle) * (radius + 14), y: center.y + Math.sin(angle) * (radius + 14) };
  });
}

function sideSeats(start: Point, end: Point, count: number, offset: Point): SeatPlace[] {
  return Array.from({ length: count }, (_, index) => {
    const ratio = (index + 1) / (count + 1);
    return {
      id: uid("seat"),
      label: String(index + 1),
      x: start.x + (end.x - start.x) * ratio + offset.x,
      y: start.y + (end.y - start.y) * ratio + offset.y,
    };
  });
}

function rectangularTableSeats(center: Point, width: number, height: number) {
  const left = center.x - width / 2;
  const right = center.x + width / 2;
  const top = center.y - height / 2;
  const bottom = center.y + height / 2;
  return [
    ...sideSeats({ x: left, y: top }, { x: right, y: top }, 4, { x: 0, y: -14 }),
    ...sideSeats({ x: right, y: bottom }, { x: left, y: bottom }, 4, { x: 0, y: 14 }),
  ];
}

function boundsPoints(start: Point, end: Point): Point[] {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
}

export function createObjectForTool(input: CreationInput): ChartObject | null {
  const width = Math.abs(input.end.x - input.start.x);
  const height = Math.abs(input.end.y - input.start.y);
  const x = Math.min(input.start.x, input.end.x);
  const y = Math.min(input.start.y, input.end.y);
  const common = { floorId: input.floorId };
  if (input.tool === "row") {
    if (Math.hypot(width, height) < 8) return null;
    const seatCount = Math.max(2, Math.round(Math.hypot(width, height) / 20));
    return {
      id: uid("row"),
      type: "row",
      label: `R${input.sequence}`,
      layer: "interactive",
      categoryKey: input.categoryKey,
      start: input.start,
      end: input.end,
      seatCount,
      seats: input.mode === "rowSegmented"
        ? seatsAlongPolyline(input.points, seatCount, `R${input.sequence}`, input.categoryKey)
        : lineSeats(input.start, input.end, seatCount),
      path: input.mode === "rowSegmented" ? [...input.points] : undefined,
      rowStyle: input.mode === "rowSegmented" ? "segmented" : input.mode === "rowsMultiple" ? "multiple" : "straight",
      rowSpacing: 14,
      seatSpacing: 5,
      ...common,
    };
  }
  if (input.tool === "section") {
    if (input.points.length < 3) return null;
    return { id: uid("section"), type: "section", label: `구역 ${input.sequence}`, layer: "interactive", categoryKey: input.categoryKey, points: [...input.points], ...common };
  }
  if (input.tool === "table") {
    if (input.mode === "tableRectangular") {
      const center = { x: (input.start.x + input.end.x) / 2, y: (input.start.y + input.end.y) / 2 };
      return {
        id: uid("table"),
        type: "table",
        label: `테이블 ${input.sequence}`,
        layer: "interactive",
        categoryKey: input.categoryKey,
        center,
        radius: 18,
        seatCount: 8,
        shape: "rectangle",
        width: 120,
        height: 36,
        chairs: { top: 4, right: 0, bottom: 4, left: 0 },
        seats: rectangularTableSeats(center, 120, 36),
        ...common,
      };
    }
    const radius = Math.max(18, Math.hypot(width, height));
    return { id: uid("table"), type: "table", label: `테이블 ${input.sequence}`, layer: "interactive", categoryKey: input.categoryKey, center: input.start, radius, seatCount: 6, shape: "round", seats: tableSeats(input.start, radius, 6), ...common };
  }
  if (input.tool === "area") {
    const polygonal = input.mode === "areaPolygon" || input.mode === "area" || input.mode == null;
    const areaPoints = polygonal ? [...input.points] : boundsPoints(input.start, input.end);
    if (areaPoints.length < 3 || (!polygonal && (width < 4 || height < 4))) return null;
    return { id: uid("area"), type: "area", label: `영역 ${input.sequence}`, layer: "interactive", categoryKey: input.categoryKey, points: areaPoints, capacity: 50, shape: input.mode === "areaEllipse" ? "ellipse" : input.mode === "areaRectangle" ? "rectangle" : "polygon", ...common };
  }
  if (input.tool === "booth") {
    const boothWidth = width < 4 ? 50 : width;
    const boothHeight = height < 4 ? 50 : height;
    return { id: uid("booth"), type: "booth", label: `부스 ${input.sequence}`, layer: "interactive", categoryKey: input.categoryKey, x, y, width: boothWidth, height: boothHeight, ...common };
  }
  if (input.tool === "rectangle") {
    if (width < 4 || height < 4) return null;
    return { id: uid("rectangle"), type: "rectangle", label: `도형 ${input.sequence}`, layer: "background", x, y, width, height, shape: input.mode === "shapeEllipse" ? "ellipse" : input.mode === "shapePolygon" ? "polygon" : "rectangle", points: input.mode === "shapePolygon" ? [...input.points] : undefined, fill: "#e5e7eb", stroke: "#9ca3af", opacity: 1, ...common };
  }
  if (input.tool === "line") {
    if (Math.hypot(width, height) < 4) return null;
    return { id: uid("line"), type: "line", label: `선 ${input.sequence}`, layer: "background", start: input.start, end: input.end, points: input.points.length > 1 ? [...input.points] : [input.start, input.end], stroke: "#6b7280", ...common };
  }
  if (input.tool === "text") return { id: uid("text"), type: "text", label: `텍스트 ${input.sequence}`, layer: "foreground", position: input.start, text: "텍스트", fontSize: 18, color: "#333333", ...common };
  if (input.tool === "image") {
    if (!input.imageHref) return null;
    return { id: uid("image"), type: "image", label: `이미지 ${input.sequence}`, layer: "background", x, y, width: Math.max(80, width), height: Math.max(60, height), href: input.imageHref, ...common };
  }
  if (input.tool === "icon") return { id: uid("icon"), type: "icon", label: `아이콘 ${input.sequence}`, layer: "foreground", position: input.start, icon: "stage", size: 40, ...common };
  return null;
}
