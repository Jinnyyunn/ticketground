"use client";

import { useRef } from "react";
import { EditorFooter } from "./editor-footer";
import { EditorHeader } from "./editor-header";
import { EditorOverlays } from "./editor-overlays";
import { EditorWorkspace } from "./editor-workspace";
import { ReferenceStart } from "./reference-start";
import { useSeatDesignerController } from "./use-seat-designer-controller";

export function SeatDesignerV2() {
  const imageInput = useRef<HTMLInputElement>(null);
  const editor = useSeatDesignerController(imageInput);
  const state = editor.state;
  return (
    <div className="seat-designer-shell flex h-[100dvh] min-h-[620px] flex-col overflow-hidden bg-[var(--editor-surface)] text-[13px] text-[var(--editor-text)]" data-testid="seat-designer-v2-shell">
      {!editor.started && <ReferenceStart onBlank={(venue) => editor.start(null, venue)} onReady={editor.start} />}
      <EditorHeader
        state={state}
        setState={editor.setState}
        canUndo={editor.past.length > 0}
        canRedo={editor.future.length > 0}
        canPaste={editor.copiedObjects.length > 0}
        hasSelectedSeat={editor.selectedSeat !== null}
        pendingUploads={editor.pendingUploads}
        onPreview={() => editor.setPreview(true)}
        onUndo={editor.undo}
        onRedo={editor.redo}
        onSeatView={editor.openSeatView}
        onAlign={editor.alignSelected}
        onDistribute={editor.distributeSelected}
        onFlip={editor.flipSelected}
        onCopy={editor.copySelected}
        onPaste={editor.pasteCopied}
        onDuplicate={editor.duplicateSelected}
        onDelete={editor.deleteSelected}
        onCredentials={editor.openCredentials}
        onHelp={editor.openHelp}
        onSave={editor.save}
        onPublish={editor.publish}
      />
      <EditorWorkspace
        state={state}
        setState={editor.setState}
        visibleObjects={editor.visibleObjects}
        previewObjects={editor.previewObjects}
        smartGuides={editor.smartGuides}
        altPressed={editor.altPressed}
        spacePressed={editor.spacePressed}
        selectTool={editor.selectTool}
        pointerDown={editor.pointerDown}
        pointerMove={editor.pointerMove}
        pointerUp={editor.pointerUp}
        editNode={editor.editNode}
        removeNode={editor.removeNode}
        onInsertNode={editor.insertNode}
        onObject={editor.updateObject}
        onSeat={editor.updateSeat}
        onReplaceReference={(file) => void editor.replaceReference(file)}
        onRemoveReference={editor.removeReference}
        onOpenInspector={() => editor.setInspectorOpen(true)}
      />
      <EditorFooter state={state} hidden={editor.inspectorOpen} />
      <input ref={imageInput} type="file" className="sr-only" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void editor.uploadObject(file); event.currentTarget.value = ""; }} />
      <EditorOverlays
        state={state}
        selectedSeat={editor.selectedSeat}
        preview={editor.preview}
        credentialsOpen={editor.credentialsOpen}
        helpOpen={editor.helpOpen}
        seatViewOpen={editor.seatViewOpen}
        inspectorOpen={editor.inspectorOpen}
        pendingUploads={editor.pendingUploads}
        onObject={editor.updateObject}
        onSeat={editor.updateSeat}
        onReplaceReference={(file) => void editor.replaceReference(file)}
        onRemoveReference={editor.removeReference}
        onState={editor.setState}
        onClosePreview={() => editor.setPreview(false)}
        onCloseCredentials={() => editor.setCredentialsOpen(false)}
        onCloseHelp={() => editor.setHelpOpen(false)}
        onCloseSeatView={() => editor.setSeatViewOpen(false)}
        onCloseInspector={() => editor.setInspectorOpen(false)}
        onSave={editor.save}
        onPublish={editor.publish}
        onCopy={editor.copySelected}
        onPaste={editor.pasteCopied}
        onDuplicate={editor.duplicateSelected}
        onDelete={editor.deleteSelected}
        onFlip={editor.flipSelected}
        onSeatView={editor.openSeatView}
        onCredentials={editor.openCredentials}
        onHelp={editor.openHelp}
      />
    </div>
  );
}
