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

export function LoginSessionPanel({
  onProfileNameChange,
  onSaveProfile,
  profileName,
  saving,
  session,
  status,
}: LoginSessionPanelProps) {
  return (
    <div className="mt-5 rounded-[10px] border border-line bg-surface p-4" aria-live="polite">
      <p className="text-sm font-black text-ink">세션 상태</p>
      <p className="mt-1 text-sm font-bold text-ink-3">{status}</p>
      {session && (
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="grid gap-2 text-sm font-black text-ink">
            닉네임
            <input
              value={profileName}
              onChange={(event) => onProfileNameChange(event.target.value)}
              maxLength={12}
              className="h-11 rounded-sm border border-line-strong bg-white px-3 text-sm font-medium text-ink outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
            />
          </label>
          <button
            type="button"
            disabled={saving || !profileName.trim()}
            onClick={onSaveProfile}
            className="h-11 self-end rounded-sm bg-ink px-4 text-sm font-black text-white disabled:bg-surface-3 disabled:text-ink-4"
          >
            {saving ? "저장 중" : "프로필 저장"}
          </button>
        </div>
      )}
    </div>
  );
}
