import type { V2EditorState } from "./editor-model";
import { toolSpec } from "./tool-catalog";

export function EditorFooter({ state, hidden }: { readonly state: V2EditorState; readonly hidden: boolean }) {
  const spec = toolSpec(state.tool);
  return (
    <footer className={`min-h-9 shrink-0 flex-wrap items-center gap-2 overflow-x-auto border-t border-[var(--editor-border)] bg-[var(--editor-surface)] px-4 py-1 sm:h-9 sm:flex-nowrap sm:py-0 sm:whitespace-nowrap ${hidden ? "hidden lg:flex" : "flex"}`} data-testid="seat-designer-v2-help-strip">
      <strong>{spec.label}</strong>
      {spec.help.map((part, index) => index % 2 === 0 ? <kbd key={`${part}-${index}`} className="rounded bg-[var(--editor-hover)] px-2 py-1 text-[11px] font-semibold">{part}</kbd> : <span key={`${part}-${index}`} className="text-[var(--editor-muted)]">{part}</span>)}
    </footer>
  );
}
