"use client";

import { useState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { countPlaces } from "@/lib/seat-designer/chart-ops";
import { ko } from "@/lib/seat-designer/i18n";
import { useSeatEditor } from "@/lib/seat-designer/use-editor";
import { DesignerCanvas } from "./canvas";
import { CategoryManagerDialog, Inspector } from "./inspector";
import { LayerPicker } from "./layer-picker";
import { ChartSettingsDialog, FirstTimeTutorial, FloorsDialog } from "./chart-settings-dialog";
import { ToolPicker } from "./tool-picker";
import { TopToolbar } from "./top-toolbar";
import { NewChartDialog } from "./new-chart-dialog";
import { ChartLibrary } from "./chart-library";

export function SeatDesigner() {
  const api = useSeatEditor();
  const { state, dispatch, validation, allValid } = api;
  const [layersOpen, setLayersOpen] = useState(false);
  const [newChartOpen, setNewChartOpen] = useState(true);
  const [libraryOpen, setLibraryOpen] = useState(false);

  if (libraryOpen) {
    return (
      <div className="min-h-screen bg-[#f4f6f8] text-[#202124]" data-testid="seat-chart-library-screen">
        <header className="flex h-14 items-center justify-between border-b border-black/10 bg-white px-5">
          <div className="flex items-center gap-3">
            <Link href="/console" aria-label="Ticketground 관리자 콘솔">
              <BrandLogo className="h-5" />
            </Link>
            <span className="text-sm font-semibold">좌석 차트</span>
          </div>
          <button
            type="button"
            className="rounded-md bg-[#0784fa] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0674dc]"
            onClick={() => {
              setLibraryOpen(false);
              setNewChartOpen(true);
            }}
          >
            새 차트 만들기
          </button>
        </header>
        <main className="mx-auto max-w-3xl p-6">
          <section className="rounded-xl border border-black/10 bg-white p-5 shadow-sm">
            <h1 className="text-xl font-bold">저장된 좌석 차트</h1>
            <p className="mt-1 text-sm text-[#667085]">공연장별 초안과 게시 상태를 확인하고 다시 편집할 수 있습니다.</p>
            <div className="mt-5">
              <ChartLibrary api={api} onOpen={() => setLibraryOpen(false)} />
            </div>
          </section>
        </main>
        <NewChartDialog api={api} open={newChartOpen} onClose={() => setNewChartOpen(false)} />
      </div>
    );
  }

  if (state.preview) {
    return (
      <div className="flex h-screen flex-col bg-[#0b0d12] text-white">
        <div className="flex h-12 items-center justify-between border-b border-white/10 px-4">
          <div className="text-sm font-medium">
            {ko.preview} · {state.chart.name}
            {state.chart.published ? " · 게시됨" : " · 초안"}
          </div>
          <div className="flex items-center gap-3 text-sm text-white/70">
            <span>
              {countPlaces(state.chart).toLocaleString("ko-KR")} {ko.places}
            </span>
            {state.boundVenue && (
              <span className="rounded-md bg-white/10 px-3 py-1.5">{state.boundVenue.name}</span>
            )}
            <button
              type="button"
              className="rounded-md bg-white/10 px-3 py-1.5 hover:bg-white/15"
              onClick={() => void api.publishToServer(true)}
            >
              게시
            </button>
            <button
              type="button"
              className="rounded-md bg-white/10 px-3 py-1.5 hover:bg-white/15"
              onClick={() => dispatch({ type: "SET_PREVIEW", preview: false })}
            >
              {ko.exitPreview}
            </button>
          </div>
        </div>
        <div className="flex min-h-0 flex-1">
          <DesignerCanvas
            api={{
              ...api,
              state: {
                ...state,
                tool: "hand",
                settings: { ...state.settings, alwaysShowLabels: true },
              },
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className="seat-designer-shell flex h-screen flex-col text-[14px]"
      data-testid="seat-designer-shell"
    >
      <TopToolbar
        api={api}
        allValid={allValid}
        onSaveAndExit={() => void api.saveToServer().then((saved) => saved && setLibraryOpen(true))}
      />

      <div className="relative flex min-h-0 flex-1">
        <ToolPicker
          tool={state.tool}
          mode={state.toolMode}
          onTool={(tool) => dispatch({ type: "SET_TOOL", tool })}
          onMode={(mode) => dispatch({ type: "SET_TOOL_MODE", mode })}
          onOpenLayers={() => setLayersOpen((v) => !v)}
        />
        <div className="relative flex min-w-0 flex-1 flex-col">
          {layersOpen && (
            <LayerPicker
              value={state.settings.selectionLayer}
              onChange={(layer) => dispatch({ type: "SET_LAYER", layer })}
              onClose={() => setLayersOpen(false)}
            />
          )}
          <DesignerCanvas api={api} />
        </div>
        <Inspector api={api} validation={validation} />
      </div>

      <CategoryManagerDialog api={api} />
      <ChartSettingsDialog api={api} />
      <FloorsDialog api={api} />
      <FirstTimeTutorial api={api} />
      <NewChartDialog api={api} open={newChartOpen && !state.restoredLocalDraft} onClose={() => setNewChartOpen(false)} />
    </div>
  );
}
