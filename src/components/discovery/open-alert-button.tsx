"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";

export function OpenAlertButton() {
  const [alertEnabled, setAlertEnabled] = useState(false);
  const statusId = useId();
  const statusText = "알림 완료";

  return (
    <div className="flex w-16 shrink-0 flex-col items-start gap-1 sm:w-20">
      <button
        aria-describedby={alertEnabled ? statusId : undefined}
        aria-pressed={alertEnabled}
        className={cn(
          "h-10 w-full whitespace-nowrap rounded-full px-1.5 text-xs font-black transition-all focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-0 sm:px-3 sm:text-sm",
          alertEnabled
            ? "bg-ok text-white shadow-[0_4px_14px_-4px_rgba(0,0,0,0.35)]"
            : "border border-line bg-card text-ink hover:-translate-y-0.5 hover:border-transparent hover:bg-ticketground hover:text-white hover:shadow-[0_8px_18px_-6px_rgba(255,45,63,0.45)]",
        )}
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
