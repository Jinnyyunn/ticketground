import { useEffect, type Dispatch, type SetStateAction } from "react";
import type { RowObject } from "@/types/seat-chart";
import type { V2EditorState } from "./editor-model";
import type { SmartGuide } from "./smart-guides";
import { V2_TOOLS, type V2ToolId } from "./tool-catalog";

type KeyboardDeps = {
  readonly setAltPressed: Dispatch<SetStateAction<boolean>>;
  readonly setSpacePressed: Dispatch<SetStateAction<boolean>>;
  readonly setMultipleBase: Dispatch<SetStateAction<RowObject | null>>;
  readonly setSmartGuides: Dispatch<SetStateAction<readonly SmartGuide[]>>;
  readonly setState: Dispatch<SetStateAction<V2EditorState>>;
  readonly undo: () => void;
  readonly redo: () => void;
  readonly copy: () => void;
  readonly paste: () => void;
  readonly remove: () => void;
  readonly finishPath: () => void;
  readonly selectTool: (tool: V2ToolId) => void;
};

export function useEditorKeyboard(deps: KeyboardDeps): void {
  useEffect(() => {
    function keydown(event: KeyboardEvent): void {
      if (event.key === "Alt") deps.setAltPressed(true);
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
      if (event.code === "Space") { event.preventDefault(); deps.setSpacePressed(true); return; }
      if (event.metaKey || event.ctrlKey) {
        const key = event.key.toLowerCase();
        if (key === "z") { event.preventDefault(); if (event.shiftKey) deps.redo(); else deps.undo(); return; }
        if (key === "c") { event.preventDefault(); deps.copy(); return; }
        if (key === "v") { event.preventDefault(); deps.paste(); return; }
      }
      if (event.key === "Delete" || event.key === "Backspace") deps.remove();
      else if (event.key === "Escape") { deps.setMultipleBase(null); deps.setSmartGuides([]); deps.setState((current) => ({ ...current, draft: null, selectedIds: [] })); }
      else if (event.key === "Enter") deps.finishPath();
      else { const match = V2_TOOLS.find((tool) => tool.shortcut?.toLowerCase() === event.key.toLowerCase()); if (match) deps.selectTool(match.id); }
    }
    function keyup(event: KeyboardEvent): void {
      if (event.key === "Alt") deps.setAltPressed(false);
      if (event.code === "Space") deps.setSpacePressed(false);
    }
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    return () => { window.removeEventListener("keydown", keydown); window.removeEventListener("keyup", keyup); };
  });
}
