import {
  AlignHorizontalJustifyCenter, AlignHorizontalJustifyEnd, AlignHorizontalJustifyStart, AlignHorizontalSpaceBetween,
  AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, AlignVerticalJustifyStart, AlignVerticalSpaceBetween,
  ClipboardCopy, ClipboardPaste, Copy, Eye, FlipHorizontal2, FlipVertical2, Grid3X3, HelpCircle, KeyRound, Magnet, Moon, Redo2, Save, Send, Tags, Trash2, Undo2, X,
} from "lucide-react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { V2EditorState } from "./editor-model";
import type { AlignmentMode, DistributionMode, FlipAxis } from "./object-transform";
import { editorStatusClassName } from "./status";

type HeaderProps = {
  readonly state: V2EditorState;
  readonly setState: Dispatch<SetStateAction<V2EditorState>>;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly canPaste: boolean;
  readonly hasSelectedSeat: boolean;
  readonly pendingUploads: number;
  readonly onPreview: () => void;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  readonly onSeatView: () => void;
  readonly onAlign: (mode: AlignmentMode) => void;
  readonly onDistribute: (mode: DistributionMode) => void;
  readonly onFlip: (axis: FlipAxis) => void;
  readonly onCopy: () => void;
  readonly onPaste: () => void;
  readonly onDuplicate: () => void;
  readonly onDelete: () => void;
  readonly onCredentials: () => void;
  readonly onHelp: () => void;
  readonly onSave: () => Promise<void>;
  readonly onPublish: () => Promise<void>;
};

export function EditorHeader(props: HeaderProps) {
  const { state, setState } = props;
  const toggle = (field: "showGrid" | "snapToGrid" | "showLabels" | "showSectionContents" | "darkCanvas") => setState((current) => ({ ...current, [field]: !current[field] }));
  return (
    <header className="flex h-[46px] shrink-0 items-center border-b border-[var(--editor-border)] bg-[var(--editor-panel)]">
      <div className="flex min-w-0 flex-1 items-center gap-3 px-3">
        <button type="button" title="닫기" className="grid size-8 place-items-center rounded hover:bg-[var(--editor-hover)]"><X className="size-4" /></button>
        <input aria-label="좌석 배치도 이름" className="min-w-0 max-w-52 bg-transparent text-sm outline-none" value={state.name} onChange={(event) => { const name = event.currentTarget.value; setState((current) => ({ ...current, name })); }} />
        <span className={`hidden rounded px-2 py-1 text-xs sm:inline ${editorStatusClassName(state.status)}`}>{state.status}</span>
      </div>
      <div className="flex items-center gap-1 px-2">
        <TopButton label="미리보기" onClick={props.onPreview}><Eye /></TopButton>
        <TopButton label="실행 취소" onClick={props.onUndo} disabled={!props.canUndo}><Undo2 /></TopButton>
        <TopButton label="다시 실행" onClick={props.onRedo} disabled={!props.canRedo}><Redo2 /></TopButton>
        <TopButton label="격자" onClick={() => toggle("showGrid")}><Grid3X3 /></TopButton>
        <span className="hidden md:contents">
          <TopButton label="좌석 시점" onClick={props.onSeatView} disabled={!props.hasSelectedSeat}><Eye /></TopButton>
          <TopButton label="스냅" onClick={() => toggle("snapToGrid")}><Magnet /></TopButton>
          <TopButton label="좌석 라벨" onClick={() => toggle("showLabels")}><Tags /></TopButton>
          <TopButton label="구역 내용" onClick={() => toggle("showSectionContents")}><Eye /></TopButton>
          <TopButton label="캔버스 테마" onClick={() => toggle("darkCanvas")}><Moon /></TopButton>
        </span>
        <span className="hidden xl:contents">
          <TopButton label="왼쪽 정렬" onClick={() => props.onAlign("left")} disabled={state.selectedIds.length < 2}><AlignHorizontalJustifyStart /></TopButton>
          <TopButton label="가운데 정렬" onClick={() => props.onAlign("center")} disabled={state.selectedIds.length < 2}><AlignHorizontalJustifyCenter /></TopButton>
          <TopButton label="오른쪽 정렬" onClick={() => props.onAlign("right")} disabled={state.selectedIds.length < 2}><AlignHorizontalJustifyEnd /></TopButton>
          <TopButton label="위 정렬" onClick={() => props.onAlign("top")} disabled={state.selectedIds.length < 2}><AlignVerticalJustifyStart /></TopButton>
          <TopButton label="중간 정렬" onClick={() => props.onAlign("middle")} disabled={state.selectedIds.length < 2}><AlignVerticalJustifyCenter /></TopButton>
          <TopButton label="아래 정렬" onClick={() => props.onAlign("bottom")} disabled={state.selectedIds.length < 2}><AlignVerticalJustifyEnd /></TopButton>
          <TopButton label="가로 균등 배치" onClick={() => props.onDistribute("horizontal")} disabled={state.selectedIds.length < 3}><AlignHorizontalSpaceBetween /></TopButton>
          <TopButton label="세로 균등 배치" onClick={() => props.onDistribute("vertical")} disabled={state.selectedIds.length < 3}><AlignVerticalSpaceBetween /></TopButton>
          <TopButton label="좌우 반전" onClick={() => props.onFlip("horizontal")} disabled={!state.selectedIds.length}><FlipHorizontal2 /></TopButton>
          <TopButton label="상하 반전" onClick={() => props.onFlip("vertical")} disabled={!state.selectedIds.length}><FlipVertical2 /></TopButton>
        </span>
        <span className="hidden md:contents">
          <TopButton label="복사" onClick={props.onCopy}><ClipboardCopy /></TopButton>
          <TopButton label="붙여넣기" onClick={props.onPaste} disabled={!props.canPaste}><ClipboardPaste /></TopButton>
          <TopButton label="복제" onClick={props.onDuplicate}><Copy /></TopButton>
          <TopButton label="삭제" onClick={props.onDelete}><Trash2 /></TopButton>
          <TopButton label="API 연결" onClick={props.onCredentials}><KeyRound /></TopButton>
          <TopButton label="도움말" onClick={props.onHelp}><HelpCircle /></TopButton>
        </span>
        <button type="button" disabled={props.pendingUploads > 0} className="ml-1 hidden h-8 items-center gap-1 rounded border border-[var(--editor-border)] px-3 font-semibold disabled:cursor-not-allowed disabled:opacity-40 sm:flex" onClick={() => void props.onSave()}><Save className="size-4" />저장</button>
        <button type="button" disabled={props.pendingUploads > 0} className="ml-1 flex h-8 items-center gap-1 rounded border border-[var(--editor-accent)] px-3 font-semibold text-[var(--editor-accent)] hover:bg-[var(--editor-accent-soft)] disabled:cursor-not-allowed disabled:opacity-40" onClick={() => void props.onPublish()}><Send className="size-4" />게시</button>
      </div>
    </header>
  );
}

function TopButton({ label, children, onClick, disabled = false }: { readonly label: string; readonly children: ReactNode; readonly onClick?: () => void; readonly disabled?: boolean }) {
  return <button type="button" title={label} disabled={disabled} onClick={onClick} className="grid size-8 place-items-center rounded hover:bg-[var(--editor-hover)] disabled:opacity-30 [&>svg]:size-4">{children}</button>;
}
