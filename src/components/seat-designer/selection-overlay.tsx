"use client";

import { useRef, useState, type PointerEvent } from "react";
import type { ChartObject, Point } from "@/types/seat-chart";
import { objectCenter } from "@/lib/seat-designer/chart-ops";
import { objectBounds, resizeCornerForRotatedPointer, type ObjectBounds } from "@/lib/seat-designer/transforms";

type Corner = "nw" | "ne" | "se" | "sw";

function resized(bounds: ObjectBounds, corner: Corner, point: Point): ObjectBounds {
  const right = bounds.x + bounds.width;
  const bottom = bounds.y + bounds.height;
  if (corner === "nw") return { x: Math.min(point.x, right - 4), y: Math.min(point.y, bottom - 4), width: Math.max(4, right - point.x), height: Math.max(4, bottom - point.y) };
  if (corner === "ne") return { x: bounds.x, y: Math.min(point.y, bottom - 4), width: Math.max(4, point.x - bounds.x), height: Math.max(4, bottom - point.y) };
  if (corner === "sw") return { x: Math.min(point.x, right - 4), y: bounds.y, width: Math.max(4, right - point.x), height: Math.max(4, point.y - bounds.y) };
  return { x: bounds.x, y: bounds.y, width: Math.max(4, point.x - bounds.x), height: Math.max(4, point.y - bounds.y) };
}

export function SelectionOverlay({
  object,
  toWorld,
  onResize,
  onRotate,
}: {
  readonly object: ChartObject;
  readonly toWorld: (clientX: number, clientY: number) => Point | null;
  readonly onResize: (bounds: ObjectBounds) => void;
  readonly onRotate: (rotation: number) => void;
}) {
  const initial = objectBounds(object);
  const initialCenter = objectCenter(object);
  const [liveBounds, setLiveBounds] = useState<ObjectBounds | null>(null);
  const [liveRotation, setLiveRotation] = useState<number | null>(null);
  const drag = useRef<{ readonly kind: "resize"; readonly corner: Corner; readonly bounds: ObjectBounds } | { readonly kind: "rotate"; readonly center: Point } | null>(null);
  if (object.locked) return null;
  const bounds = liveBounds ?? initial;
  const corners: readonly { readonly id: Corner; readonly x: number; readonly y: number }[] = [
    { id: "nw", x: bounds.x, y: bounds.y },
    { id: "ne", x: bounds.x + bounds.width, y: bounds.y },
    { id: "se", x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { id: "sw", x: bounds.x, y: bounds.y + bounds.height },
  ];
  const centerForBounds = (next: ObjectBounds): Point => ({
    x: next.x + (initial.width === 0 ? 0.5 : (initialCenter.x - initial.x) / initial.width) * next.width,
    y: next.y + (initial.height === 0 ? 0.5 : (initialCenter.y - initial.y) / initial.height) * next.height,
  });
  const center = centerForBounds(bounds);
  const rotation = liveRotation ?? object.rotation ?? 0;

  const move = (event: PointerEvent<SVGCircleElement>) => {
    const current = drag.current;
    if (!current) return;
    const point = toWorld(event.clientX, event.clientY);
    if (!point) return;
    if (current.kind === "resize") {
      setLiveBounds(resized(current.bounds, current.corner, resizeCornerForRotatedPointer(point, current.bounds, initialCenter, current.corner, object.rotation ?? 0)));
      return;
    }
    const degrees = Math.atan2(point.y - current.center.y, point.x - current.center.x) * 180 / Math.PI + 90;
    setLiveRotation(degrees);
  };

  const finish = (event: PointerEvent<SVGCircleElement>) => {
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (drag.current?.kind === "resize" && liveBounds) onResize(liveBounds);
    if (drag.current?.kind === "rotate" && liveRotation !== null) onRotate(liveRotation);
    drag.current = null;
    setLiveBounds(null);
    setLiveRotation(null);
  };

  return (
    <g data-testid="selection-overlay" transform={rotation ? `rotate(${rotation} ${center.x} ${center.y})` : undefined}>
      <rect data-testid="selection-outline" x={bounds.x} y={bounds.y} width={bounds.width} height={bounds.height} fill="none" stroke="#087bea" strokeWidth={1.5} strokeDasharray="4 2" />
      <line x1={center.x} y1={bounds.y} x2={center.x} y2={bounds.y - 24} stroke="#087bea" strokeWidth={1.5} />
      <circle
        data-testid="rotation-handle"
        cx={center.x}
        cy={bounds.y - 28}
        r={5}
        fill="#fff"
        stroke="#087bea"
        strokeWidth={2}
        className="cursor-grab"
        onPointerDown={(event) => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); drag.current = { kind: "rotate", center }; }}
        onPointerMove={move}
        onPointerUp={finish}
      />
      {corners.map((corner) => (
        <circle
          key={corner.id}
          data-testid="resize-handle"
          data-corner={corner.id}
          cx={corner.x}
          cy={corner.y}
          r={5}
          fill="#fff"
          stroke="#087bea"
          strokeWidth={2}
          className="cursor-nwse-resize"
          onPointerDown={(event) => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); drag.current = { kind: "resize", corner: corner.id, bounds }; }}
          onPointerMove={move}
          onPointerUp={finish}
        />
      ))}
    </g>
  );
}
