"use client";

import type { ChartObject } from "@/types/seat-chart";
import type { DecorationPatch } from "@/lib/seat-designer/chart-ops";

type DecorationObject = Extract<ChartObject, { readonly type: "rectangle" | "booth" | "line" | "text" | "image" | "icon" }>;

function NumberField({ label, value, min, max, onChange }: { readonly label: string; readonly value: number; readonly min?: number; readonly max?: number; readonly onChange: (value: number) => void }) {
  const displayValue = Number(value.toFixed(2));
  return <label className="block text-[12px] text-[#666]">{label}<input type="number" min={min} max={max} value={displayValue} className="mt-1 w-full rounded border border-black/10 px-2 py-1.5 text-[13px]" onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function ColorField({ label, value, onChange }: { readonly label: string; readonly value: string; readonly onChange: (value: string) => void }) {
  return <label className="flex items-center justify-between text-[12px] text-[#666]">{label}<input type="color" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

export function DecorationInspector({ object, onChange, onReplaceImage }: { readonly object: DecorationObject; readonly onChange: (patch: DecorationPatch) => void; readonly onReplaceImage?: (file: File) => void }) {
  return (
    <div className="mt-3 space-y-2">
      {(object.type === "rectangle" || object.type === "booth" || object.type === "image") && <div className="grid grid-cols-2 gap-2"><NumberField label="너비" value={object.width} min={1} onChange={(width) => onChange({ width })} /><NumberField label="높이" value={object.height} min={1} onChange={(height) => onChange({ height })} /></div>}
      {object.type === "rectangle" && <><ColorField label="채우기" value={object.fill ?? "#e5e7eb"} onChange={(fill) => onChange({ fill })} /><ColorField label="테두리" value={object.stroke ?? "#9ca3af"} onChange={(stroke) => onChange({ stroke })} /></>}
      {object.type === "line" && <ColorField label="선 색상" value={object.stroke ?? "#6b7280"} onChange={(stroke) => onChange({ stroke })} />}
      {object.type === "text" && <><label className="block text-[12px] text-[#666]">내용<input className="mt-1 w-full rounded border border-black/10 px-2 py-1.5 text-[13px]" value={object.text} onChange={(event) => onChange({ text: event.target.value })} /></label><div className="grid grid-cols-2 gap-2"><NumberField label="글자 크기" value={object.fontSize ?? 16} min={6} max={160} onChange={(fontSize) => onChange({ fontSize })} /><label className="block text-[12px] text-[#666]">굵기<select className="mt-1 w-full rounded border border-black/10 px-2 py-1.5" value={object.weight ?? 600} onChange={(event) => { const weight = Number(event.target.value); if (weight === 400 || weight === 500 || weight === 600 || weight === 700) onChange({ weight }); }}><option value="400">보통</option><option value="500">중간</option><option value="600">굵게</option><option value="700">매우 굵게</option></select></label></div><label className="block text-[12px] text-[#666]">정렬<select className="mt-1 w-full rounded border border-black/10 px-2 py-1.5" value={object.align ?? "center"} onChange={(event) => { if (event.target.value === "left" || event.target.value === "center" || event.target.value === "right") onChange({ align: event.target.value }); }}><option value="left">왼쪽</option><option value="center">가운데</option><option value="right">오른쪽</option></select></label><ColorField label="글자 색상" value={object.color ?? "#333333"} onChange={(color) => onChange({ color })} /></>}
      {object.type === "image" && <><label className="block text-[12px] text-[#666]">불투명도 {Math.round((object.opacity ?? 1) * 100)}%<input className="mt-1 w-full" type="range" min={0.05} max={1} step={0.05} value={object.opacity ?? 1} onChange={(event) => onChange({ opacity: Number(event.target.value) })} /></label><label className="flex cursor-pointer items-center justify-center rounded border border-black/10 bg-white px-3 py-2 text-[12px] hover:bg-black/[0.03]">이미지 교체<input type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) onReplaceImage?.(file); event.currentTarget.value = ""; }} /></label></>}
      {object.type === "icon" && <><label className="block text-[12px] text-[#666]">아이콘<select className="mt-1 w-full rounded border border-black/10 px-2 py-1.5" value={object.icon} onChange={(event) => { if (event.target.value === "stage" || event.target.value === "entrance" || event.target.value === "wc" || event.target.value === "star") onChange({ icon: event.target.value }); }}><option value="stage">무대</option><option value="entrance">입구</option><option value="wc">화장실</option><option value="star">별</option></select></label><NumberField label="크기" value={object.size ?? 40} min={8} max={160} onChange={(size) => onChange({ size })} /><ColorField label="색상" value={object.color ?? "#333333"} onChange={(color) => onChange({ color })} /></>}
    </div>
  );
}
