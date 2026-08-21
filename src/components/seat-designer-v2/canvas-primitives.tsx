import type { ReactNode } from "react";
import type { ChartObject, Point, RectangleObject, SeatPlace } from "@/types/seat-chart";
import { objectBounds } from "./object-transform";

export function pointsValue(points: readonly Point[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

export function seatFill(seat: SeatPlace, selected: boolean): string {
  if (selected) return "var(--editor-accent)";
  if (seat.accessible) return "var(--editor-seat-accessible)";
  if (seat.companion) return "var(--editor-seat-companion)";
  if (seat.transferSeat) return "var(--editor-seat-transfer)";
  if (seat.restrictedView) return "var(--editor-seat-restricted)";
  return "var(--editor-seat)";
}

export function SelectionBox({ object }: { readonly object: ChartObject }): ReactNode {
  const bounds = objectBounds(object);
  return (
    <g data-testid="seat-designer-v2-selection-handles">
      <rect x={bounds.x - 5} y={bounds.y - 5} width={bounds.width + 10} height={bounds.height + 10} fill="none" stroke="var(--editor-accent)" strokeDasharray="4 3" />
      <circle cx={bounds.x - 5} cy={bounds.y - 5} r="4" fill="var(--editor-surface)" stroke="var(--editor-accent)" />
      <circle cx={bounds.x + bounds.width + 5} cy={bounds.y - 5} r="4" fill="var(--editor-surface)" stroke="var(--editor-accent)" />
      <circle cx={bounds.x - 5} cy={bounds.y + bounds.height + 5} r="4" fill="var(--editor-surface)" stroke="var(--editor-accent)" />
      <circle cx={bounds.x + bounds.width + 5} cy={bounds.y + bounds.height + 5} r="4" fill="var(--editor-surface)" stroke="var(--editor-accent)" />
      <circle cx={bounds.x + bounds.width / 2} cy={bounds.y - 22} r="5" fill="var(--editor-surface)" stroke="var(--editor-accent)" />
      <line x1={bounds.x + bounds.width / 2} y1={bounds.y - 5} x2={bounds.x + bounds.width / 2} y2={bounds.y - 17} stroke="var(--editor-accent)" />
    </g>
  );
}

export function RectangleNode({ object }: { readonly object: RectangleObject }): ReactNode {
  const transform = object.rotation ? `rotate(${object.rotation} ${object.x + object.width / 2} ${object.y + object.height / 2})` : undefined;
  if (object.shape === "ellipse") return <ellipse cx={object.x + object.width / 2} cy={object.y + object.height / 2} rx={object.width / 2} ry={object.height / 2} fill={object.fill ?? "var(--editor-object)"} fillOpacity={object.opacity ?? 0.68} stroke={object.stroke ?? "var(--editor-object-stroke)"} transform={transform} />;
  if (object.shape === "polygon" && object.points) return <polygon points={pointsValue(object.points)} fill={object.fill ?? "var(--editor-object)"} fillOpacity={object.opacity ?? 0.68} stroke={object.stroke ?? "var(--editor-object-stroke)"} />;
  return <rect x={object.x} y={object.y} width={object.width} height={object.height} fill={object.fill ?? "var(--editor-object)"} fillOpacity={object.opacity ?? 0.68} stroke={object.stroke ?? "var(--editor-object-stroke)"} transform={transform} />;
}
