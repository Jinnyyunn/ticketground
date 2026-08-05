"use client";

import { useState } from "react";
import Link from "next/link";
import { countPlaces } from "@/lib/seat-designer/chart-ops";
import { ko } from "@/lib/seat-designer/i18n";
import { useSeatEditor } from "@/lib/seat-designer/use-editor";
import { DesignerCanvas } from "./canvas";
import { CategoryManagerDialog, Inspector } from "./inspector";
import { LayerPicker } from "./layer-picker";
import { ChartSettingsDialog, FirstTimeTutorial, FloorsDialog } from "./chart-settings-dialog";
import { TemplateRail } from "./template-rail";
import { ToolPicker } from "./tool-picker";
import { TopToolbar } from "./top-toolbar";

export function SeatDesigner() {
  const api = useSeatEditor();
  const { state, dispatch, validation, allValid, loadTemplate } = api;
  const [layersOpen, setLayersOpen] = useState(false);

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
            {state.boundShowSlugs.map((slug) => (
              <a
                key={slug}
                href={`/booking/${slug}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-md bg-white/10 px-3 py-1.5 hover:bg-white/15"
              >
                예매:{slug}
              </a>
            ))}
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
        <div className="min-h-0 flex-1">
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
      className="flex h-screen flex-col bg-white text-[14px] text-[#333]"
      style={{ fontFamily: "Pretendard, Roboto, Helvetica, Apple SD Gothic Neo, sans-serif" }}
    >
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-black/5 bg-[#111] px-3 text-[12px] text-white/80">
        <div className="flex items-center gap-3">
          <Link href="/console" className="font-semibold text-white hover:text-white/90">
            Ticketground<span className="ml-0.5 text-[#ff2d3f]">●</span>
          </Link>
          <span className="text-white/40">/</span>
          <span>{ko.appTitle}</span>
        </div>
        <div className="flex items-center gap-3">
          {state.serverStatus && (
            <span className="max-w-[280px] truncate text-[11px] text-white/60">{state.serverStatus}</span>
          )}
          <button type="button" className="hover:text-white" onClick={() => void api.saveToServer()}>
            서버 저장
          </button>
          <button type="button" className="hover:text-white" onClick={api.saveLocal}>
            {ko.save}
          </button>
        </div>
      </div>

      <TopToolbar api={api} allValid={allValid} />

      <div className="relative flex min-h-0 flex-1">
        <TemplateRail chart={state.chart} onSelect={loadTemplate} api={api} />
        <ToolPicker
          tool={state.tool}
          onTool={(tool) => dispatch({ type: "SET_TOOL", tool })}
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
    </div>
  );
}
