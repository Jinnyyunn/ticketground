import type { ChartObject, Point, ToolMode } from "@/types/seat-chart";
import { primaryToolForMode } from "../tool-catalog";
import { createObjectForTool } from "./create-object";

export type CreateObjectsInput = {
  readonly mode: ToolMode;
  readonly start: Point;
  readonly end: Point;
  readonly points: readonly Point[];
  readonly sequence: number;
  readonly floorId: string;
  readonly categoryKey?: string;
  readonly imageHref?: string;
};

function offsetPoint(point: Point, x: number, y: number): Point {
  return { x: point.x + x, y: point.y + y };
}

function multipleRows(input: CreateObjectsInput): readonly ChartObject[] {
  const dx = input.end.x - input.start.x;
  const dy = input.end.y - input.start.y;
  const length = Math.hypot(dx, dy);
  if (length < 8) return [];
  const nx = -dy / length;
  const ny = dx / length;
  return Array.from({ length: 5 }, (_, index) => {
    const offset = index * 14;
    return createObjectForTool({
      ...input,
      tool: "row",
      mode: "rowsMultiple",
      sequence: input.sequence + index,
      start: offsetPoint(input.start, nx * offset, ny * offset),
      end: offsetPoint(input.end, nx * offset, ny * offset),
    });
  }).filter((object): object is ChartObject => object !== null);
}

export function createObjectsForMode(input: CreateObjectsInput): readonly ChartObject[] {
  if (input.mode === "rowsMultiple") return multipleRows(input);
  const tool = primaryToolForMode(input.mode);
  if (
    tool === "select" ||
    tool === "selectSeats" ||
    tool === "brush" ||
    tool === "selectSame" ||
    tool === "node" ||
    tool === "focal" ||
    tool === "hand"
  ) {
    return [];
  }
  const object = createObjectForTool({ ...input, tool });
  return object ? [object] : [];
}
