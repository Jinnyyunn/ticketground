import type { TableObject } from "@/types/seat-chart";
import type { TablePatch } from "@/lib/seat-designer/chart-ops";

function NumberField({ label, value, min, max, onChange }: { readonly label: string; readonly value: number; readonly min: number; readonly max: number; readonly onChange: (value: number) => void }) {
  return (
    <label className="block text-[12px] text-[#666]">
      {label}
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        className="mt-1 w-full rounded border border-black/10 px-2 py-1.5 text-[13px]"
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)));
        }}
      />
    </label>
  );
}

export function TableInspector({ object, onChange }: { readonly object: TableObject; readonly onChange: (patch: TablePatch) => void }) {
  const chairs = object.chairs ?? { top: 4, right: 0, bottom: 4, left: 0 };
  const bookingControls = (
    <>
      <label className="flex items-center gap-2 text-[12px] text-[#666]"><input type="checkbox" checked={Boolean(object.bookAsWhole)} onChange={(event) => onChange({ bookAsWhole: event.target.checked })} />전체 테이블로 예매</label>
      <label className="flex items-center gap-2 text-[12px] text-[#666]"><input type="checkbox" checked={Boolean(object.variableOccupancy)} onChange={(event) => onChange({ variableOccupancy: event.target.checked })} />가변 점유</label>
      {object.variableOccupancy && (
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="최소 인원" value={object.minOccupancy ?? 1} min={1} max={48} onChange={(minOccupancy) => onChange({ minOccupancy })} />
          <NumberField label="최대 인원" value={object.maxOccupancy ?? object.seatCount} min={1} max={48} onChange={(maxOccupancy) => onChange({ maxOccupancy })} />
        </div>
      )}
    </>
  );
  if (object.shape === "rectangle") {
    const chairField = (side: keyof typeof chairs, label: string) => (
      <NumberField
        label={label}
        value={chairs[side]}
        min={0}
        max={24}
        onChange={(value) => onChange({ chairs: { ...chairs, [side]: value } })}
      />
    );
    return (
      <div className="mt-3 space-y-3" data-testid="rectangular-table-inspector">
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="너비" value={object.width ?? 120} min={20} max={1000} onChange={(width) => onChange({ width })} />
          <NumberField label="높이" value={object.height ?? 36} min={20} max={1000} onChange={(height) => onChange({ height })} />
        </div>
        {bookingControls}
        <div className="grid grid-cols-2 gap-2">
          {chairField("top", "위쪽 의자")}
          {chairField("bottom", "아래쪽 의자")}
          {chairField("left", "왼쪽 의자")}
          {chairField("right", "오른쪽 의자")}
        </div>
      </div>
    );
  }
  return (
    <div className="mt-3 space-y-2" data-testid="round-table-inspector">
      <NumberField label="의자 수" value={object.seatCount} min={1} max={48} onChange={(seatCount) => onChange({ seatCount })} />
      <NumberField label="반지름" value={object.radius} min={8} max={120} onChange={(radius) => onChange({ radius })} />
      {bookingControls}
    </div>
  );
}
