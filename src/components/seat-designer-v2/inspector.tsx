"use client";

import { Check, Eye, EyeOff, Lock, Maximize2, Unlock } from "lucide-react";
import type { ChangeEvent, ReactNode } from "react";
import type {
  ChartObject,
  IconObject,
  ObjectLayer,
  TableObject,
} from "@/types/seat-chart";
import { countPlaces, type V2EditorState } from "./editor-model";
import { updateTableGeometry } from "./object-factory";
import { toolSpec } from "./tool-catalog";

type InspectorProps = {
  readonly state: V2EditorState;
  readonly onState: (next: V2EditorState) => void;
  readonly onObject: (object: ChartObject) => void;
  readonly onReplaceReference: (file: File) => void;
  readonly onRemoveReference: () => void;
};

const ICON_OPTIONS = [
  ["people", "2인"],
  ["male", "남"],
  ["female", "여"],
  ["cone", "콘"],
  ["entrance", "입구"],
  ["emergencyExit", "비상"],
  ["stairs", "계단"],
  ["tools", "시설"],
  ["signpost", "표지"],
  ["elevator", "승강"],
  ["coffee", "카페"],
  ["warning", "주의"],
] as const satisfies readonly (readonly [IconObject["icon"], string])[];

export function Inspector({
  state,
  onState,
  onObject,
  onReplaceReference,
  onRemoveReference,
}: InspectorProps) {
  const selected = state.objects.find((object) =>
    state.selectedIds.includes(object.id),
  );
  const spec = toolSpec(state.tool);
  const reference = state.referencePlan;
  const patchReference = (
    patch: Partial<NonNullable<V2EditorState["referencePlan"]>>,
  ) => {
    if (reference)
      onState({ ...state, referencePlan: { ...reference, ...patch } });
  };
  return (
    <aside
      className="flex w-[336px] shrink-0 flex-col border-l border-[#ddd] bg-[#f5f5f5]"
      data-testid="seat-designer-v2-inspector"
    >
      <h2 className="border-b border-[#ddd] bg-white px-4 py-4 text-base font-semibold">
        {selected ? "객체 설정" : `${spec.label} 도구`}
      </h2>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {selected ? (
          <ObjectFields object={selected} onObject={onObject} />
        ) : (
          <ToolFields state={state} onState={onState} />
        )}
        {reference && (
          <section
            className="mt-6 border-t border-[#d4d4d4] pt-4"
            data-testid="seat-designer-v2-reference-controls"
          >
            <h3 className="mb-3 font-semibold">참조 도면</h3>
            <div className="grid grid-cols-2 gap-2">
              <ActionButton
                onClick={() => patchReference({ visible: !reference.visible })}
              >
                {reference.visible ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
                {reference.visible ? "숨기기" : "보이기"}
              </ActionButton>
              <ActionButton
                onClick={() => patchReference({ locked: !reference.locked })}
              >
                {reference.locked ? (
                  <Unlock className="size-4" />
                ) : (
                  <Lock className="size-4" />
                )}
                {reference.locked ? "잠금 해제" : "잠그기"}
              </ActionButton>
            </div>
            <div className="mt-4 space-y-3">
              <NumberField
                label="X"
                value={reference.x}
                suffix=" pt"
                onChange={(x) => patchReference({ x })}
              />
              <NumberField
                label="Y"
                value={reference.y}
                suffix=" pt"
                onChange={(y) => patchReference({ y })}
              />
              <NumberField
                label="너비"
                value={reference.width}
                suffix=" pt"
                min={40}
                onChange={(width) => patchReference({ width })}
              />
              <NumberField
                label="높이"
                value={reference.height}
                suffix=" pt"
                min={40}
                onChange={(height) => patchReference({ height })}
              />
              <NumberField
                label="불투명도"
                value={Math.round(reference.opacity * 100)}
                suffix="%"
                min={5}
                max={100}
                onChange={(value) => patchReference({ opacity: value / 100 })}
              />
              <NumberField
                label="회전"
                value={reference.rotation}
                suffix="°"
                min={-360}
                max={360}
                onChange={(rotation) => patchReference({ rotation })}
              />
            </div>
            <button
              type="button"
              className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded border border-[#ccc] bg-white px-3 hover:bg-[#eee]"
              onClick={() =>
                patchReference({
                  x: 80,
                  y: 60,
                  width: 760,
                  height: 560,
                  rotation: 0,
                })
              }
            >
              <Maximize2 className="size-4" />
              캔버스에 맞춤
            </button>
            <label className="mt-2 flex h-9 cursor-pointer items-center justify-center rounded border border-[#ccc] bg-white px-3 hover:bg-[#eee]">
              도면 교체
              <input
                type="file"
                className="sr-only"
                accept="image/png,image/jpeg,image/webp,image/svg+xml,application/pdf"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  if (file) onReplaceReference(file);
                  event.currentTarget.value = "";
                }}
              />
            </label>
            <button
              type="button"
              className="mt-2 w-full rounded border border-red-200 bg-white px-3 py-2 text-red-600 hover:bg-red-50"
              onClick={onRemoveReference}
            >
              참조 도면 제거
            </button>
          </section>
        )}
      </div>
      <div className="border-t border-[#ddd] bg-white p-4">
        <p className="flex items-center gap-2 text-green-600">
          <Check className="size-4" />
          중복 객체 없음
        </p>
        <p className="mt-3 text-[#666]">{countPlaces(state.objects)} places</p>
        {state.selectedSeatIds.length > 0 && (
          <p className="mt-1 font-medium text-[#087ffa]">
            {state.selectedSeatIds.length}개 좌석 선택됨
          </p>
        )}
      </div>
    </aside>
  );
}

