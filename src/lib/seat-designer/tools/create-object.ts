import type { ChartObject, Point } from "../../../types/seat-chart.ts";
import { uid } from "../geometry.ts";

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

export function createObjectForTool(input: CreationInput): ChartObject | null {
  const width = Math.abs(input.end.x - input.start.x);
  const height = Math.abs(input.end.y - input.start.y);
  const x = Math.min(input.start.x, input.end.x);
  const y = Math.min(input.start.y, input.end.y);
  const common = { floorId: input.floorId };
  if (input.tool === "row") {
    if (Math.hypot(width, height) < 8) return null;
    const seatCount = Math.max(2, Math.round(Math.hypot(width, height) / 20));
    return { id: uid("row"), type: "row", label: `R${input.sequence}`, layer: "interactive", categoryKey: input.categoryKey, start: input.start, end: input.end, seatCount, seats: lineSeats(input.start, input.end, seatCount), ...common };
  }
  if (input.tool === "section") {
    if (input.points.length < 3) return null;
    return { id: uid("section"), type: "section", label: `구역 ${input.sequence}`, layer: "interactive", categoryKey: input.categoryKey, points: [...input.points], ...common };
  }
  if (input.tool === "table") {
    const radius = Math.max(18, Math.hypot(width, height));
    return { id: uid("table"), type: "table", label: `테이블 ${input.sequence}`, layer: "interactive", categoryKey: input.categoryKey, center: input.start, radius, seatCount: 8, seats: tableSeats(input.start, radius, 8), ...common };
  }
  if (input.tool === "area") {
    if (input.points.length < 3) return null;
    return { id: uid("area"), type: "area", label: `영역 ${input.sequence}`, layer: "interactive", categoryKey: input.categoryKey, points: [...input.points], capacity: 50, ...common };
  }
  if (input.tool === "booth") {
    if (width < 4 || height < 4) return null;
    return { id: uid("booth"), type: "booth", label: `부스 ${input.sequence}`, layer: "interactive", categoryKey: input.categoryKey, x, y, width, height, ...common };
  }
  if (input.tool === "rectangle") {
    if (width < 4 || height < 4) return null;
    return { id: uid("rectangle"), type: "rectangle", label: `사각형 ${input.sequence}`, layer: "background", x, y, width, height, fill: "#e5e7eb", stroke: "#9ca3af", ...common };
  }
  if (input.tool === "line") {
    if (Math.hypot(width, height) < 4) return null;
    return { id: uid("line"), type: "line", label: `선 ${input.sequence}`, layer: "background", start: input.start, end: input.end, stroke: "#6b7280", ...common };
  }
  if (input.tool === "text") return { id: uid("text"), type: "text", label: `텍스트 ${input.sequence}`, layer: "foreground", position: input.start, text: "텍스트", fontSize: 18, color: "#333333", ...common };
  if (input.tool === "image") {
    if (!input.imageHref) return null;
    return { id: uid("image"), type: "image", label: `이미지 ${input.sequence}`, layer: "background", x, y, width: Math.max(80, width), height: Math.max(60, height), href: input.imageHref, ...common };
  }
  if (input.tool === "icon") return { id: uid("icon"), type: "icon", label: `아이콘 ${input.sequence}`, layer: "foreground", position: input.start, icon: "stage", size: 32, ...common };
  return null;
}
