import { Layers3, Plus, Settings2, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { V2EditorState } from "./editor-model";

type FloorBarProps = {
  readonly state: V2EditorState;
  readonly onState: (state: V2EditorState) => void;
};

export function FloorBar({ state, onState }: FloorBarProps) {
  const [open, setOpen] = useState(false);
  const section = state.objects.find(
    (object) => object.id === state.activeSectionId && object.type === "section",
  );

  function addFloor(): void {
    const index = Math.max(0, ...state.floors.map((floor) => floor.index)) + 1;
    const floor = {
      id: `floor_${crypto.randomUUID()}`,
      name: `${index}층`,
      abbreviation: `${index}F`,
      index,
    };
    onState({
      ...state,
      floors: [...state.floors, floor],
      activeFloorId: floor.id,
      activeSectionId: null,
      selectedIds: [],
      selectedSeatIds: [],
    });
  }

  function removeFloor(floorId: string): void {
    if (state.floors.length <= 1) return;
    const remaining = state.floors.filter((floor) => floor.id !== floorId);
    const fallback = remaining[0];
    if (!fallback) return;
    onState({
      ...state,
      floors: remaining,
      objects: state.objects.map((object) =>
        object.floorId === floorId ? { ...object, floorId: fallback.id } : object,
      ),
      activeFloorId: state.activeFloorId === floorId ? fallback.id : state.activeFloorId,
      activeSectionId: null,
      selectedIds: [],
      selectedSeatIds: [],
    });
  }

  return (
    <>
      <div
        className="absolute left-3 right-3 top-3 z-10 flex h-10 items-center gap-1 rounded border border-[var(--editor-border)] bg-[var(--editor-surface)] px-2 shadow-sm"
        data-testid="seat-designer-v2-floor-bar"
      >
        <Layers3 className="mr-1 size-4 text-[var(--editor-muted)]" />
        {state.floors.map((floor) => (
          <button
            key={floor.id}
            type="button"
            className={`h-7 rounded px-3 text-xs font-semibold ${floor.id === state.activeFloorId ? "bg-[var(--editor-accent)] text-[var(--editor-on-accent)]" : "hover:bg-[var(--editor-hover)]"}`}
            aria-pressed={floor.id === state.activeFloorId}
            onClick={() => onState({
              ...state,
              activeFloorId: floor.id,
              activeSectionId: null,
              selectedIds: [],
              selectedSeatIds: [],
            })}
          >
            {floor.abbreviation ?? floor.name}
          </button>
        ))}
        {section && (
          <>
            <span className="text-[var(--editor-muted)]">/</span>
            <button
              type="button"
              className="h-7 rounded bg-[var(--editor-accent-soft)] px-3 text-xs font-semibold text-[var(--editor-accent)]"
              onClick={() => onState({ ...state, activeSectionId: null, selectedIds: [section.id] })}
            >
              {section.label} 나가기
            </button>
          </>
        )}
        <button
          type="button"
          title="층 추가"
          className="ml-auto grid size-7 place-items-center rounded hover:bg-[var(--editor-hover)]"
          onClick={addFloor}
        >
          <Plus className="size-4" />
        </button>
        <button
          type="button"
          title="층 관리"
          className="grid size-7 place-items-center rounded hover:bg-[var(--editor-hover)]"
          onClick={() => setOpen(true)}
        >
          <Settings2 className="size-4" />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-[var(--editor-overlay)] p-4" role="dialog" aria-modal="true" aria-label="층 관리" data-testid="seat-designer-v2-floor-dialog">
          <section className="w-full max-w-md rounded border border-[var(--editor-border)] bg-[var(--editor-surface)] shadow-2xl">
            <header className="flex items-center justify-between border-b border-[var(--editor-border)] px-4 py-3">
              <h2 className="font-semibold">층 관리</h2>
              <button type="button" title="층 관리 닫기" className="grid size-8 place-items-center rounded hover:bg-[var(--editor-hover)]" onClick={() => setOpen(false)}><X className="size-4" /></button>
            </header>
            <div className="space-y-2 p-4">
              {state.floors.map((floor) => (
                <div key={floor.id} className="grid grid-cols-[5rem_1fr_2rem] gap-2">
                  <input aria-label={`${floor.name} 약어`} className="h-9 rounded border border-[var(--editor-border)] px-2" value={floor.abbreviation ?? ""} onChange={(event) => onState({ ...state, floors: state.floors.map((item) => item.id === floor.id ? { ...item, abbreviation: event.currentTarget.value } : item) })} />
                  <input aria-label={`${floor.name} 이름`} className="h-9 rounded border border-[var(--editor-border)] px-2" value={floor.name} onChange={(event) => onState({ ...state, floors: state.floors.map((item) => item.id === floor.id ? { ...item, name: event.currentTarget.value } : item) })} />
                  <button type="button" title={`${floor.name} 삭제`} disabled={state.floors.length <= 1} className="grid size-9 place-items-center rounded text-[var(--editor-danger)] hover:bg-[var(--editor-danger-soft)] disabled:opacity-30" onClick={() => removeFloor(floor.id)}><Trash2 className="size-4" /></button>
                </div>
              ))}
              <button type="button" className="flex h-9 w-full items-center justify-center gap-2 rounded border border-[var(--editor-border)] hover:bg-[var(--editor-hover)]" onClick={addFloor}><Plus className="size-4" />층 추가</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
