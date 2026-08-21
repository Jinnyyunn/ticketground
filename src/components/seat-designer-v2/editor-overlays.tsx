import { X } from "lucide-react";
import type { ChartObject, SeatPlace } from "@/types/seat-chart";
import { CanvasObjects } from "./canvas-objects";
import type { V2EditorState } from "./editor-model";
import { HelpDialog } from "./help-dialog";
import { Inspector } from "./inspector";
import { SeatViewDialog } from "./seat-view-dialog";
import { ServiceCredentialsPanel } from "./service-credentials-panel";
import { editorStatusClassName } from "./status";

type OverlayProps = {
  readonly state: V2EditorState;
  readonly selectedSeat: SeatPlace | null;
  readonly preview: boolean;
  readonly credentialsOpen: boolean;
  readonly helpOpen: boolean;
  readonly seatViewOpen: boolean;
  readonly inspectorOpen: boolean;
  readonly pendingUploads: number;
  readonly onObject: (object: ChartObject) => void;
  readonly onSeat: (seat: SeatPlace) => void;
  readonly onReplaceReference: (file: File) => void;
  readonly onRemoveReference: () => void;
  readonly onState: (state: V2EditorState) => void;
  readonly onClosePreview: () => void;
  readonly onCloseCredentials: () => void;
  readonly onCloseHelp: () => void;
  readonly onCloseSeatView: () => void;
  readonly onCloseInspector: () => void;
  readonly onSave: () => Promise<void>;
  readonly onPublish: () => Promise<void>;
  readonly onCopy: () => void;
  readonly onPaste: () => void;
  readonly onDuplicate: () => void;
  readonly onDelete: () => void;
  readonly onFlip: (axis: "horizontal" | "vertical") => void;
  readonly onSeatView: () => void;
  readonly onCredentials: () => void;
  readonly onHelp: () => void;
};

export function EditorOverlays(props: OverlayProps) {
  return (
    <>
      {props.preview && <div className="fixed inset-0 z-50 grid place-items-center bg-[var(--editor-overlay)] p-6" data-testid="seat-designer-v2-preview"><div className="relative h-[80dvh] w-[90vw] rounded bg-[var(--editor-surface)] shadow-2xl"><button type="button" className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-full bg-[var(--editor-surface)] shadow" onClick={props.onClosePreview}><X className="size-4" /></button><svg className="size-full"><CanvasObjects objects={props.state.objects} selectedIds={[]} selectedSeatIds={[]} nodeMode={false} /></svg></div></div>}
      {props.credentialsOpen && <ServiceCredentialsPanel onClose={props.onCloseCredentials} />}
      {props.helpOpen && <HelpDialog onClose={props.onCloseHelp} />}
      {props.seatViewOpen && props.selectedSeat && <SeatViewDialog seat={props.selectedSeat} onClose={props.onCloseSeatView} />}
      {props.inspectorOpen && <MobileInspector {...props} />}
    </>
  );
}

function MobileInspector(props: OverlayProps) {
  const state = props.state;
  return (
    <div className="fixed inset-y-[46px] right-0 z-[60] flex w-[min(336px,92vw)] flex-col bg-[var(--editor-surface)] shadow-2xl lg:hidden">
      <button type="button" title="속성 패널 닫기" className="absolute right-0 top-0 z-10 grid size-11 place-items-center rounded border border-[var(--editor-border)] bg-[var(--editor-surface)] shadow-sm hover:bg-[var(--editor-hover)]" onClick={props.onCloseInspector}><X className="size-4" /></button>
      <div className="flex h-11 shrink-0 items-center gap-1 overflow-x-auto border-b border-[var(--editor-border)] px-3 pr-12 whitespace-nowrap" data-testid="seat-designer-v2-mobile-actions">
        <button type="button" disabled={props.pendingUploads > 0} className="shrink-0 rounded px-2 py-1 text-xs hover:bg-[var(--editor-hover)] disabled:opacity-40" onClick={() => void props.onSave()}>저장</button>
        <button type="button" disabled={props.pendingUploads > 0} className="shrink-0 rounded px-2 py-1 text-xs hover:bg-[var(--editor-hover)] disabled:opacity-40" onClick={() => void props.onPublish()}>게시</button>
        <button type="button" className="shrink-0 rounded px-2 py-1 text-xs hover:bg-[var(--editor-hover)]" onClick={props.onCopy}>복사</button><button type="button" className="shrink-0 rounded px-2 py-1 text-xs hover:bg-[var(--editor-hover)]" onClick={props.onPaste}>붙여넣기</button><button type="button" className="shrink-0 rounded px-2 py-1 text-xs hover:bg-[var(--editor-hover)]" onClick={props.onDuplicate}>복제</button><button type="button" className="shrink-0 rounded px-2 py-1 text-xs hover:bg-[var(--editor-hover)]" onClick={props.onDelete}>삭제</button>
        <button type="button" className="shrink-0 rounded px-2 py-1 text-xs hover:bg-[var(--editor-hover)]" onClick={() => props.onFlip("horizontal")}>좌우 반전</button><button type="button" className="shrink-0 rounded px-2 py-1 text-xs hover:bg-[var(--editor-hover)]" onClick={() => props.onFlip("vertical")}>상하 반전</button>
        <button type="button" disabled={!props.selectedSeat} className="shrink-0 rounded px-2 py-1 text-xs hover:bg-[var(--editor-hover)] disabled:opacity-40" onClick={props.onSeatView}>좌석 시점</button><button type="button" className="shrink-0 rounded px-2 py-1 text-xs hover:bg-[var(--editor-hover)]" onClick={props.onCredentials}>API 연결</button><button type="button" className="shrink-0 rounded px-2 py-1 text-xs hover:bg-[var(--editor-hover)]" onClick={props.onHelp}>도움말</button>
      </div>
      <div className={`shrink-0 border-b border-[var(--editor-border)] px-3 py-1.5 text-xs font-medium ${editorStatusClassName(state.status)}`} data-testid="seat-designer-v2-mobile-status">{state.status}</div>
      <div className="min-h-0 flex-1 [&>aside]:h-full"><Inspector state={state} onState={props.onState} onObject={props.onObject} onSeat={props.onSeat} onEnterSection={(activeSectionId) => props.onState({ ...state, activeSectionId, selectedIds: [], selectedSeatIds: [] })} onReplaceReference={props.onReplaceReference} onRemoveReference={props.onRemoveReference} /></div>
    </div>
  );
}
