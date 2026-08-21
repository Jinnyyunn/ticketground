import type { ChartObject, TableObject } from "@/types/seat-chart";
import { NumberField } from "./inspector-controls";
import { updateTableGeometry } from "./object-factory";

export function ObjectTableFields({ object, onObject }: { readonly object: ChartObject; readonly onObject: (object: ChartObject) => void }) {
  if (object.type !== "table") return null;
  const updateChairs = (side: keyof NonNullable<TableObject["chairs"]>, value: number) => {
    const chairs = object.chairs ?? { top: 4, right: 0, bottom: 4, left: 0 };
    onObject(updateTableGeometry(object, { chairs: { ...chairs, [side]: value } }));
  };
  if (object.shape === "round") {
    return (
      <>
        <NumberField label="좌석 수" value={object.seatCount} min={1} max={40} onChange={(seatCount) => onObject(updateTableGeometry(object, { seatCount }))} />
        <NumberField label="반지름" value={object.radius} suffix=" pt" min={12} onChange={(radius) => onObject(updateTableGeometry(object, { radius }))} />
      </>
    );
  }
  return (
    <>
      <NumberField label="너비" value={object.width ?? 120} suffix=" pt" min={24} onChange={(width) => onObject(updateTableGeometry(object, { width }))} />
      <NumberField label="높이" value={object.height ?? 36} suffix=" pt" min={24} onChange={(height) => onObject(updateTableGeometry(object, { height }))} />
      <NumberField label="위 의자" value={object.chairs?.top ?? 4} max={20} onChange={(value) => updateChairs("top", value)} />
      <NumberField label="오른쪽 의자" value={object.chairs?.right ?? 0} max={20} onChange={(value) => updateChairs("right", value)} />
      <NumberField label="아래 의자" value={object.chairs?.bottom ?? 4} max={20} onChange={(value) => updateChairs("bottom", value)} />
      <NumberField label="왼쪽 의자" value={object.chairs?.left ?? 0} max={20} onChange={(value) => updateChairs("left", value)} />
    </>
  );
}
