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
        "seat-designer-control flex size-8 shrink-0 items-center justify-center disabled:opacity-35",
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
  onSaveAndExit,
}: {
  readonly api: SeatEditorApi;
  readonly allValid: boolean;
  readonly onSaveAndExit: () => void;
}) {
  const {
    state,
    dispatch,
    exportJson,
    deleteSelected,
    copySelected,
    pasteClipboard,
    duplicateSelected,
    flip,
    align,
    publishChart,
  } = api;
  const { settings, past, future, chart, preview, viewport, boundVenue } = state;
  const activeFloor = chart.floors.find((f) => f.id === chart.activeFloorId);

  return (
    <header className="seat-designer-toolbar flex h-[45px] shrink-0 items-center gap-1 overflow-x-auto border-b px-2">
      <TbBtn title="저장 후 나가기" onClick={onSaveAndExit}>
        <Save className="size-4" />
      </TbBtn>
      <input
        className="ml-1 w-[160px] shrink-0 truncate border-0 bg-transparent text-sm font-medium text-[#333] outline-none"
        value={chart.name}
        onChange={(e) => dispatch({ type: "SET_NAME", name: e.target.value })}
      />
      <span className="shrink-0 whitespace-nowrap rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">{ko.editable}</span>
      {state.serverStatus && <span aria-live="polite" className="max-w-40 truncate text-[11px] text-[#777]">{state.serverStatus}</span>}

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

      <div className="flex shrink-0 items-center gap-0.5 rounded border border-black/10 px-1">
        {chart.floors.map((f) => (
          <button
            key={f.id}
            type="button"
            title={f.name}
            onClick={() => dispatch({ type: "SET_ACTIVE_FLOOR", floorId: f.id })}
            className={cn(
              "whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium",
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
        data-testid="seat-designer-settings"
        title="차트 설정 (공연장 연결·배경·참조도면·존)"
        onClick={() => dispatch({ type: "SET_CHART_SETTINGS_OPEN", open: true })}
        className="inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-[#0784fa]/40 bg-[#0784fa]/10 px-2 text-[12px] font-semibold text-[#0784fa] hover:bg-[#0784fa]/15"
      >
        <Settings2 className="size-3.5" />
        설정
      </button>
      <button
        type="button"
        data-testid="seat-designer-publish"
        title={chart.published ? "게시 취소" : boundVenue ? "게시" : "공연장을 먼저 선택하세요"}
        disabled={!chart.published && !boundVenue}
        onClick={publishChart}
        className={cn(
          "inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-md border px-2 text-[12px] font-semibold disabled:cursor-not-allowed disabled:opacity-40",
          chart.published
            ? "border-blue-400 bg-blue-50 text-blue-700"
            : "border-emerald-500/40 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
        )}
      >
        <Send className="size-3.5" />
        {chart.published ? "게시됨" : "게시"}
      </button>
      <TbBtn title={ko.exportJson} onClick={exportJson}>
        <span className="text-[10px] font-bold">JSON</span>
      </TbBtn>
      <span
        title={chart.published ? "게시됨" : allValid ? ko.valid : ko.review}
        className={cn(
          "ml-1 inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold",
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
