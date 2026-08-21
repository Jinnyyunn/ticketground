import type { ChartObject, Point } from "@/types/seat-chart";

export function CanvasNodeHandles({ object, hidden, onInsert }: { readonly object: ChartObject; readonly hidden: boolean; readonly onInsert?: (objectId: string, afterIndex: number, point: Point) => void }) {
  if (!("points" in object) || !object.points) return null;
  return (
    <>
      {!hidden && onInsert && object.points.map((point, index) => {
        const nextIndex = index + 1;
        const next = object.type === "line" ? object.points?.[nextIndex] : object.points?.[nextIndex % object.points.length];
        if (!next) return null;
        const midpoint = { x: (point.x + next.x) / 2, y: (point.y + next.y) / 2 };
        return <circle key={`${object.id}-node-add-${index}`} cx={midpoint.x} cy={midpoint.y} r="4" fill="var(--editor-accent-soft)" stroke="var(--editor-accent)" data-testid="seat-designer-v2-node-add-handle" onPointerDown={(event) => { event.stopPropagation(); onInsert(object.id, index, midpoint); }} />;
      })}
      {object.points.map((point, index) => <circle key={`${object.id}-node-${index}`} cx={point.x} cy={point.y} r="5" fill="var(--editor-surface)" stroke="var(--editor-accent)" data-testid="seat-designer-v2-node-handle" />)}
    </>
  );
}