function ToolFields({
  state,
  onState,
}: {
  readonly state: V2EditorState;
  readonly onState: (state: V2EditorState) => void;
}) {
  if (
    state.tool === "row" ||
    state.tool === "multipleRows" ||
    state.tool === "segmentedRow"
  )
    return (
      <div className="space-y-4">
        <NumberField
          label="행 간격"
          testId="seat-designer-v2-row-spacing"
          value={state.rowSpacing}
          suffix=" pt"
          min={8}
          onChange={(rowSpacing) => onState({ ...state, rowSpacing })}
        />
        <NumberField
          label="좌석 간격"
          testId="seat-designer-v2-seat-spacing"
          value={state.seatSpacing}
          suffix=" pt"
          min={0}
          onChange={(seatSpacing) => onState({ ...state, seatSpacing })}
        />
      </div>
    );
  if (state.tool === "roundTable")
    return (
      <Defaults
        rows={["의자 6개", "지름 56 pt", "클릭해서 배치 후 오른쪽에서 편집"]}
      />
    );
  if (state.tool === "rectangularTable")
    return (
      <Defaults
        rows={[
          "위 4 · 아래 4",
          "좌 0 · 우 0",
          "120 × 36 pt",
          "클릭해서 배치 후 오른쪽에서 편집",
        ]}
      />
    );
  if (state.tool === "booth")
    return (
      <Defaults
        rows={["기본 50 × 50 pt", "클릭해서 배치", "선택 후 너비와 높이 편집"]}
      />
    );
  if (state.tool === "icon")
    return (
      <Defaults
        rows={[
          "입구 · 무대 · 화장실 · 별",
          "기본 크기 40 pt",
          "캔버스 클릭으로 배치",
        ]}
      />
    );
  if (state.tool === "image")
    return (
      <Defaults
        rows={[
          "PNG, GIF, JPEG, WEBP, SVG",
          "최대 10 MB",
          "선택 후 크기·불투명도·회전 편집",
        ]}
      />
    );
  return (
    <p className="text-sm leading-6 text-[#666]">
      캔버스에서 {toolSpec(state.tool).label} 도구를 사용하세요. 선택한 도구의
      제스처는 아래 도움말에 표시됩니다.
    </p>
  );
}

