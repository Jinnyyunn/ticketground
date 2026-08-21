export type EditorStatusTone = "neutral" | "success" | "danger";

const STATUS_TONES: Readonly<Record<string, EditorStatusTone>> = {
  "저장 실패": "danger",
  "저장할 수 없음": "danger",
  "게시 실패": "danger",
  "게시할 수 없음": "danger",
  "초안 저장 완료": "success",
  "게시 완료": "success",
};

export function editorStatusTone(status: string): EditorStatusTone {
  return STATUS_TONES[status] ?? "neutral";
}

export function editorStatusClassName(status: string): string {
  const tone = editorStatusTone(status);
  if (tone === "danger") {
    return "bg-[var(--editor-danger-soft)] text-[var(--editor-danger)]";
  }
  if (tone === "success") {
    return "bg-[var(--editor-status-soft)] text-[var(--editor-status)]";
  }
  return "bg-[var(--editor-hover)] text-[var(--editor-muted)]";
}
