import type { ChartObject } from "@/types/seat-chart";
import { CanvasObjects } from "./canvas-objects";
import type { V2EditorState } from "./editor-model";
import type { SmartGuide } from "./smart-guides";
import type { V2ToolId } from "./tool-catalog";

const PATH_TOOLS: readonly V2ToolId[] = ["segmentedRow", "section", "polygonalArea", "polygon"];

export function CanvasDraftLayer({ state, previewObjects, smartGuides }: { readonly state: V2EditorState; readonly previewObjects: readonly ChartObject[]; readonly smartGuides: readonly SmartGuide[] }) {
  const row = previewObjects[0]?.type === "row" ? previewObjects[0] : null;
  return (
    <>
      {smartGuides.map((guide, index) => <line key={`${guide.kind}-${guide.axis}-${guide.value}-${index}`} data-testid={`seat-designer-v2-guide-${guide.kind}`} x1={guide.axis === "x" ? guide.value : -4000} y1={guide.axis === "y" ? guide.value : -4000} x2={guide.axis === "x" ? guide.value : 4000} y2={guide.axis === "y" ? guide.value : 4000} stroke={guide.color === "red" ? "var(--editor-guide-center)" : guide.color === "blue" ? "var(--editor-guide-projection)" : "var(--editor-guide-axis)"} strokeWidth="1" vectorEffect="non-scaling-stroke" pointerEvents="none" />)}
      {previewObjects.length > 0 && (
        <g opacity="0.68" data-testid="seat-designer-v2-row-preview">
          <CanvasObjects objects={previewObjects} selectedIds={[]} selectedSeatIds={[]} nodeMode={false} showLabels={state.showLabels} />
          {row && <><line x1={row.start.x - (row.end.x - row.start.x) * 2} y1={row.start.y - (row.end.y - row.start.y) * 2} x2={row.end.x + (row.end.x - row.start.x) * 2} y2={row.end.y + (row.end.y - row.start.y) * 2} stroke="var(--editor-guide-extension)" /><g transform={`translate(${(row.start.x + row.end.x) / 2},${(row.start.y + row.end.y) / 2 - 20})`} data-testid="seat-designer-v2-row-count"><rect x="-28" y="-12" width="56" height="24" rx="4" fill="var(--editor-text)" /><text textAnchor="middle" dominantBaseline="central" fill="var(--editor-surface)" fontSize="12">{previewObjects.length > 1 ? `${previewObjects.length} × ${row.seats.length}` : row.seats.length}</text></g></>}
        </g>
      )}
      {state.draft && PATH_TOOLS.includes(state.tool) && <polyline data-testid={state.tool === "segmentedRow" ? "seat-designer-v2-segmented-path" : undefined} points={state.draft.points.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke="var(--editor-accent)" strokeWidth="2" />}
      {state.focalPoint && <g transform={`translate(${state.focalPoint.x} ${state.focalPoint.y})`} data-testid="seat-designer-v2-focal-point"><circle r="10" fill="none" stroke="var(--editor-danger)" /><path d="M-15 0H15M0-15V15" stroke="var(--editor-danger)" /></g>}
    </>
  );
}
