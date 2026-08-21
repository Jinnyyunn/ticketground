import type { ChartObject, IconObject } from "@/types/seat-chart";
import { ColorField, NumberField, TextField, ToggleField } from "./inspector-controls";

const ICON_OPTIONS = [
  ["people", "2인"], ["male", "남"], ["female", "여"], ["cone", "콘"],
  ["entrance", "입구"], ["emergencyExit", "비상"], ["stairs", "계단"], ["tools", "시설"],
  ["signpost", "표지"], ["elevator", "승강"], ["coffee", "카페"], ["warning", "주의"],
] as const satisfies readonly (readonly [IconObject["icon"], string])[];

export function ObjectDecorationFields({ object, onObject }: { readonly object: ChartObject; readonly onObject: (object: ChartObject) => void }) {
  if (object.type === "rectangle") {
    return (
      <>
        <NumberField label="너비" value={object.width} suffix=" pt" min={8} onChange={(width) => onObject({ ...object, width })} />
        <NumberField label="높이" value={object.height} suffix=" pt" min={8} onChange={(height) => onObject({ ...object, height })} />
        <ColorField label="채우기" value={object.fill ?? "var(--editor-object)"} onChange={(fill) => onObject({ ...object, fill })} />
        <ColorField label="테두리" value={object.stroke ?? "var(--editor-object-stroke)"} onChange={(stroke) => onObject({ ...object, stroke })} />
        <NumberField label="불투명도" value={Math.round((object.opacity ?? 0.68) * 100)} suffix="%" min={5} max={100} onChange={(value) => onObject({ ...object, opacity: value / 100 })} />
      </>
    );
  }
  if (object.type === "line") return <ColorField label="선 색상" value={object.stroke ?? "var(--editor-line)"} onChange={(stroke) => onObject({ ...object, stroke })} />;
  if (object.type === "text") {
    return (
      <>
        <TextField label="텍스트" value={object.text} onChange={(text) => onObject({ ...object, text })} />
        <NumberField label="글자 크기" value={object.fontSize ?? 18} suffix=" pt" min={8} onChange={(fontSize) => onObject({ ...object, fontSize })} />
        <ColorField label="글자 색상" value={object.color ?? "var(--editor-text)"} onChange={(color) => onObject({ ...object, color })} />
        <label className="flex items-center justify-between">
          <span>정렬</span>
          <select aria-label="텍스트 정렬" className="h-9 rounded border border-[var(--editor-border)] bg-[var(--editor-surface)] px-2" value={object.align ?? "center"} onChange={(event) => onObject({ ...object, align: event.currentTarget.value as "left" | "center" | "right" })}>
            <option value="left">왼쪽</option><option value="center">가운데</option><option value="right">오른쪽</option>
          </select>
        </label>
      </>
    );
  }
  if (object.type === "image") {
    return (
      <>
        <ToggleField label="원본 비율 고정" checked={object.aspectRatioLocked ?? true} onChange={(aspectRatioLocked) => onObject({ ...object, aspectRatioLocked })} />
        <NumberField label="너비" value={object.width} suffix=" pt" min={8} onChange={(width) => onObject({ ...object, width, height: object.aspectRatioLocked === false ? object.height : Math.round(width * object.height / object.width) })} />
        <NumberField label="높이" value={object.height} suffix=" pt" min={8} onChange={(height) => onObject({ ...object, height, width: object.aspectRatioLocked === false ? object.width : Math.round(height * object.width / object.height) })} />
        <NumberField label="불투명도" value={Math.round((object.opacity ?? 1) * 100)} suffix="%" min={5} max={100} onChange={(value) => onObject({ ...object, opacity: value / 100 })} />
      </>
    );
  }
  if (object.type !== "icon") return null;
  return (
    <>
      <fieldset>
        <legend className="mb-2">아이콘</legend>
        <div className="grid grid-cols-4 gap-2">
          {ICON_OPTIONS.map(([icon, label]) => <button key={icon} type="button" title={label} aria-pressed={object.icon === icon} className={`h-11 rounded border text-xs ${object.icon === icon ? "border-[var(--editor-accent)] bg-[var(--editor-accent)] text-[var(--editor-on-accent)]" : "border-[var(--editor-border)] bg-[var(--editor-surface)] hover:bg-[var(--editor-hover)]"}`} onClick={() => onObject({ ...object, icon })}>{label}</button>)}
        </div>
      </fieldset>
      <NumberField label="크기" value={object.size ?? 40} suffix=" pt" min={12} onChange={(size) => onObject({ ...object, size })} />
      <ColorField label="색상" value={object.color ?? "var(--editor-text)"} onChange={(color) => onObject({ ...object, color })} />
    </>
  );
}
