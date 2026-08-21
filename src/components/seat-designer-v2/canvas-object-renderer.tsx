import type { ReactNode } from "react";
import type { BaseObject, ChartObject, Point } from "@/types/seat-chart";
import { IconNode } from "./icon-node";
import { pointsValue, RectangleNode, seatFill } from "./canvas-primitives";
import { V2_OBJECT_COLORS } from "./design-tokens";

function canvasColor(color: string | undefined, initial: string, token: string): string {
  return !color || color.toLowerCase() === initial.toLowerCase() ? token : color;
}

function boxTransform(object: BaseObject, center: Point): string | undefined {
  if (!object.rotation && !object.flipX && !object.flipY) return undefined;
  return `translate(${center.x} ${center.y}) rotate(${object.rotation ?? 0}) scale(${object.flipX ? -1 : 1} ${object.flipY ? -1 : 1}) translate(${-center.x} ${-center.y})`;
}

export function renderCanvasObject(object: ChartObject, selectedSeatIds: readonly string[], showLabels: boolean): ReactNode {
  if (object.type === "row") return <g>{object.seats.map((seat) => <g key={seat.id} data-seat-id={seat.id}><circle cx={seat.x} cy={seat.y} r="7" fill={seatFill(seat, selectedSeatIds.includes(seat.id))} stroke={selectedSeatIds.includes(seat.id) ? "var(--editor-accent-strong)" : "var(--editor-seat-stroke)"} strokeWidth="1.5" />{showLabels && <text x={seat.x} y={seat.y + 3} textAnchor="middle" fontSize="7" fill="var(--editor-canvas-foreground)">{seat.label}</text>}</g>)}</g>;
  if (object.type === "table") return (
    <g>
      {object.shape === "rectangle" ? <rect x={object.center.x - (object.width ?? 120) / 2} y={object.center.y - (object.height ?? 36) / 2} width={object.width ?? 120} height={object.height ?? 36} rx="2" fill="var(--editor-table)" stroke="var(--editor-seat-stroke)" transform={object.rotation ? `rotate(${object.rotation} ${object.center.x} ${object.center.y})` : undefined} /> : <circle cx={object.center.x} cy={object.center.y} r={object.radius} fill="var(--editor-table)" stroke="var(--editor-seat-stroke)" />}
      {object.seats.map((seat) => <circle key={seat.id} data-seat-id={seat.id} cx={seat.x} cy={seat.y} r="7" fill={seatFill(seat, selectedSeatIds.includes(seat.id))} stroke={selectedSeatIds.includes(seat.id) ? "var(--editor-accent-strong)" : "var(--editor-seat-stroke)"} />)}
    </g>
  );
  if (object.type === "rectangle") return <RectangleNode object={object} transform={boxTransform(object, { x: object.x + object.width / 2, y: object.y + object.height / 2 })} />;
  if (object.type === "booth") return <g transform={boxTransform(object, { x: object.x + object.width / 2, y: object.y + object.height / 2 })}><rect x={object.x} y={object.y} width={object.width} height={object.height} rx="2" fill="var(--editor-booth)" stroke="var(--editor-seat-stroke)" /><text x={object.x + object.width / 2} y={object.y + object.height / 2 + 4} textAnchor="middle" fontSize="11" fill="var(--editor-canvas-foreground)">부스</text></g>;
  if (object.type === "area") return object.shape === "ellipse" ? <ellipse cx={((object.points[0]?.x ?? 0) + (object.points[2]?.x ?? 0)) / 2} cy={((object.points[0]?.y ?? 0) + (object.points[2]?.y ?? 0)) / 2} rx={Math.abs((object.points[2]?.x ?? 0) - (object.points[0]?.x ?? 0)) / 2} ry={Math.abs((object.points[2]?.y ?? 0) - (object.points[0]?.y ?? 0)) / 2} fill="var(--editor-area)" stroke="var(--editor-area-stroke)" /> : <polygon points={pointsValue(object.points)} fill="var(--editor-area)" stroke="var(--editor-area-stroke)" />;
  if (object.type === "section") return <polygon points={pointsValue(object.points)} fill={object.fill ?? "var(--editor-section)"} fillOpacity="0.7" stroke="var(--editor-section-stroke)" />;
  if (object.type === "line") return <polyline points={pointsValue(object.points ?? [object.start, object.end])} fill="none" stroke={object.stroke ?? "var(--editor-line)"} strokeWidth="3" />;
  if (object.type === "text") return <text x={object.position.x} y={object.position.y} textAnchor={object.align === "left" ? "start" : object.align === "right" ? "end" : "middle"} fontSize={object.fontSize ?? 18} fontWeight={object.weight ?? 500} fill={canvasColor(object.color, V2_OBJECT_COLORS.text, "var(--editor-canvas-foreground)")} transform={object.rotation ? `rotate(${object.rotation} ${object.position.x} ${object.position.y})` : undefined}>{object.text}</text>;
  if (object.type === "image") return <image href={object.href} x={object.x} y={object.y} width={object.width} height={object.height} opacity={object.opacity ?? 1} transform={boxTransform(object, { x: object.x + object.width / 2, y: object.y + object.height / 2 })} preserveAspectRatio="xMidYMid meet" />;
  return <g transform={object.rotation ? `rotate(${object.rotation} ${object.position.x} ${object.position.y})` : undefined}><IconNode object={object} /></g>;
}
