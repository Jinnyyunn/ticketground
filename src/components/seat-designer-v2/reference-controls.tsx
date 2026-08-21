import { Eye, EyeOff, Lock, Maximize2, Unlock } from "lucide-react";
import type { V2EditorState } from "./editor-model";
import { ActionButton, NumberField, ToggleField } from "./inspector-controls";
import { fitReferenceAsset } from "./reference-layout";

type ReferencePlan = NonNullable<V2EditorState["referencePlan"]>;

export function ReferenceControls({
  state,
  reference,
  onState,
  onReplace,
  onRemove,
}: {
  readonly state: V2EditorState;
  readonly reference: ReferencePlan;
  readonly onState: (next: V2EditorState) => void;
  readonly onReplace: (file: File) => void;
  readonly onRemove: () => void;
}) {
  const patch = (value: Partial<ReferencePlan>) => onState({ ...state, referencePlan: { ...reference, ...value } });
  return (
    <section className="mt-6 border-t border-[var(--editor-border)] pt-4" data-testid="seat-designer-v2-reference-controls">
      <h3 className="mb-3 font-semibold">참조 도면</h3>
      <div className="grid grid-cols-2 gap-2">
        <ActionButton onClick={() => patch({ visible: !reference.visible })}>
          {reference.visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          {reference.visible ? "숨기기" : "보이기"}
        </ActionButton>
        <ActionButton onClick={() => patch({ locked: !reference.locked })}>
          {reference.locked ? <Unlock className="size-4" /> : <Lock className="size-4" />}
          {reference.locked ? "잠금 해제" : "잠그기"}
        </ActionButton>
      </div>
      <div className="mt-4 space-y-3">
        <NumberField label="X" value={reference.x} suffix=" pt" onChange={(x) => patch({ x })} />
        <NumberField label="Y" value={reference.y} suffix=" pt" onChange={(y) => patch({ y })} />
        <NumberField
          label="너비"
          value={reference.width}
          suffix=" pt"
          min={40}
          onChange={(width) => patch(reference.aspectRatioLocked ? { width, height: Math.round(width * reference.asset.height / reference.asset.width) } : { width })}
        />
        <NumberField
          label="높이"
          value={reference.height}
          suffix=" pt"
          min={40}
          onChange={(height) => patch(reference.aspectRatioLocked ? { height, width: Math.round(height * reference.asset.width / reference.asset.height) } : { height })}
        />
        <ToggleField label="원본 비율 고정" checked={reference.aspectRatioLocked} onChange={(aspectRatioLocked) => patch({ aspectRatioLocked })} />
        <NumberField label="불투명도" value={Math.round(reference.opacity * 100)} suffix="%" min={5} max={100} onChange={(value) => patch({ opacity: value / 100 })} />
        <NumberField label="회전" value={reference.rotation} suffix="°" min={-360} max={360} onChange={(rotation) => patch({ rotation })} />
      </div>
      <button
        type="button"
        className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded border border-[var(--editor-border)] bg-[var(--editor-surface)] px-3 hover:bg-[var(--editor-hover)]"
        onClick={() => patch({ ...fitReferenceAsset(reference.asset, { width: 760, height: 560 }, { x: 80, y: 60 }), rotation: 0 })}
      >
        <Maximize2 className="size-4" />
        캔버스에 맞춤
      </button>
      <label className="mt-2 flex h-9 cursor-pointer items-center justify-center rounded border border-[var(--editor-border)] bg-[var(--editor-surface)] px-3 hover:bg-[var(--editor-hover)]">
        도면 교체
        <input
          type="file"
          className="sr-only"
          accept="image/png,image/jpeg,image/webp,image/svg+xml,application/pdf"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) onReplace(file);
            event.currentTarget.value = "";
          }}
        />
      </label>
      <button type="button" className="mt-2 w-full rounded border border-[var(--editor-danger-border)] bg-[var(--editor-surface)] px-3 py-2 text-[var(--editor-danger)] hover:bg-[var(--editor-danger-soft)]" onClick={onRemove}>
        참조 도면 제거
      </button>
    </section>
  );
}
