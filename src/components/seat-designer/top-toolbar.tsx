"use client";

import type { ReactNode } from "react";
import {
  AlignCenter,
  CheckCircle2,
  Copy,
  ClipboardPaste,
  CopyPlus,
  Eye,
  FlipHorizontal2,
  FlipVertical2,
  Grid3x3,
  HelpCircle,
  Layers2,
  Moon,
  Redo2,
  Save,
  Send,
  Settings2,
  Sun,
  Tags,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { ko } from "@/lib/seat-designer/i18n";
import type { SeatEditorApi } from "@/lib/seat-designer/use-editor";
import { cn } from "@/lib/utils";

function TbBtn({
  title,
  onClick,
  active,
  disabled,
  children,
}: {
  title: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex size-8 items-center justify-center rounded-md text-[#333] transition hover:bg-black/5 disabled:opacity-35",
        active && "bg-[#0784fa]/10 text-[#0784fa]",
      )}
    >
      {children}
    </button>
  );
}

export function TopToolbar({
  api,
  allValid,
}: {
  readonly api: SeatEditorApi;
  readonly allValid: boolean;
}) {
  const {
    state,
    dispatch,
    saveLocal,
    saveToServer,
    exportJson,
    deleteSelected,
    copySelected,
    pasteClipboard,
    duplicateSelected,
    flip,
    align,
    publishChart,
  } = api;
  const { settings, past, future, chart, preview, viewport, boundShowSlugs } = state;
  const activeFloor = chart.floors.find((f) => f.id === chart.activeFloorId);

  return (
    <header className="flex h-[45px] shrink-0 items-center gap-1 border-b border-[#d8d8d8] bg-white px-2">
      <TbBtn title="서버에 저장 (예매 적용 전 단계)" onClick={() => void saveToServer()}>
        <Save className="size-4" />
      </TbBtn>
      <TbBtn title={`${ko.saveLocal} (이 브라우저만)`} onClick={saveLocal}>
        <span className="text-[9px] font-bold">LOC</span>
      </TbBtn>
      <input
        className="ml-1 w-[160px] truncate border-0 bg-transparent text-sm font-medium text-[#333] outline-none"
        value={chart.name}
        onChange={(e) => dispatch({ type: "SET_NAME", name: e.target.value })}
      />
      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">{ko.editable}</span>

      <div className="mx-2 h-5 w-px bg-black/10" />

      <TbBtn title={ko.preview} active={preview} onClick={() => dispatch({ type: "SET_PREVIEW", preview: !preview })}>
        <Eye className="size-4" />
      </TbBtn>
      <TbBtn
        title={ko.darkCanvas}
        active={settings.darkCanvas}
        onClick={() => dispatch({ type: "TOGGLE_SETTING", key: "darkCanvas" })}
      >
        {settings.darkCanvas ? <Moon className="size-4" /> : <Sun className="size-4" />}
      </TbBtn>

      <div className="mx-1 h-5 w-px bg-black/10" />

      <TbBtn title={ko.undo} disabled={past.length === 0} onClick={() => dispatch({ type: "UNDO" })}>
        <Undo2 className="size-4" />
      </TbBtn>
      <TbBtn title={ko.redo} disabled={future.length === 0} onClick={() => dispatch({ type: "REDO" })}>
        <Redo2 className="size-4" />
      </TbBtn>

      <div className="mx-1 h-5 w-px bg-black/10" />

      <TbBtn
        title={ko.snap}
        active={settings.snapToGrid}
        onClick={() => dispatch({ type: "TOGGLE_SETTING", key: "snapToGrid" })}
      >
        <Grid3x3 className="size-4" />
      </TbBtn>
      <TbBtn
        title={ko.showContents}
        active={settings.showSectionContents}
        onClick={() => dispatch({ type: "TOGGLE_SETTING", key: "showSectionContents" })}
      >
        <span className="text-[10px] font-bold leading-none">§</span>
      </TbBtn>
      <TbBtn
        title={ko.showLabels}
        active={settings.alwaysShowLabels}
        onClick={() => dispatch({ type: "TOGGLE_SETTING", key: "alwaysShowLabels" })}
      >
        <Tags className="size-4" />
      </TbBtn>
      <TbBtn
        title="참조 도면 표시"
        active={settings.showReferenceChart}
        onClick={() => dispatch({ type: "TOGGLE_SETTING", key: "showReferenceChart" })}
      >
        <span className="text-[9px] font-bold">REF</span>
      </TbBtn>
      <TbBtn
        title="배경 이미지 표시"
        active={settings.showBackgroundImage}
        onClick={() => dispatch({ type: "TOGGLE_SETTING", key: "showBackgroundImage" })}
      >
        <span className="text-[9px] font-bold">BG</span>
      </TbBtn>

      <div className="mx-1 h-5 w-px bg-black/10" />

      <TbBtn title={ko.alignCenter} onClick={align}>
        <AlignCenter className="size-4" />
      </TbBtn>
      <TbBtn title={ko.flipH} onClick={() => flip("h")}>
        <FlipHorizontal2 className="size-4" />
      </TbBtn>
      <TbBtn title={ko.flipV} onClick={() => flip("v")}>
        <FlipVertical2 className="size-4" />
      </TbBtn>
      <TbBtn title={ko.duplicate} onClick={duplicateSelected}>
        <CopyPlus className="size-4" />
      </TbBtn>
      <TbBtn title={ko.copy} onClick={copySelected}>
        <Copy className="size-4" />
      </TbBtn>
      <TbBtn title={ko.paste} onClick={pasteClipboard}>
        <ClipboardPaste className="size-4" />
      </TbBtn>
      <TbBtn title={ko.del} onClick={deleteSelected}>
        <Trash2 className="size-4" />
      </TbBtn>

      <div className="flex-1" />

      <TbBtn
        title={ko.zoomOut}
        onClick={() =>
          dispatch({
            type: "SET_VIEWPORT",
            viewport: { zoom: Math.max(0.15, viewport.zoom * 0.85) },
          })
        }
      >
        <ZoomOut className="size-4" />
      </TbBtn>
      <span className="w-12 text-center text-[11px] text-[#666]">{Math.round(viewport.zoom * 100)}%</span>
      <TbBtn
        title={ko.zoomIn}
        onClick={() =>
          dispatch({
            type: "SET_VIEWPORT",
            viewport: { zoom: Math.min(4, viewport.zoom * 1.15) },
          })
        }
      >
        <ZoomIn className="size-4" />
      </TbBtn>

      <div className="mx-1 h-5 w-px bg-black/10" />

      <div className="flex items-center gap-0.5 rounded border border-black/10 px-1">
        {chart.floors.map((f) => (
          <button
            key={f.id}
            type="button"
            title={f.name}
            onClick={() => dispatch({ type: "SET_ACTIVE_FLOOR", floorId: f.id })}
            className={cn(
              "rounded px-1.5 py-0.5 text-[11px] font-medium",
              f.id === chart.activeFloorId ? "bg-[#0784fa] text-white" : "text-[#555] hover:bg-black/5",
            )}
          >
            {f.name}
          </button>
        ))}
        <TbBtn title="층 편집" onClick={() => dispatch({ type: "SET_FLOORS_OPEN", open: true })}>
          <Layers2 className="size-3.5" />
        </TbBtn>
      </div>

      <button
        type="button"
        title="차트 설정 (예매 공연 연결·배경·참조도면·존)"
        onClick={() => dispatch({ type: "SET_CHART_SETTINGS_OPEN", open: true })}
        className="inline-flex h-8 items-center gap-1 rounded-md border border-[#0784fa]/40 bg-[#0784fa]/10 px-2 text-[12px] font-semibold text-[#0784fa] hover:bg-[#0784fa]/15"
      >
        <Settings2 className="size-3.5" />
        설정
      </button>
      <button
        type="button"
        title={chart.published ? "게시 취소" : "서버에 게시 (예매 적용)"}
        onClick={publishChart}
        className={cn(
          "inline-flex h-8 items-center gap-1 rounded-md border px-2 text-[12px] font-semibold",
          chart.published
            ? "border-blue-400 bg-blue-50 text-blue-700"
            : "border-emerald-500/40 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
        )}
      >
        <Send className="size-3.5" />
        {chart.published ? "게시됨" : "게시"}
      </button>
      {chart.published && boundShowSlugs[0] && (
        <a
          href={`/booking/${boundShowSlugs[0]}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 items-center rounded-md border border-black/10 px-2 text-[11px] font-medium text-[#333] hover:bg-black/[0.03]"
          title="예매 화면에서 확인"
        >
          예매 열기
        </a>
      )}
      <TbBtn title={ko.exportJson} onClick={exportJson}>
        <span className="text-[10px] font-bold">JSON</span>
      </TbBtn>
      <span
        title={chart.published ? "게시됨" : allValid ? ko.valid : ko.review}
        className={cn(
          "ml-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
          chart.published
            ? "bg-blue-50 text-blue-700"
            : allValid
              ? "bg-emerald-50 text-emerald-700"
              : "bg-amber-50 text-amber-700",
        )}
      >
        <CheckCircle2 className="size-3.5" />
        {chart.published ? "게시됨" : allValid ? ko.valid : ko.review}
      </span>
      <TbBtn title="튜토리얼" onClick={() => dispatch({ type: "SET_TUTORIAL_OPEN", open: true })}>
        <HelpCircle className="size-4" />
      </TbBtn>
      <span className="ml-1 hidden text-[10px] text-[#999] sm:inline">{activeFloor?.name}</span>
    </header>
  );
}
