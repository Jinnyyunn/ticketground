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
        className="h-8 w-full whitespace-nowrap rounded-lg border border-line bg-white px-2 text-[13px] font-black text-ink sm:px-3 sm:text-sm"
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
