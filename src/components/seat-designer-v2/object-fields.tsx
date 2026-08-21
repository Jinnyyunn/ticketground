import type { ChartObject, ObjectLayer } from "@/types/seat-chart";
import { NumberField, TextField, ToggleField } from "./inspector-controls";
import { ObjectDecorationFields } from "./object-decoration-fields";
import { ObjectTableFields } from "./object-table-fields";

export function ObjectFields({ object, onObject, onEnterSection }: { readonly object: ChartObject; readonly onObject: (object: ChartObject) => void; readonly onEnterSection: (sectionId: string) => void }) {
  return (
    <div className="space-y-4" data-testid="seat-designer-v2-object-fields">
      <TextField label="라벨" value={object.label} onChange={(label) => onObject({ ...object, label })} />
      <label className="flex items-center justify-between gap-3">
        <span>레이어</span>
        <select aria-label="레이어" className="h-9 rounded border border-[var(--editor-border)] bg-[var(--editor-surface)] px-2" value={object.layer} onChange={(event) => onObject({ ...object, layer: event.currentTarget.value as ObjectLayer })}>
          <option value="foreground">전경</option><option value="interactive">좌석/상호작용</option><option value="background">배경</option><option value="surroundings">주변 시설</option>
        </select>
      </label>
      <ToggleField label="객체 잠금" checked={object.locked ?? false} onChange={(locked) => onObject({ ...object, locked })} />
      {object.type === "row" && (
        <>
          <NumberField label="행 간격" value={object.rowSpacing ?? 14} suffix=" pt" min={8} onChange={(rowSpacing) => onObject({ ...object, rowSpacing })} />
          <NumberField label="좌석 간격" value={object.seatSpacing ?? 5} suffix=" pt" onChange={(seatSpacing) => onObject({ ...object, seatSpacing })} />
          <p className="rounded border bg-[var(--editor-surface)] px-3 py-2 text-sm text-[var(--editor-muted)]">좌석 {object.seatCount}개 · {object.rowStyle === "segmented" ? "구간 행" : object.rowStyle === "multiple" ? "여러 행" : "직선 행"}</p>
        </>
      )}
      <ObjectTableFields object={object} onObject={onObject} />
      {object.type === "booth" && <><NumberField label="너비" value={object.width} suffix=" pt" min={8} onChange={(width) => onObject({ ...object, width })} /><NumberField label="높이" value={object.height} suffix=" pt" min={8} onChange={(height) => onObject({ ...object, height })} /></>}
      {object.type === "area" && <NumberField label="정원" value={object.capacity} min={0} onChange={(capacity) => onObject({ ...object, capacity })} />}
      {object.type === "section" && <><NumberField label="정원" value={object.capacity ?? 0} min={0} onChange={(capacity) => onObject({ ...object, capacity })} /><button type="button" className="h-10 w-full rounded bg-[var(--editor-accent)] px-3 font-semibold text-[var(--editor-on-accent)] hover:bg-[var(--editor-accent-strong)]" onClick={() => onEnterSection(object.id)}>구역 내부 편집</button></>}
      <ObjectDecorationFields object={object} onObject={onObject} />
    </div>
  );
}
