"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const INITIAL_AHEAD = 12847;
const NORMAL_DECREMENTS = [180, 240, 155, 275, 210, 260] as const;
const FAST_DECREMENTS = [3200, 3250, 3150, 3247] as const;

type QueueWaitingRoomProps = {
  readonly title: string;
  readonly venue: string;
  readonly date: string;
  readonly time: string;
  readonly bookingHref: string;
  readonly testMode: "fast" | "normal";
};

export function QueueWaitingRoom({
  title,
  venue,
  date,
  time,
  bookingHref,
  testMode,
}: QueueWaitingRoomProps) {
  const router = useRouter();
  const [ahead, setAhead] = useState(INITIAL_AHEAD);
  const [tick, setTick] = useState(0);
  const [countdown, setCountdown] = useState(5);
  const [redirectStarted, setRedirectStarted] = useState(false);
  const [redirectFallbackVisible, setRedirectFallbackVisible] = useState(false);
  const tickRef = useRef(0);
  const redirectedRef = useRef(false);
  const isReady = ahead === 0;
  const decrements = testMode === "fast" ? FAST_DECREMENTS : NORMAL_DECREMENTS;
  const latestDecrease = decrements[Math.max(0, tick - 1) % decrements.length] ?? decrements[0];
  const speedPerMinute = latestDecrease * 150;
  const etaMinutes = isReady ? 0 : Math.max(1, Math.ceil(ahead / speedPerMinute));
  const progress = Math.min(100, Math.round(((INITIAL_AHEAD - ahead) / INITIAL_AHEAD) * 100));

  const numberFormatter = useMemo(() => new Intl.NumberFormat("ko-KR"), []);

  useEffect(() => {
    if (isReady) return;

    const interval = window.setInterval(() => {
      const decrease = decrements[tickRef.current % decrements.length] ?? decrements[0];
      tickRef.current += 1;
      setTick(tickRef.current);
      setAhead((current) => Math.max(0, current - decrease));
    }, 400);

    return () => window.clearInterval(interval);
  }, [decrements, isReady]);

  useEffect(() => {
    if (!isReady) return;

    if (countdown > 0) {
      const timeout = window.setTimeout(() => setCountdown((current) => current - 1), 1000);
      return () => window.clearTimeout(timeout);
    }

    if (!redirectedRef.current) {
      redirectedRef.current = true;
      const redirectTimeout = window.setTimeout(() => {
        setRedirectStarted(true);
        router.replace(bookingHref);
      }, 0);
      const fallbackTimeout = window.setTimeout(() => setRedirectFallbackVisible(true), 2500);
      return () => {
        window.clearTimeout(redirectTimeout);
        window.clearTimeout(fallbackTimeout);
      };
    }
  }, [bookingHref, countdown, isReady, router]);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#08090d] px-4 py-8 text-white sm:px-6">
      <section className="mx-auto grid min-h-[calc(100vh-64px)] min-w-0 max-w-[1180px] items-center gap-8 lg:grid-cols-[minmax(0,1fr)_460px]">
        <div className="min-w-0">
          <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-white/55 sm:text-[13px] sm:tracking-[0.18em]">Ticketground Waiting Room</p>
          <h1 className="balanced-title mt-4 max-w-[760px] text-[32px] font-black leading-[1.12] sm:text-[44px] sm:leading-[1.08]">
            접속 순서가 되면 자동으로 좌석 선택 화면으로 이동합니다.
          </h1>
          <div className="mt-8 grid min-w-0 max-w-[720px] gap-4 border-y border-white/12 py-6 sm:grid-cols-3">
            <div>
              <p className="text-[13px] text-white/45">공연</p>
              <p className="balanced-title mt-2 text-[17px] font-bold sm:text-[18px]">{title}</p>
            </div>
            <div>
              <p className="text-[13px] text-white/45">일시</p>
              <p className="mt-2 text-[17px] font-bold sm:text-[18px]">
                {date} · {time}
              </p>
            </div>
            <div>
              <p className="text-[13px] text-white/45">장소</p>
              <p className="balanced-title mt-2 text-[17px] font-bold sm:text-[18px]">{venue}</p>
            </div>
          </div>
          <p data-queue-warning className="mt-6 max-w-[620px] rounded-[8px] border border-[#ff2d3f]/50 bg-[#ff2d3f]/12 px-4 py-3 text-[14px] font-semibold text-[#ffb8bf]">
            새로고침하거나 창을 닫으면 현재 대기 순서가 초기화될 수 있습니다.
          </p>
        </div>

        <div className="min-w-0 rounded-[12px] border border-white/12 bg-white/[0.06] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.36)] sm:p-7">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[13px] font-bold text-white/50">내 앞 대기 인원</p>
              <p data-queue-ahead className="mt-2 text-[64px] font-black leading-none tabular-nums">
                {numberFormatter.format(ahead)}
              </p>
            </div>
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/8">
              <div className="h-14 w-14 animate-spin rounded-full border-4 border-white/15 border-t-white motion-reduce:animate-none" aria-hidden="true" />
            </div>
          </div>

          <div className="mt-8">
            <div className="flex items-center justify-between text-[13px] font-semibold text-white/60">
              <span>진행률</span>
              <span>{progress}%</span>
            </div>
            <progress data-queue-progress className="mt-3 h-3 w-full overflow-hidden rounded-full" value={progress} max={100}>
              {progress}%
            </progress>
          </div>

          <div className="mt-7 grid grid-cols-2 gap-3">
            <div className="rounded-[8px] bg-black/24 p-4">
              <p className="text-[13px] text-white/45">처리속도</p>
              <p data-queue-speed className="mt-2 text-[16px] font-bold whitespace-nowrap sm:text-[18px]">
                {`분당 ${numberFormatter.format(speedPerMinute)}명`}
              </p>
            </div>
            <div className="rounded-[8px] bg-black/24 p-4">
              <p className="text-[13px] text-white/45">예상시간</p>
              <p data-queue-eta className="mt-2 text-[18px] font-bold">
                {isReady ? "입장 준비" : `약 ${etaMinutes}분`}
              </p>
            </div>
          </div>

          <div data-queue-countdown className="mt-7 rounded-[8px] border border-white/12 bg-black/28 p-4 text-center">
            <p className="text-[13px] font-semibold text-white/50">상태</p>
            {isReady ? (
              <div>
                <p data-queue-ready className="mt-2 text-[20px] font-black text-[#ffe92e]">
                  {redirectStarted ? "좌석 선택 화면으로 이동 중입니다." : `입장 차례입니다. ${countdown}초 후 좌석 선택으로 이동합니다.`}
                </p>
                {redirectFallbackVisible && (
                  <p data-queue-redirect-fallback className="mt-3 text-[13px] font-bold text-[#ffb8bf]">
                    자동 이동이 지연되고 있습니다. 아래 버튼으로 좌석 선택 화면을 다시 열어 주세요.
                  </p>
                )}
                <Link
                  data-queue-continue
                  href={bookingHref}
                  className="mt-4 inline-flex h-10 items-center justify-center rounded-[8px] bg-white px-4 text-[14px] font-black text-ink"
                >
                  좌석 선택으로 이동
                </Link>
              </div>
            ) : (
              <p className="mt-2 text-[20px] font-black">대기열을 통과하는 중입니다.</p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
