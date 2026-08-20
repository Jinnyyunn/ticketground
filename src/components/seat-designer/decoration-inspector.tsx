"use client";

import type { ChartObject } from "@/types/seat-chart";
import type { DecorationPatch } from "@/lib/seat-designer/chart-ops";

type DecorationObject = Extract<ChartObject, { readonly type: "rectangle" | "booth" | "line" | "text" | "image" | "icon" }>;

function NumberField({ label, value, min, max, onChange }: { readonly label: string; readonly value: number; readonly min?: number; readonly max?: number; readonly onChange: (value: number) => void }) {
  return <label className="block text-[12px] text-[#666]">{label}<input type="number" min={min} max={max} value={value} className="mt-1 w-full rounded border border-black/10 px-2 py-1.5 text-[13px]" onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function ColorField({ label, value, onChange }: { readonly label: string; readonly value: string; readonly onChange: (value: string) => void }) {
  return <label className="flex items-center justify-between text-[12px] text-[#666]">{label}<input type="color" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

export function DecorationInspector({ object, onChange }: { readonly object: DecorationObject; readonly onChange: (patch: DecorationPatch) => void }) {
  return (
    <div className="mt-3 space-y-2">
      <NumberField label="회전" value={object.rotation ?? 0} min={-360} max={360} onChange={(rotation) => onChange({ rotation })} />
      {(object.type === "rectangle" || object.type === "booth" || object.type === "image") && <div className="grid grid-cols-2 gap-2"><NumberField label="너비" value={object.width} min={1} onChange={(width) => onChange({ width })} /><NumberField label="높이" value={object.height} min={1} onChange={(height) => onChange({ height })} /></div>}
      {object.type === "rectangle" && <><ColorField label="채우기" value={object.fill ?? "#e5e7eb"} onChange={(fill) => onChange({ fill })} /><ColorField label="테두리" value={object.stroke ?? "#9ca3af"} onChange={(stroke) => onChange({ stroke })} /></>}
      {object.type === "line" && <ColorField label="선 색상" value={object.stroke ?? "#6b7280"} onChange={(stroke) => onChange({ stroke })} />}
      {object.type === "text" && <><label className="block text-[12px] text-[#666]">내용<input className="mt-1 w-full rounded border border-black/10 px-2 py-1.5 text-[13px]" value={object.text} onChange={(event) => onChange({ text: event.target.value })} /></label><NumberField label="글자 크기" value={object.fontSize ?? 16} min={6} max={160} onChange={(fontSize) => onChange({ fontSize })} /><ColorField label="글자 색상" value={object.color ?? "#333333"} onChange={(color) => onChange({ color })} /></>}
      {object.type === "image" && <label className="block text-[12px] text-[#666]">불투명도 {Math.round((object.opacity ?? 1) * 100)}%<input className="mt-1 w-full" type="range" min={0.05} max={1} step={0.05} value={object.opacity ?? 1} onChange={(event) => onChange({ opacity: Number(event.target.value) })} /></label>}
      {object.type === "icon" && <><label className="block text-[12px] text-[#666]">아이콘<select className="mt-1 w-full rounded border border-black/10 px-2 py-1.5" value={object.icon} onChange={(event) => onChange({ icon: event.target.value as DecorationPatch["icon"] })}><option value="stage">무대</option><option value="entrance">입구</option><option value="wc">화장실</option><option value="star">별</option></select></label><NumberField label="크기" value={object.size ?? 32} min={8} max={160} onChange={(size) => onChange({ size })} /></>}
    </div>
  );
}