function ObjectFields({
  object,
  onObject,
}: {
  readonly object: ChartObject;
  readonly onObject: (object: ChartObject) => void;
}) {
  const updateChairs = (
    side: keyof NonNullable<TableObject["chairs"]>,
    value: number,
  ) => {
    if (object.type !== "table") return;
    const chairs = object.chairs ?? { top: 4, right: 0, bottom: 4, left: 0 };
    onObject(
      updateTableGeometry(object, { chairs: { ...chairs, [side]: value } }),
    );
  };
  return (
    <div className="space-y-4" data-testid="seat-designer-v2-object-fields">
      <TextField
        label="라벨"
        value={object.label}
        onChange={(label) => onObject({ ...object, label })}
      />
      <label className="flex items-center justify-between gap-3">
        <span>레이어</span>
        <select
          aria-label="레이어"
          className="h-9 rounded border border-[#ccc] bg-white px-2"
          value={object.layer}
          onChange={(event) =>
            onObject({
              ...object,
              layer: event.currentTarget.value as ObjectLayer,
            })
          }
        >
          <option value="foreground">전경</option>
          <option value="interactive">좌석/상호작용</option>
          <option value="background">배경</option>
          <option value="surroundings">주변 시설</option>
        </select>
      </label>
      <ToggleField
        label="객체 잠금"
        checked={object.locked ?? false}
        onChange={(locked) => onObject({ ...object, locked })}
      />
      {object.type === "row" && (
        <>
          <NumberField
            label="행 간격"
            value={object.rowSpacing ?? 14}
            suffix=" pt"
            min={8}
            onChange={(rowSpacing) => onObject({ ...object, rowSpacing })}
          />
          <NumberField
            label="좌석 간격"
            value={object.seatSpacing ?? 5}
            suffix=" pt"
            onChange={(seatSpacing) => onObject({ ...object, seatSpacing })}
          />
          <p className="rounded border bg-white px-3 py-2 text-sm text-[#555]">
            좌석 {object.seatCount}개 ·{" "}
            {object.rowStyle === "segmented"
              ? "구간 행"
              : object.rowStyle === "multiple"
                ? "여러 행"
                : "직선 행"}
          </p>
        </>
      )}
      {object.type === "table" && object.shape === "round" && (
        <>
          <NumberField
            label="좌석 수"
            value={object.seatCount}
            min={1}
            max={40}
            onChange={(seatCount) =>
              onObject(updateTableGeometry(object, { seatCount }))
            }
          />
          <NumberField
            label="반지름"
            value={object.radius}
            suffix=" pt"
            min={12}
            onChange={(radius) =>
              onObject(updateTableGeometry(object, { radius }))
            }
          />
        </>
      )}
      {object.type === "table" && object.shape === "rectangle" && (
        <>
          <NumberField
            label="너비"
            value={object.width ?? 120}
            suffix=" pt"
            min={24}
            onChange={(width) =>
              onObject(updateTableGeometry(object, { width }))
            }
          />
          <NumberField
            label="높이"
            value={object.height ?? 36}
            suffix=" pt"
            min={24}
            onChange={(height) =>
              onObject(updateTableGeometry(object, { height }))
            }
          />
          <NumberField
            label="위 의자"
            value={object.chairs?.top ?? 4}
            max={20}
            onChange={(value) => updateChairs("top", value)}
          />
          <NumberField
            label="오른쪽 의자"
            value={object.chairs?.right ?? 0}
            max={20}
            onChange={(value) => updateChairs("right", value)}
          />
          <NumberField
            label="아래 의자"
            value={object.chairs?.bottom ?? 4}
            max={20}
            onChange={(value) => updateChairs("bottom", value)}
          />
          <NumberField
            label="왼쪽 의자"
            value={object.chairs?.left ?? 0}
            max={20}
            onChange={(value) => updateChairs("left", value)}
          />
        </>
      )}
      {object.type === "booth" && (
        <>
          <NumberField
            label="너비"
            value={object.width}
            suffix=" pt"
            min={8}
            onChange={(width) => onObject({ ...object, width })}
          />
          <NumberField
            label="높이"
            value={object.height}
            suffix=" pt"
            min={8}
            onChange={(height) => onObject({ ...object, height })}
          />
        </>
      )}
      {object.type === "area" && (
        <NumberField
          label="정원"
          value={object.capacity}
          min={0}
          onChange={(capacity) => onObject({ ...object, capacity })}
        />
      )}
      {object.type === "section" && (
        <NumberField
          label="정원"
          value={object.capacity ?? 0}
          min={0}
          onChange={(capacity) => onObject({ ...object, capacity })}
        />
      )}
      {object.type === "rectangle" && (
        <>
          <NumberField
            label="너비"
            value={object.width}
            suffix=" pt"
            min={8}
            onChange={(width) => onObject({ ...object, width })}
          />
          <NumberField
            label="높이"
            value={object.height}
            suffix=" pt"
            min={8}
            onChange={(height) => onObject({ ...object, height })}
          />
          <ColorField
            label="채우기"
            value={object.fill ?? "#d9dfe5"}
            onChange={(fill) => onObject({ ...object, fill })}
          />
          <ColorField
            label="테두리"
            value={object.stroke ?? "#6b7280"}
            onChange={(stroke) => onObject({ ...object, stroke })}
          />
          <NumberField
            label="불투명도"
            value={Math.round((object.opacity ?? 0.68) * 100)}
            suffix="%"
            min={5}
            max={100}
            onChange={(value) => onObject({ ...object, opacity: value / 100 })}
          />
        </>
      )}
      {object.type === "line" && (
        <ColorField
          label="선 색상"
          value={object.stroke ?? "#5b6570"}
          onChange={(stroke) => onObject({ ...object, stroke })}
        />
      )}
      {object.type === "text" && (
        <>
          <TextField
            label="텍스트"
            value={object.text}
            onChange={(text) => onObject({ ...object, text })}
          />
          <NumberField
            label="글자 크기"
            value={object.fontSize ?? 18}
            suffix=" pt"
            min={8}
            onChange={(fontSize) => onObject({ ...object, fontSize })}
          />
          <ColorField
            label="글자 색상"
            value={object.color ?? "#333333"}
            onChange={(color) => onObject({ ...object, color })}
          />
          <label className="flex items-center justify-between">
            <span>정렬</span>
            <select
              aria-label="텍스트 정렬"
              className="h-9 rounded border border-[#ccc] bg-white px-2"
              value={object.align ?? "center"}
              onChange={(event) =>
                onObject({
                  ...object,
                  align: event.currentTarget.value as
                    "left" | "center" | "right",
                })
              }
            >
              <option value="left">왼쪽</option>
              <option value="center">가운데</option>
              <option value="right">오른쪽</option>
            </select>
          </label>
        </>
      )}
      {object.type === "image" && (
        <>
          <NumberField
            label="너비"
            value={object.width}
            suffix=" pt"
            min={8}
            onChange={(width) => onObject({ ...object, width })}
          />
          <NumberField
            label="높이"
            value={object.height}
            suffix=" pt"
            min={8}
            onChange={(height) => onObject({ ...object, height })}
          />
          <NumberField
            label="불투명도"
            value={Math.round((object.opacity ?? 1) * 100)}
            suffix="%"
            min={5}
            max={100}
            onChange={(value) => onObject({ ...object, opacity: value / 100 })}
          />
        </>
      )}
      {object.type === "icon" && (
        <>
          <fieldset>
            <legend className="mb-2">아이콘</legend>
            <div className="grid grid-cols-4 gap-2">
              {ICON_OPTIONS.map(([icon, label]) => (
                <button
                  key={icon}
                  type="button"
                  title={label}
                  aria-pressed={object.icon === icon}
                  className={`h-11 rounded border text-xs ${object.icon === icon ? "border-[#087ffa] bg-[#087ffa] text-white" : "border-[#ccc] bg-white hover:bg-[#eee]"}`}
                  onClick={() => onObject({ ...object, icon })}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
          <NumberField
            label="크기"
            value={object.size ?? 40}
            suffix=" pt"
            min={12}
            onChange={(size) => onObject({ ...object, size })}
          />
          <ColorField
            label="색상"
            value={object.color ?? "#495057"}
            onChange={(color) => onObject({ ...object, color })}
          />
        </>
      )}
    </div>
  );
}

function NumberField({
  label,
  value,
  suffix = "",
  min = 0,
  max = 9999,
  testId,
  onChange,
}: {
  readonly label: string;
  readonly value: number;
  readonly suffix?: string;
  readonly min?: number;
  readonly max?: number;
  readonly testId?: string;
  readonly onChange: (value: number) => void;
}) {
  const clamp = (next: number) =>
    onChange(Math.min(max, Math.max(min, Number.isFinite(next) ? next : min)));
  return (
    <label className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span className="flex h-8 items-center overflow-hidden rounded border border-[#ccc] bg-white">
        <button
          type="button"
          className="w-8 text-[#888] hover:bg-[#eee]"
          onClick={() => clamp(value - 1)}
        >
          −
        </button>
        <input
          data-testid={testId}
          aria-label={label}
          type="number"
          className="w-16 text-center outline-none"
          value={value}
          min={min}
          max={max}
          onChange={(event) => clamp(event.currentTarget.valueAsNumber)}
        />
        <span className="pr-2 text-xs text-[#777]">{suffix}</span>
        <button
          type="button"
          className="w-8 text-[#888] hover:bg-[#eee]"
          onClick={() => clamp(value + 1)}
        >
          ＋
        </button>
      </span>
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  function change(event: ChangeEvent<HTMLInputElement>) {
    onChange(event.currentTarget.value);
  }
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-[#666]">{label}</span>
      <input
        aria-label={label}
        className="h-9 w-full rounded border border-[#ccc] bg-white px-3 outline-none focus:border-[#087ffa]"
        value={value}
        onChange={change}
      />
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center justify-between">
      <span>{label}</span>
      <span className="flex h-9 items-center gap-2 rounded border border-[#ccc] bg-white px-2">
        <input
          aria-label={label}
          type="color"
          className="size-6 cursor-pointer border-0 bg-transparent p-0"
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
        <code className="text-xs">{value}</code>
      </span>
    </label>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between">
      <span>{label}</span>
      <input
        aria-label={label}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
        className="size-4 accent-[#087ffa]"
      />
    </label>
  );
}

function ActionButton({
  children,
  onClick,
}: {
  readonly children: ReactNode;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="flex h-9 items-center justify-center gap-2 rounded border border-[#ccc] bg-white px-3 hover:bg-[#eee]"
      onClick={onClick}
    >
      {children}
    </button>
  );
}
function Defaults({ rows }: { readonly rows: readonly string[] }) {
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <p
          key={row}
          className="rounded border border-[#ddd] bg-white px-3 py-2 text-sm text-[#555]"
        >
          {row}
        </p>
      ))}
    </div>
  );
}
