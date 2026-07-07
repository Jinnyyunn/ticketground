"use client";

import { useId, useState } from "react";

export function OpenAlertButton() {
  const [alertEnabled, setAlertEnabled] = useState(false);
  const statusId = useId();
  const statusText = "알림 완료";

  return (
    <div className="flex w-20 shrink-0 flex-col items-start gap-1">
      <button
        aria-describedby={alertEnabled ? statusId : undefined}
        aria-pressed={alertEnabled}
        className="h-10 w-full whitespace-nowrap rounded-lg border border-line bg-card px-2 text-sm font-black text-ink transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:px-3 sm:text-sm"
        onClick={() => setAlertEnabled(true)}
        type="button"
      >
        {alertEnabled ? "설정됨" : "알림"}
      </button>
      {alertEnabled && (
        <p id={statusId} role="status" aria-live="polite" className="max-w-24 text-left text-[11px] font-black leading-tight text-ticketground sm:max-w-32">
          {statusText}
        </p>
      )}
    </div>
  );
}
