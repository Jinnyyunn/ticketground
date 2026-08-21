import { Check } from "lucide-react";
import type { ChartObject, SeatPlace } from "@/types/seat-chart";
import { countPlaces, type V2EditorState } from "./editor-model";
import { ToggleField } from "./inspector-controls";
import { ObjectFields } from "./object-fields";
import { ReferenceControls } from "./reference-controls";
import { SeatFields } from "./seat-fields";
import { ToolFields } from "./tool-fields";
import { toolSpec } from "./tool-catalog";

type InspectorProps = {
  readonly state: V2EditorState;
  readonly onState: (next: V2EditorState) => void;
  readonly onObject: (object: ChartObject) => void;
  readonly onSeat: (seat: SeatPlace) => void;
  readonly onEnterSection: (sectionId: string) => void;
  readonly onReplaceReference: (file: File) => void;
  readonly onRemoveReference: () => void;
};

export function Inspector({ state, onState, onObject, onSeat, onEnterSection, onReplaceReference, onRemoveReference }: InspectorProps) {
  const selected = state.objects.find((object) => state.selectedIds.includes(object.id));
  const selectedSeat = state.objects
    .flatMap((object) => object.type === "row" || object.type === "table" ? object.seats : [])
    .find((seat) => state.selectedSeatIds.includes(seat.id));
  const spec = toolSpec(state.tool);
  return (
    <aside className="flex w-[var(--editor-inspector-width)] shrink-0 flex-col border-l border-[var(--editor-border)] bg-[var(--editor-panel)]" data-testid="seat-designer-v2-inspector">
      <h2 className="border-b border-[var(--editor-border)] bg-[var(--editor-surface)] px-4 py-4 text-base font-semibold">
        {selectedSeat ? "좌석 설정" : selected ? "객체 설정" : `${spec.label} 도구`}
      </h2>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {selectedSeat ? <SeatFields seat={selectedSeat} onSeat={onSeat} /> : selected ? <ObjectFields object={selected} onObject={onObject} onEnterSection={onEnterSection} /> : <ToolFields state={state} onState={onState} />}
        <section className="mt-6 border-t border-[var(--editor-border)] pt-4">
          <h3 className="mb-3 font-semibold">캔버스 표시</h3>
          <div className="space-y-3">
            <ToggleField label="격자" checked={state.showGrid} onChange={(showGrid) => onState({ ...state, showGrid })} />
            <ToggleField label="스냅" checked={state.snapToGrid} onChange={(snapToGrid) => onState({ ...state, snapToGrid })} />
            <ToggleField label="좌석 라벨" checked={state.showLabels} onChange={(showLabels) => onState({ ...state, showLabels })} />
            <ToggleField label="구역 내용" checked={state.showSectionContents} onChange={(showSectionContents) => onState({ ...state, showSectionContents })} />
            <ToggleField label="어두운 캔버스" checked={state.darkCanvas} onChange={(darkCanvas) => onState({ ...state, darkCanvas })} />
          </div>
        </section>
        {state.referencePlan && <ReferenceControls state={state} reference={state.referencePlan} onState={onState} onReplace={onReplaceReference} onRemove={onRemoveReference} />}
      </div>
      <div className="border-t border-[var(--editor-border)] bg-[var(--editor-surface)] p-4">
        <p className="flex items-center gap-2 text-[var(--editor-muted)]"><Check className="size-4" />편집 상태 확인</p>
        <p className="mt-3 text-[var(--editor-muted)]">{countPlaces(state.objects)} places</p>
        {state.selectedSeatIds.length > 0 && <p className="mt-1 font-medium text-[var(--editor-accent)]">{state.selectedSeatIds.length}개 좌석 선택됨</p>}
      </div>
    </aside>
  );
}
