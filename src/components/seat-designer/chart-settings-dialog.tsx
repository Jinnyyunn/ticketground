"use client";

import { X } from "lucide-react";
import type { OverlayImage, VenueType } from "@/types/seat-chart";
import { normalizeOverlay } from "@/lib/seat-designer/chart-ops";
import type { SeatEditorApi } from "@/lib/seat-designer/use-editor";
import { listBindableShows } from "@/lib/seat-charts/shows";

function pickImage(onDone: (dataUrl: string) => void) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onDone(String(reader.result || ""));
    reader.readAsDataURL(file);
  };
  input.click();
}

function defaultOverlay(href: string): OverlayImage {
  return { href, x: 200, y: 100, width: 1000, height: 800, opacity: 0.4, locked: false };
}

export function ChartSettingsDialog({ api }: { readonly api: SeatEditorApi }) {
  const { state, dispatch, updateChartMeta } = api;
  if (!state.chartSettingsOpen) return null;
  const chart = state.chart;
  const bg = normalizeOverlay(chart.backgroundImage);
  const ref = chart.referenceChart;
  const showOptions = listBindableShows();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">차트 설정 (고급)</h2>
          <button type="button" onClick={() => dispatch({ type: "SET_CHART_SETTINGS_OPEN", open: false })}>
            <X className="size-5 text-[#666]" />
          </button>
        </div>

        <section className="mb-5 space-y-2">
          <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[#888]">예매 적용 공연</h3>
          <p className="text-[12px] text-[#666]">
            게시 시 이 차트가 연결된 공연의 좌석 선택 화면에 적용됩니다.
          </p>
          <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
            {showOptions.map((s) => {
              const on = state.boundShowSlugs.includes(s.slug);
              return (
                <button
                  key={s.slug}
                  type="button"
                  title={s.venue}
                  className={`rounded-full border px-3 py-1 text-[13px] ${
                    on ? "border-[#0784fa] bg-[#0784fa]/10 text-[#0784fa]" : "border-black/10"
                  }`}
                  onClick={() => {
                    const next = on
                      ? state.boundShowSlugs.filter((x) => x !== s.slug)
                      : [...state.boundShowSlugs, s.slug];
                    dispatch({ type: "SET_BOUND_SHOWS", slugs: next });
                  }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
          {state.boundShowSlugs.length === 0 && (
            <p className="text-[12px] text-amber-600">공연을 하나 이상 연결하세요. 미연결 시 게시해도 예매에 자동 연결되지 않을 수 있습니다.</p>
          )}
        </section>

        <section className="mb-5 space-y-2">
          <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[#888]">공연장 유형</h3>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["simple", "단순"],
                ["sectionsAndFloors", "구역 + 층"],
                ["zones", "존"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`rounded-full border px-3 py-1 text-[13px] ${
                  (chart.venueType ?? "simple") === id
                    ? "border-[#0784fa] bg-[#0784fa]/10 text-[#0784fa]"
                    : "border-black/10"
                }`}
                onClick={() =>
                  updateChartMeta({ venueType: id as VenueType }, `공연장 유형: ${label}`)
                }
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        <section className="mb-5 space-y-2">
          <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[#888]">
            배경 이미지 (구매자 노출)
          </h3>
          <p className="text-[12px] text-[#666]">티켓 구매자에게 보이는 배경(backgroundImage).</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-md border border-black/10 px-3 py-1.5 text-[13px] hover:bg-black/[0.03]"
              onClick={() =>
                pickImage((href) =>
                  updateChartMeta({ backgroundImage: bg ? { ...bg, href } : defaultOverlay(href) }),
                )
              }
            >
              {bg ? "이미지 교체" : "이미지 추가"}
            </button>
            {bg && (
              <button
                type="button"
                className="rounded-md border border-red-200 px-3 py-1.5 text-[13px] text-red-600"
                onClick={() => updateChartMeta({ backgroundImage: undefined }, "배경 이미지 제거")}
              >
                제거
              </button>
            )}
          </div>
          {bg && (
            <label className="block text-[12px] text-[#666]">
              불투명도 {(bg.opacity * 100).toFixed(0)}%
              <input
                type="range"
                min={0.05}
                max={1}
                step={0.05}
                className="mt-1 w-full"
                value={bg.opacity}
                onChange={(e) =>
                  updateChartMeta({
                    backgroundImage: { ...bg, opacity: Number(e.target.value) },
                  })
                }
              />
            </label>
          )}
        </section>

        <section className="mb-5 space-y-2">
          <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[#888]">
            참조 도면 (트레이싱)
          </h3>
          <p className="text-[12px] text-[#666]">편집용 밑그림(referenceChart). 구매자에게는 안 보입니다.</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-md border border-black/10 px-3 py-1.5 text-[13px] hover:bg-black/[0.03]"
              onClick={() =>
                pickImage((href) =>
                  updateChartMeta({
                    referenceChart: ref ? { ...ref, href } : { ...defaultOverlay(href), opacity: 0.55 },
                  }),
                )
              }
            >
              {ref ? "도면 교체" : "도면 추가"}
            </button>
            {ref && (
              <button
                type="button"
                className="rounded-md border border-red-200 px-3 py-1.5 text-[13px] text-red-600"
                onClick={() => updateChartMeta({ referenceChart: undefined }, "참조 도면 제거")}
              >
                제거
              </button>
            )}
          </div>
          {ref && (
            <>
              <label className="block text-[12px] text-[#666]">
                불투명도 {(ref.opacity * 100).toFixed(0)}%
                <input
                  type="range"
                  min={0.05}
                  max={1}
                  step={0.05}
                  className="mt-1 w-full"
                  value={ref.opacity}
                  onChange={(e) =>
                    updateChartMeta({
                      referenceChart: { ...ref, opacity: Number(e.target.value) },
                    })
                  }
                />
              </label>
              <label className="flex items-center gap-2 text-[12px] text-[#666]">
                <input
                  type="checkbox"
                  checked={Boolean(ref.locked)}
                  onChange={(e) =>
                    updateChartMeta({ referenceChart: { ...ref, locked: e.target.checked } })
                  }
                />
                위치 잠금
              </label>
            </>
          )}
        </section>

        <section className="mb-2 space-y-2">
          <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[#888]">존 (zones)</h3>
          <ul className="space-y-1 text-[13px]">
            {(chart.zones ?? []).map((z) => (
              <li key={z.id} className="flex items-center gap-2">
                <span className="rounded bg-black/5 px-2 py-0.5">{z.name}</span>
              </li>
            ))}
            {(chart.zones ?? []).length === 0 && (
              <li className="text-[12px] text-[#999]">존 없음 · 아래 버튼으로 추가</li>
            )}
          </ul>
          <button
            type="button"
            className="rounded-md bg-[#0784fa] px-3 py-1.5 text-[13px] font-medium text-white"
            onClick={() => api.addZone()}
          >
            존 추가
          </button>
        </section>
      </div>
    </div>
  );
}

export function FloorsDialog({ api }: { readonly api: SeatEditorApi }) {
  const { state, dispatch, addFloor, renameFloor, removeFloor } = api;
  if (!state.floorsOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">층 편집</h2>
          <button type="button" onClick={() => dispatch({ type: "SET_FLOORS_OPEN", open: false })}>
            <X className="size-5 text-[#666]" />
          </button>
        </div>
        <ul className="space-y-2">
          {state.chart.floors.map((f) => (
            <li key={f.id} className="flex items-center gap-2">
              <input
                className="flex-1 rounded border border-black/10 px-2 py-1.5 text-sm"
                value={f.name}
                onChange={(e) => renameFloor(f.id, e.target.value)}
              />
              <button
                type="button"
                className="text-[12px] text-[#0784fa]"
                onClick={() => {
                  dispatch({ type: "SET_ACTIVE_FLOOR", floorId: f.id });
                  dispatch({ type: "SET_FLOORS_OPEN", open: false });
                }}
              >
                열기
              </button>
              <button
                type="button"
                className="text-[12px] text-red-500"
                disabled={state.chart.floors.length <= 1}
                onClick={() => removeFloor(f.id)}
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="mt-4 w-full rounded-md bg-[#0784fa] px-3 py-2 text-sm font-medium text-white"
          onClick={addFloor}
        >
          층 추가
        </button>
      </div>
    </div>
  );
}

export function FirstTimeTutorial({ api }: { readonly api: SeatEditorApi }) {
  if (!api.state.tutorialOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-[#111]">좌석 배치 디자이너</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-[#555]">
          seats.io 스타일 도구로 열·구역·테이블·부스를 그릴 수 있습니다. 고급 기능으로{" "}
          <strong>배경/참조 도면, 다층, 존, View from seat, 가변 점유 테이블, 게시</strong>를 지원합니다.
        </p>
        <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-[13px] text-[#444]">
          <li>왼쪽 템플릿에서 차트 유형을 고릅니다.</li>
          <li>도구 막대로 객체를 그리고, 선택 후 드래그해 이동합니다.</li>
          <li>노드 도구(A)로 구역 꼭짓점을 편집합니다.</li>
          <li>상단 「설정」에서 배경·참조 도면·존을 관리합니다.</li>
          <li>준비가 되면 「게시」로 발행 상태를 표시합니다.</li>
        </ol>
        <button
          type="button"
          className="mt-5 w-full rounded-md bg-[#0784fa] px-3 py-2.5 text-sm font-semibold text-white"
          onClick={api.dismissTutorial}
        >
          시작하기
        </button>
      </div>
    </div>
  );
}

