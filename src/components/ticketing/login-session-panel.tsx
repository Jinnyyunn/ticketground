"use client";

import type { ApiSession } from "@/lib/ticketground-api";

type LoginSessionPanelProps = {
  readonly onProfileNameChange: (value: string) => void;
  readonly onSaveProfile: () => void;
  readonly profileName: string;
  readonly saving: boolean;
  readonly session: ApiSession | null;
  readonly status: string;
};

const DEFAULT_STATUS = "로그인 또는 회원가입을 진행해 주세요";

export function LoginSessionPanel({
  onProfileNameChange,
  onSaveProfile,
  profileName,
  saving,
  session,
  status,
}: LoginSessionPanelProps) {
  if (!session) {
    if (status === DEFAULT_STATUS) return null;

    return (
      <p className="mt-5 text-sm font-bold leading-relaxed text-ink-3" aria-live="polite" role="status">
        {status}
      </p>
    );
  }

  return (
    <div className="mt-5 grid gap-3 rounded-md border border-line bg-surface p-4 sm:grid-cols-[1fr_auto]" aria-live="polite">
      <label className="grid gap-2 text-sm font-black text-ink">
        닉네임
        <input
          value={profileName}
          onChange={(event) => onProfileNameChange(event.target.value)}
          maxLength={12}
          className="h-11 rounded-sm border border-line-strong bg-card px-3 text-sm font-medium text-ink outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
        />
      </label>
      <button
        type="button"
        disabled={saving || !profileName.trim()}
        onClick={onSaveProfile}
        className="h-11 self-end rounded-sm bg-ink px-4 text-sm font-black text-on-ink disabled:bg-surface-3 disabled:text-ink-4"
      >
        {saving ? "저장 중" : "프로필 저장"}
      </button>
    </div>
  );
}
