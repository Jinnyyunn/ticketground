"use client";

import { ArrowDown, ArrowUp, Check, Search, Settings2, X } from "lucide-react";
import type { ChartObject } from "@/types/seat-chart";
import { countPlaces, isPlaceBearingObject } from "@/lib/seat-designer/chart-ops";
import { ko } from "@/lib/seat-designer/i18n";
import type { SeatEditorApi } from "@/lib/seat-designer/use-editor";
import type { ValidationItem } from "@/lib/seat-designer/validation";
import { cn } from "@/lib/utils";
import { DecorationInspector } from "./decoration-inspector";
import { ImageImportControl } from "./image-import-control";
import { ToolHelpPanel } from "./tool-help-panel";
import { TableInspector } from "./inspectors/table-inspector";

function isObjectLayer(value: string): value is ChartObject["layer"] {
  return value === "foreground" || value === "interactive" || value === "background" || value === "surroundings";
}

export function Inspector({
  api,
  validation,
}: {
  readonly api: SeatEditorApi;
  readonly validation: readonly ValidationItem[];
}) {
  const {
    state,
    dispatch,
    setCategoryOnSelection,
    patchSelectedLabel,
    patchRow,
    patchTable,
    patchArea,
    patchAdvanced,
    patchSelectedSeats,
    patchDecoration,
    replaceSelectedImage,
    selectBySearch,
  } = api;
  const { chart, selectedIds, selectedSeatIds, searchQuery, searchOpen } = state;
  const places = countPlaces(chart);
  const selected = chart.objects.filter((o) => selectedIds.includes(o.id));
  const primary = selected[0];

  return (
    <aside data-testid="seat-designer-inspector" className="flex w-[336px] shrink-0 flex-col border-l border-black/10 bg-[#f5f5f5]">
      <div className="border-b border-black/10 bg-white p-4">
        <h2 className="text-[16px] font-semibold text-[#333]">{chart.name}</h2>
        <div className="mt-3 flex items-center justify-between text-[13px]">
          <span className="inline-flex items-center gap-2 text-[#333]">
            <span className="inline-flex -space-x-1">
              {chart.categories.slice(0, 5).map((c) => (
                <span
                  key={c.key}
                  className="inline-block size-3 rounded-full border border-white"
                  style={{ background: c.color }}
                  title={c.label}
                />
              ))}
            </span>
            {chart.categories.length}개 {ko.categories}
          </span>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[13px] text-[#0784fa] hover:underline"
            onClick={() => dispatch({ type: "SET_CATEGORIES_OPEN", open: true })}
          >
            <Settings2 className="size-3.5" />
            {ko.manage}
          </button>
        </div>
        <div className="mt-3 flex items-center justify-between text-[13px] text-[#333]">
          <span className="inline-flex items-center gap-2">
            <span className="size-2.5 rounded-full border-2 border-[#333]" />
            {places.toLocaleString("ko-KR")} {ko.places}
          </span>
          <button
            type="button"
            className="text-[#999] hover:text-[#0784fa]"
            title={ko.search}
            onClick={() => dispatch({ type: "SET_SEARCH_OPEN", open: !searchOpen })}
          >
            <Search className="size-4" />
          </button>
        </div>
        {searchOpen && (
          <div className="mt-2 flex gap-1">
            <input
              className="min-w-0 flex-1 rounded border border-black/10 px-2 py-1.5 text-[13px]"
              placeholder="구역·열·좌석 라벨 검색"
              value={searchQuery}
              onChange={(e) => dispatch({ type: "SET_SEARCH_QUERY", query: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") selectBySearch(searchQuery);
              }}
            />
            <button
              type="button"
              className="rounded bg-[#0784fa] px-2 py-1 text-[12px] font-medium text-white"
              onClick={() => selectBySearch(searchQuery)}
            >
              찾기
            </button>
          </div>
        )}
      </div>

      <div className="border-b border-black/10 bg-white px-4 py-3">
        <ul className="space-y-1.5">
          {validation.map((item) => (
            <li key={item.id} className="flex items-center gap-2 text-[13px]">
              {item.ok ? (
                <Check className="size-4 shrink-0 text-emerald-600" strokeWidth={3} />
              ) : (
                <X className="size-4 shrink-0 text-amber-600" strokeWidth={3} />
              )}
              <span className={item.ok ? "text-emerald-700" : "text-amber-700"}>{item.label}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {!primary && state.toolMode !== "select" && <ToolHelpPanel mode={state.toolMode} />}
        {selectedSeatIds.length > 0 && (
          <Panel title={ko.seats}>
            <p className="text-[13px] text-[#555]">
              {selectedSeatIds.length}
              {ko.seatsSelected}
            </p>
            <div className="mt-3 grid gap-2">
              {([
                ["accessible", "휠체어석"],
                ["companion", "동반자석"],
                ["restrictedView", "시야 제한석"],
              ] as const).map(([property, label]) => (
                <label key={property} className="flex items-center justify-between rounded-md border border-black/10 bg-white px-3 py-2 text-[12px]">
                  {label}
                  <input type="checkbox" onChange={(event) => patchSelectedSeats({ [property]: event.target.checked })} />
                </label>
              ))}
            </div>
          </Panel>
        )}

        {primary ? (
          <Panel title={ko.selection}>
            <Field label={ko.type} value={ko.objectTypes[primary.type]} />
            <div className="mt-1">
              <div className="mb-1 text-[11px] font-medium tracking-wide text-[#888]">{ko.label}</div>
              <input
                className="w-full rounded border border-black/10 px-2 py-1.5 text-[13px]"
                value={primary.label}
                onChange={(e) => patchSelectedLabel(e.target.value)}
              />
            </div>
            <div className="mt-2">
              <div className="mb-1 text-[11px] font-medium tracking-wide text-[#888]">표시 라벨 (구매자)</div>
              <input
                className="w-full rounded border border-black/10 px-2 py-1.5 text-[13px]"
                placeholder={primary.label}
                value={primary.displayedLabel ?? ""}
                onChange={(e) => patchAdvanced({ displayedLabel: e.target.value })}
              />
            </div>
            <label className="mt-2 block text-[12px] text-[#666]">
              {ko.layer}
              <select
                className="mt-1 w-full rounded border border-black/10 px-2 py-1.5 text-[13px]"
                value={isPlaceBearingObject(primary) ? "interactive" : primary.layer}
                disabled={isPlaceBearingObject(primary)}
                onChange={(event) => {
                  if (isObjectLayer(event.target.value)) patchAdvanced({ layer: event.target.value });
                }}
              >
                {!isPlaceBearingObject(primary) && <option value="foreground">전경 장식</option>}
                <option value="interactive">인터랙티브 객체</option>
                {!isPlaceBearingObject(primary) && <option value="background">배경 장식</option>}
                {!isPlaceBearingObject(primary) && <option value="surroundings">주변 요소</option>}
              </select>
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="block text-[12px] text-[#666]">회전
                <input
                  type="number"
                  min={-360}
                  max={360}
                  value={Number((primary.rotation ?? 0).toFixed(2))}
                  className="mt-1 w-full rounded border border-black/10 px-2 py-1.5 text-[13px]"
                  onChange={(event) => {
                    const rotation = Number(event.target.value);
                    if (Number.isFinite(rotation)) patchAdvanced({ rotation });
                  }}
                />
              </label>
              <label className="flex items-center gap-2 self-end rounded border border-black/10 px-2 py-1.5 text-[12px] text-[#666]">
                <input type="checkbox" checked={Boolean(primary.locked)} onChange={(event) => patchAdvanced({ locked: event.target.checked })} />잠금
              </label>
            </div>
            {(chart.zones ?? []).length > 0 && (
              <label className="mt-2 block text-[12px] text-[#666]">
                존
                <select
                  className="mt-1 w-full rounded border border-black/10 px-2 py-1.5 text-[13px]"
                  value={primary.zoneId ?? ""}
                  onChange={(e) =>
                    patchAdvanced({ zoneId: e.target.value ? e.target.value : null })
                  }
                >
                  <option value="">없음</option>
                  {(chart.zones ?? []).map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="mt-2">
              <div className="mb-1 text-[11px] font-medium tracking-wide text-[#888]">View from seat</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded border border-black/10 px-2 py-1 text-[12px] hover:bg-black/[0.03]"
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = "image/*";
                    input.onchange = () => {
                      const file = input.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () =>
                        patchAdvanced({ viewFromSeatHref: String(reader.result || "") });
                      reader.readAsDataURL(file);
                    };
                    input.click();
                  }}
                >
                  {primary.viewFromSeatHref ? "이미지 교체" : "이미지 추가"}
                </button>
                {primary.viewFromSeatHref && (
                  <button
                    type="button"
                    className="text-[12px] text-red-500"
                    onClick={() => patchAdvanced({ viewFromSeatHref: null })}
                  >
                    제거
                  </button>
                )}
              </div>
              {primary.viewFromSeatHref && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={primary.viewFromSeatHref}
                  alt="view from seat"
                  className="mt-2 max-h-24 rounded border border-black/10 object-cover"
                />
              )}
            </div>
            {"categoryKey" in primary && (
              <div className="mt-2">
                <div className="mb-1 text-[11px] font-medium tracking-wide text-[#888]">{ko.category}</div>
                <div className="flex flex-wrap gap-1">
                  {chart.categories.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setCategoryOnSelection(c.key)}
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[12px]",
                        primary.categoryKey === c.key
                          ? "border-[#0784fa] bg-[#0784fa]/10 text-[#0784fa]"
                          : "border-black/10 bg-white text-[#333]",
                      )}
                    >
                      <span
                        className="mr-1 inline-block size-2 rounded-full"
                        style={{ background: c.color }}
                      />
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {primary.type === "row" && (
              <div className="mt-3 space-y-2">
                <label className="block text-[12px] text-[#666]">
                  {ko.seatCount}
                  <input
                    type="number"
                    min={1}
                    max={200}
                    className="mt-1 w-full rounded border border-black/10 px-2 py-1.5 text-[13px]"
                    value={primary.seatCount}
                    onChange={(e) => patchRow({ seatCount: Number(e.target.value) })}
                  />
                </label>
                <label className="block text-[12px] text-[#666]">
                  {ko.curve}
                  <input
                    type="range"
                    min={-120}
                    max={120}
                    className="mt-1 w-full"
                    value={primary.curve ?? 0}
                    onChange={(e) => patchRow({ curve: Number(e.target.value) })}
                  />
                  <span className="text-[11px] text-[#999]">{primary.curve ?? 0}</span>
                </label>
              </div>
            )}
            {primary.type === "table" && <TableInspector object={primary} onChange={patchTable} />}
            {primary.type === "area" && (
              <label className="mt-3 block text-[12px] text-[#666]">
                {ko.capacity}
                <input
                  type="number"
                  min={1}
                  className="mt-1 w-full rounded border border-black/10 px-2 py-1.5 text-[13px]"
                  value={primary.capacity}
                  onChange={(e) => patchArea(Number(e.target.value))}
                />
              </label>
            )}
            {(primary.type === "rectangle" || primary.type === "booth" || primary.type === "line" || primary.type === "text" || primary.type === "image" || primary.type === "icon") && (
              <DecorationInspector object={primary} onChange={patchDecoration} onReplaceImage={(file) => void replaceSelectedImage(file)} />
            )}
            {selected.length > 1 && (
              <p className="mt-2 text-[12px] text-[#888]">
                +{selected.length - 1}
                {ko.moreSelected}
              </p>
            )}
            <ObjectDetails obj={primary} />
          </Panel>
        ) : state.toolMode === "select" ? (
          <Panel title={ko.chart}>
            <dl className="mb-3 space-y-1.5 text-[13px]">
              <div className="flex justify-between"><dt className="text-[#888]">장소</dt><dd className="font-medium text-[#333]">{places.toLocaleString("ko-KR")}</dd></div>
              <div className="flex justify-between"><dt className="text-[#888]">초점</dt><dd className="font-medium text-[#333]">{chart.focalPoint ? "설정됨" : "설정되지 않음"}</dd></div>
            </dl>
            <ImageImportControl api={api} compact />
            <label className="mt-2 flex w-full cursor-pointer items-center justify-center rounded-md border border-dashed border-black/15 bg-white px-3 py-2 text-[13px] hover:bg-black/[0.03]">
              {ko.importJson}
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) api.importJson(f);
                }}
              />
            </label>
          </Panel>
        ) : null}

        <Panel title={ko.categories}>
          <ul className="space-y-2">
            {chart.categories.map((c) => (
              <li key={c.key} className="flex items-center gap-2 text-[13px]">
                <span className="size-3 rounded-full" style={{ background: c.color }} />
                <span className="flex-1">{c.label}</span>
                <span className="text-[11px] text-[#999]">#{c.key}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </aside>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4 rounded-lg border border-black/8 bg-white p-3 shadow-sm">
      <h3 className="mb-2 text-[11px] font-semibold tracking-wide text-[#888]">{title}</h3>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-0.5 text-[13px]">
      <span className="text-[#888]">{label}</span>
      <span className="font-medium text-[#333]">{value}</span>
    </div>
  );
}

function ObjectDetails({ obj }: { obj: ChartObject }) {
  if (obj.type === "row") {
    return (
      <div className="mt-2 space-y-1 text-[12px] text-[#666]">
        <div>
          {ko.seatCount}: {obj.seatCount}
        </div>
        <div>
          {ko.curve}: {obj.curve ?? 0}
        </div>
      </div>
    );
  }
  if (obj.type === "table") {
    return (
      <div className="mt-2 space-y-1 text-[12px] text-[#666]">
        <div>
          {ko.seatCount}: {obj.seatCount}
        </div>
        <div>
          {ko.radius}: {obj.radius}
        </div>
        <div>
          {ko.bookAsWhole}: {obj.bookAsWhole ? ko.yes : ko.no}
        </div>
      </div>
    );
  }
  if (obj.type === "section") {
    return (
      <div className="mt-2 space-y-1 text-[12px] text-[#666]">
        <div>
          {ko.vertices}: {obj.points.length}
        </div>
        <div>
          {ko.nestedRows}: {obj.nestedRows?.length ?? 0}
        </div>
      </div>
    );
  }
  if (obj.type === "area") {
    return (
      <div className="mt-2 space-y-1 text-[12px] text-[#666]">
        <div>
          {ko.capacity}: {obj.capacity}
        </div>
      </div>
    );
  }
  if (obj.type === "booth") {
    return (
      <div className="mt-2 space-y-1 text-[12px] text-[#666]">
        <div>
          {ko.size}: {Math.round(obj.width)} × {Math.round(obj.height)}
        </div>
      </div>
    );
  }
  return null;
}

export function CategoryManagerDialog({ api }: { readonly api: SeatEditorApi }) {
  const { state, dispatch, updateCategories } = api;
  if (!state.categoriesOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{ko.manageCategories}</h2>
          <button type="button" onClick={() => dispatch({ type: "SET_CATEGORIES_OPEN", open: false })}>
            <X className="size-5 text-[#666]" />
          </button>
        </div>
        <ul className="space-y-3">
          {state.chart.categories.map((c, index) => (
            <li key={c.key} className="flex items-center gap-2">
              <input
                type="color"
                value={c.color}
                onChange={(e) => {
                  const next = state.chart.categories.map((cat, i) =>
                    i === index ? { ...cat, color: e.target.value } : cat,
                  );
                  updateCategories(next);
                }}
                className="size-8 cursor-pointer rounded border-0 bg-transparent"
              />
              <input
                value={c.label}
                onChange={(e) => {
                  const next = state.chart.categories.map((cat, i) =>
                    i === index ? { ...cat, label: e.target.value } : cat,
                  );
                  updateCategories(next);
                }}
                className="flex-1 rounded border border-black/10 px-2 py-1.5 text-sm"
              />
              <button
                type="button"
                className="rounded p-1 text-[#667085] hover:bg-black/5 disabled:opacity-30"
                aria-label={`${c.label} 위로 이동`}
                disabled={index === 0}
                onClick={() => {
                  const next = [...state.chart.categories];
                  [next[index - 1], next[index]] = [next[index], next[index - 1]];
                  updateCategories(next);
                }}
              >
                <ArrowUp className="size-3.5" />
              </button>
              <button
                type="button"
                className="rounded p-1 text-[#667085] hover:bg-black/5 disabled:opacity-30"
                aria-label={`${c.label} 아래로 이동`}
                disabled={index === state.chart.categories.length - 1}
                onClick={() => {
                  const next = [...state.chart.categories];
                  [next[index], next[index + 1]] = [next[index + 1], next[index]];
                  updateCategories(next);
                }}
              >
                <ArrowDown className="size-3.5" />
              </button>
              <button
                type="button"
                className="text-[12px] text-red-500"
                onClick={() => {
                  if (state.chart.categories.length <= 1) return;
                  updateCategories(state.chart.categories.filter((_, i) => i !== index));
                }}
              >
                {ko.remove}
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="mt-4 w-full rounded-md bg-[#0784fa] px-3 py-2 text-sm font-medium text-white"
          onClick={() => {
            const key = String(Date.now());
            updateCategories([
              ...state.chart.categories,
              { key, label: `${ko.categoryN} ${state.chart.categories.length + 1}`, color: "#a78bfa" },
            ]);
          }}
        >
          {ko.addCategory}
        </button>
      </div>
    </div>
  );
}
