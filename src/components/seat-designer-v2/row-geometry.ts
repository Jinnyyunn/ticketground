import type { Point, RowObject } from "@/types/seat-chart";

export type MultipleRowLayout = "aligned" | "staggered";

export function constrainToAngleStep(
  start: Point,
  end: Point,
  degrees: number,
): Point {
  const distance = Math.hypot(end.x - start.x, end.y - start.y);
  if (distance === 0) return end;
  const step = degrees * Math.PI / 180;
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const constrained = Math.round(angle / step) * step;
  return {
    x: start.x + Math.cos(constrained) * distance,
    y: start.y + Math.sin(constrained) * distance,
  };
}

export function rowDepth(row: Pick<RowObject, "start" | "end">, point: Point): number {
  const dx = row.end.x - row.start.x;
  const dy = row.end.y - row.start.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return 0;
  return ((point.x - row.start.x) * -dy + (point.y - row.start.y) * dx) / length;
}

function rowOffset(row: RowObject, distance: number, along: number): Point {
  const dx = row.end.x - row.start.x;
  const dy = row.end.y - row.start.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  return {
    x: -dy / length * distance + dx / length * along,
    y: dx / length * distance + dy / length * along,
  };
}

function moved(point: Point, offset: Point): Point {
  return { x: point.x + offset.x, y: point.y + offset.y };
}

export function buildMultipleRows(
  base: RowObject,
  depthPoint: Point,
  rowSpacing: number,
  layout: MultipleRowLayout,
): readonly RowObject[] {
  const spacing = Math.max(1, rowSpacing);
  const depth = rowDepth(base, depthPoint);
  const direction = depth < 0 ? -1 : 1;
  const count = Math.max(1, Math.floor(Math.abs(depth) / spacing) + 1);
  const seatPitch = base.seats.length > 1
    ? Math.hypot(
        (base.seats[1]?.x ?? base.start.x) - (base.seats[0]?.x ?? base.start.x),
        (base.seats[1]?.y ?? base.start.y) - (base.seats[0]?.y ?? base.start.y),
      )
    : 0;

  return Array.from({ length: count }, (_, index) => {
    const stagger = layout === "staggered" && index % 2 === 1 ? seatPitch / 2 : 0;
    const offset = rowOffset(base, index * spacing * direction, stagger);
    return {
      ...base,
      id: `row_${crypto.randomUUID()}`,
      label: `${base.label}-${index + 1}`,
      start: moved(base.start, offset),
      end: moved(base.end, offset),
      rowStyle: "multiple",
      rowSpacing: spacing,
      seats: base.seats.map((seat) => ({
        ...seat,
        ...moved(seat, offset),
        id: `seat_${crypto.randomUUID()}`,
      })),
    };
  });
}
