import type { V2EditorState } from "./editor-model";
import { Defaults, NumberField } from "./inspector-controls";
import { toolSpec } from "./tool-catalog";

export function ToolFields({ state, onState }: { readonly state: V2EditorState; readonly onState: (state: V2EditorState) => void }) {
  if (state.tool === "row" || state.tool === "multipleRows" || state.tool === "segmentedRow") {
    return (
      <div className="space-y-4">
        <NumberField label="행 간격" testId="seat-designer-v2-row-spacing" value={state.rowSpacing} suffix=" pt" min={8} onChange={(rowSpacing) => onState({ ...state, rowSpacing })} />
        <NumberField label="좌석 간격" testId="seat-designer-v2-seat-spacing" value={state.seatSpacing} suffix=" pt" min={0} onChange={(seatSpacing) => onState({ ...state, seatSpacing })} />
        {state.tool === "multipleRows" && (
          <label className="grid gap-2">
            <span>행 배치</span>
            <select
              aria-label="여러 행 배치"
              data-testid="seat-designer-v2-multiple-layout"
              className="h-9 rounded border border-[var(--editor-border)] bg-[var(--editor-surface)] px-2"
              value={state.multipleRowLayout}
              onChange={(event) => onState({ ...state, multipleRowLayout: event.currentTarget.value as "aligned" | "staggered" })}
            >
              <option value="aligned">정렬</option>
              <option value="staggered">엇갈림</option>
            </select>
          </label>
        )}
      </div>
    );
  }
  if (state.tool === "roundTable") return <Defaults rows={["의자 6개", "지름 56 pt", "클릭해서 배치 후 오른쪽에서 편집"]} />;
  if (state.tool === "rectangularTable") return <Defaults rows={["위 4 · 아래 4", "좌 0 · 우 0", "120 × 36 pt", "클릭해서 배치 후 오른쪽에서 편집"]} />;
  if (state.tool === "booth") return <Defaults rows={["기본 50 × 50 pt", "클릭해서 배치", "선택 후 너비와 높이 편집"]} />;
  if (state.tool === "icon") return <Defaults rows={["입구 · 무대 · 화장실 · 별", "기본 크기 40 pt", "캔버스 클릭으로 배치"]} />;
  if (state.tool === "image") return <Defaults rows={["PNG, GIF, JPEG, WEBP, SVG", "최대 15 MB", "선택 후 크기·불투명도·회전 편집"]} />;
  return <p className="text-sm leading-6 text-[var(--editor-muted)]">캔버스에서 {toolSpec(state.tool).label} 도구를 사용하세요. 선택한 도구의 제스처는 아래 도움말에 표시됩니다.</p>;
}
