"use client";

import { useCallback, useEffect, useState } from "react";
import {
  clearSessionUser,
  getIdentityStatus,
  mockCompleteNiceIdentityVerification,
  startNiceIdentityVerification,
  type ApiIdentityStatus,
} from "@/lib/ticketground-api";
import { isSessionAuthError, SESSION_EXPIRED_MESSAGE } from "@/lib/session-auth-error";
import { storedSessionUserId } from "@/lib/ticketground-session-storage";
import { useSessionAuth } from "@/lib/use-session-auth";

export function IdentityVerificationPanel() {
  const { signedIn } = useSessionAuth();
  const [status, setStatus] = useState<ApiIdentityStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [phone, setPhone] = useState("");
  const [mockMode, setMockMode] = useState(false);
  const [message, setMessage] = useState("본인인증 상태를 확인하는 중입니다.");

  const refresh = useCallback(async () => {
    const userId = storedSessionUserId();
    if (!userId) {
      setMessage("로그인 후 본인인증을 진행할 수 있습니다.");
      return;
    }
    try {
      const next = await getIdentityStatus(userId);
      setStatus(next);
      setMessage(next.verified ? "본인인증이 완료된 계정입니다." : "티켓 예매 전 NICE 휴대폰 본인인증이 필요합니다.");
    } catch (error) {
      if (isSessionAuthError(error)) {
        // The backend actively rejected the stored credential (expired or
        // revoked) - drop the stale local session so useSessionAuth() flips
        // signedIn to false and this panel's own button switches to "로그인
        // 하고 본인인증하기" instead of staying on a dead "NICE 본인인증 시작"
        // button that keeps failing silently. A credential-less legacy demo
        // session (LOGIN_REQUIRED) is intentionally NOT cleared here - see
        // session-auth-error.ts for why.
        clearSessionUser();
        setMessage(SESSION_EXPIRED_MESSAGE);
        return;
      }
      setMessage(error instanceof Error ? error.message : "본인인증 상태를 확인하지 못했습니다.");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function begin() {
    const userId = storedSessionUserId();
    if (!userId || busy) {
      if (!userId) {
        window.location.assign("/login");
        return;
      }
      setMessage("본인인증 요청이 진행 중입니다.");
      return;
    }
    setBusy(true);
    setMessage("NICE 본인인증 창을 준비하는 중입니다.");
    try {
      const popup = window.open("about:blank", "nice-identity-verify", "width=430,height=640");
      if (!popup) {
        setMessage("팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.");
        return;
      }
      const started = await startNiceIdentityVerification({ userId });
      setMockMode(started.mockAvailable && !started.authUrl);
      if (!started.authUrl) {
        if (started.mockAvailable) {
          popup.close();
          if (!phone.trim()) {
            setMessage("QA 모드에서는 휴대폰 번호를 입력해 주세요.");
            return;
          }
          const completed = await mockCompleteNiceIdentityVerification({
            identityVerificationId: started.identityVerificationId,
            phone: phone.trim(),
            userId,
          });
          setStatus(completed);
          setMessage("QA 모드 본인인증이 완료되었습니다.");
          return;
        }
        popup.close();
        setMessage("NICE 본인인증 URL을 만들지 못했습니다.");
        return;
      }
      popup.location.href = started.authUrl;
      setMessage("NICE 본인인증을 완료한 뒤 이 창으로 돌아와 주세요.");
      const startedAt = Date.now();
      while (!popup.closed && Date.now() - startedAt < 180000) {
        await new Promise((resolve) => window.setTimeout(resolve, 2000));
        const refreshed = await getIdentityStatus(userId).catch(() => null);
        if (refreshed?.verified) {
          setStatus(refreshed);
          setMessage("본인인증이 완료된 계정입니다.");
          popup.close();
          break;
        }
      }
      await refresh();
    } catch (error) {
      if (isSessionAuthError(error)) {
        clearSessionUser();
        setMessage(SESSION_EXPIRED_MESSAGE);
        return;
      }
      setMessage(error instanceof Error ? error.message : "본인인증 요청에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="identity" className="mt-8 scroll-mt-[176px] rounded-md border border-line bg-card p-5" data-testid="mypage-identity-panel">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-ticketground">ACCOUNT SECURITY</p>
          <h2 className="mt-2 text-2xl font-black text-ink-2">본인인증</h2>
          <p className="mt-2 max-w-2xl text-sm font-bold leading-6 text-ink-3">
            NICE 휴대폰 본인인증으로 예매 계정을 보호합니다. 인증된 휴대폰은 다른 계정에서 재사용할 수 없습니다.
          </p>
        </div>
        <span className={status?.verified ? "rounded-full bg-ok px-3 py-1 text-xs font-black text-white" : "rounded-full bg-ticketground px-3 py-1 text-xs font-black text-white"}>
          {status?.verified ? "인증 완료" : "인증 필요"}
        </span>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {mockMode ? (
          <input
            aria-label="QA 휴대폰 번호"
            className="h-11 min-w-52 rounded-sm border border-line-strong bg-background px-3 text-sm font-bold text-ink outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
            inputMode="tel"
            onChange={(event) => setPhone(event.target.value)}
            placeholder="휴대폰 번호"
            value={phone}
          />
        ) : null}
        <button
          className="h-11 rounded-sm bg-ink-2 px-5 text-sm font-black text-on-ink-2 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy || status?.verified === true}
          onClick={() => void begin()}
          type="button"
        >
          {status?.verified
            ? "본인인증 완료"
            : busy
              ? "인증 창 준비 중"
              : signedIn
                ? "NICE 본인인증 시작"
                : "로그인하고 본인인증하기"}
        </button>
        {status?.verified && status.phoneMasked ? <span className="text-sm font-bold text-ink-3">인증 휴대폰 {status.phoneMasked}</span> : null}
      </div>
      <p aria-live="polite" className="mt-3 text-sm font-bold text-ink-3">{message}</p>
    </section>
  );
}

