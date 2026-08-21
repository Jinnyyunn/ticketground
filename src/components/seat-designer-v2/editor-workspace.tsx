import { SlidersHorizontal } from "lucide-react";
import type { Dispatch, PointerEvent as ReactPointerEvent, SetStateAction } from "react";
import type { ChartObject, Point, SeatPlace } from "@/types/seat-chart";
import { CanvasDraftLayer } from "./canvas-draft-layer";
import { CanvasObjects } from "./canvas-objects";
import type { V2EditorState } from "./editor-model";
import { FloorBar } from "./floor-bar";
import { Inspector } from "./inspector";
import type { SmartGuide } from "./smart-guides";
import { Toolbar } from "./toolbar";
import type { V2ToolId } from "./tool-catalog";

type WorkspaceProps = {
  readonly state: V2EditorState;
  readonly setState: Dispatch<SetStateAction<V2EditorState>>;
  readonly commitState: (state: V2EditorState) => void;
  readonly visibleObjects: readonly ChartObject[];
  readonly previewObjects: readonly ChartObject[];
  readonly smartGuides: readonly SmartGuide[];
  readonly altPressed: boolean;
  readonly spacePressed: boolean;
  readonly selectTool: (tool: V2ToolId) => void;
  readonly pointerDown: (event: ReactPointerEvent<SVGSVGElement>) => void;
  readonly pointerMove: (event: ReactPointerEvent<SVGSVGElement>) => void;
  readonly pointerUp: (event: ReactPointerEvent<SVGSVGElement>) => void;
  readonly editNode: (event: ReactPointerEvent<SVGSVGElement>) => void;
  readonly removeNode: (event: ReactPointerEvent<SVGSVGElement>) => void;
  readonly onInsertNode: (objectId: string, afterIndex: number, point: Point) => void;
  readonly onObject: (object: ChartObject) => void;
  readonly onSeat: (seat: SeatPlace) => void;
  readonly onReplaceReference: (file: File) => void;
  readonly onRemoveReference: () => void;
  readonly onOpenInspector: () => void;
};

export function EditorWorkspace(props: WorkspaceProps) {
  const { state, setState } = props;
  return (
    <div className="flex min-h-0 flex-1">
      <Toolbar active={state.tool} onSelect={props.selectTool} />
      <main className="relative min-w-0 flex-1 overflow-hidden bg-[var(--editor-surface)]">
        <FloorBar state={state} onState={setState} onCommit={props.commitState} />
        <label className="absolute left-3 top-14 z-10 w-44 rounded border border-[var(--editor-border)] bg-[var(--editor-surface)] px-3 py-2 shadow-sm">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--editor-muted)]">선택 레이어</span>
          <select data-testid="seat-designer-v2-selection-layer" className="w-full bg-transparent text-sm font-medium text-[var(--editor-accent)] outline-none" value={state.selectionLayer} onChange={(event) => { const selectionLayer = event.currentTarget.value as "all" | "interactive"; setState((current) => ({ ...current, selectionLayer, selectedIds: [] })); }}><option value="all">전체 객체</option><option value="interactive">상호작용 객체</option></select>
        </label>
        <svg className={`seat-designer-v2-canvas size-full touch-none ${props.spacePressed || state.tool === "hand" ? "cursor-grab" : ""}`} data-canvas-theme={state.darkCanvas ? "dark" : "light"} data-testid="seat-designer-v2-canvas" onPointerDown={props.pointerDown} onPointerMove={props.pointerMove} onPointerUp={props.pointerUp} onDoubleClick={props.editNode} onContextMenu={props.removeNode}>
          <defs><pattern id="v2-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke={state.darkCanvas ? "var(--editor-grid-dark)" : "var(--editor-hover)"} strokeWidth="1" /></pattern></defs>
          <rect width="100%" height="100%" fill={state.darkCanvas ? "var(--editor-canvas-dark)" : "var(--editor-canvas)"} />
          {state.showGrid && <rect width="100%" height="100%" fill="url(#v2-grid)" />}
          <g transform={`translate(${state.pan.x} ${state.pan.y}) scale(${state.zoom})`}>
            {state.referencePlan?.visible && <image href={state.referencePlan.href} x={state.referencePlan.x} y={state.referencePlan.y} width={state.referencePlan.width} height={state.referencePlan.height} opacity={state.referencePlan.opacity} transform={`rotate(${state.referencePlan.rotation} ${state.referencePlan.x + state.referencePlan.width / 2} ${state.referencePlan.y + state.referencePlan.height / 2})`} preserveAspectRatio="xMidYMid meet" data-testid="seat-designer-v2-reference-plan" />}
            <CanvasObjects objects={props.visibleObjects} selectedIds={state.selectedIds} selectedSeatIds={state.selectedSeatIds} nodeMode={state.tool === "node"} showLabels={state.showLabels} hideNodeInsertHandles={props.altPressed} onInsertNode={props.onInsertNode} />
            <CanvasDraftLayer state={state} previewObjects={props.previewObjects} smartGuides={props.smartGuides} />
          </g>
        </svg>
        <div className="absolute bottom-3 left-3 flex items-center rounded-full border border-[var(--editor-border)] bg-[var(--editor-surface)] p-1 shadow-sm"><button className="size-8" type="button" onClick={() => setState((current) => ({ ...current, zoom: Math.max(0.25, current.zoom - 0.1) }))}>−</button><span className="w-12 text-center text-xs">{Math.round(state.zoom * 100)}%</span><button className="size-8" type="button" onClick={() => setState((current) => ({ ...current, zoom: Math.min(3, current.zoom + 0.1) }))}>＋</button></div>
      </main>
      <div className="hidden lg:block"><Inspector state={state} onState={setState} onObject={props.onObject} onSeat={props.onSeat} onEnterSection={(activeSectionId) => setState((current) => ({ ...current, activeSectionId, selectedIds: [], selectedSeatIds: [] }))} onReplaceReference={props.onReplaceReference} onRemoveReference={props.onRemoveReference} /></div>
      <button type="button" title="속성 패널" className="absolute bottom-14 right-3 z-20 grid size-10 place-items-center rounded-full bg-[var(--editor-accent)] text-[var(--editor-on-accent)] shadow-lg lg:hidden" onClick={props.onOpenInspector}><SlidersHorizontal className="size-4" /></button>
    </div>
  );
}
