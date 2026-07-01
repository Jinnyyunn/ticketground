"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCircle2 } from "lucide-react";
import { DEMO_EVENT_ID, getWatchlist, notifyWatchlist, upsertWatchlist } from "@/lib/ticketground-api";
import { cn } from "@/lib/utils";
import { WatchlistShowCard, type WatchShow } from "./watchlist-show-card";
import { WatchlistToggleButton } from "./watchlist-toggle-button";

type ChannelId = "kakao" | "appPush" | "email" | "sms";

type Channel = {
  readonly id: ChannelId;
  readonly label: string;
  readonly detail: string;
  readonly defaultEnabled: boolean;
};

const channels: readonly Channel[] = [
  { id: "kakao", label: "카카오톡", detail: "예매 오픈 링크", defaultEnabled: true },
  { id: "appPush", label: "앱 푸시", detail: "대기열 시작 안내", defaultEnabled: true },
  { id: "email", label: "이메일", detail: "상세 일정 요약", defaultEnabled: true },
  { id: "sms", label: "SMS", detail: "당일 짧은 알림", defaultEnabled: false },
] as const;

const timeline = [
  { label: "등록", state: "done", copy: "관심공연에 추가됨" },
  { label: "D-3", state: "next", copy: "예매 준비 알림 예정" },
  { label: "당일", state: "waiting", copy: "오픈 시간에 맞춰 재확인" },
] as const;

const internalApiErrorPattern = /invalid_type|expected array|received undefined|Invalid input|ZodError/i;
const backendChannelLabels: Readonly<Record<string, string>> = {
  APP_PUSH: "앱 푸시",
  EMAIL: "이메일",
  KAKAO: "카카오톡",
  SMS: "SMS",
};

function backendStatusMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;
  const message = error.message.trim();
  if (!message || internalApiErrorPattern.test(message)) return fallback;
  return message;
}

function channelLabel(channel: string) {
  return backendChannelLabels[channel] ?? channel;
}

export function WatchlistBoard({ shows }: { readonly shows: readonly WatchShow[] }) {
  const [showAlerts, setShowAlerts] = useState(() => new Set(shows.filter((show) => show.defaultEnabled).map((show) => show.slug)));
  const [channelAlerts, setChannelAlerts] = useState(() => new Set(channels.filter((channel) => channel.defaultEnabled).map((channel) => channel.id)));
  const [backendStatus, setBackendStatus] = useState("관심공연 동기화 중");

  function selectedBackendChannels(nextChannelAlerts = channelAlerts) {
    return channels
      .filter((channel) => nextChannelAlerts.has(channel.id))
      .map((channel) => channel.id === "appPush" ? "APP_PUSH" : channel.id.toUpperCase());
  }

  async function refreshWatchlist() {
    try {
      const watchlist = await getWatchlist();
      setBackendStatus(watchlist.length ? `${watchlist.length}건의 관심공연 저장됨` : "저장된 관심공연이 아직 없습니다.");
    } catch (error) {
      setBackendStatus(backendStatusMessage(error, "관심공연을 불러오지 못했습니다."));
    }
  }

  useEffect(() => {
    let mounted = true;
    getWatchlist()
      .then((watchlist) => {
        if (!mounted) return;
        setBackendStatus(watchlist.length ? `${watchlist.length}건의 관심공연 저장됨` : "저장된 관심공연이 아직 없습니다.");
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setBackendStatus(backendStatusMessage(error, "관심공연을 불러오지 못했습니다."));
      });
    return () => {
      mounted = false;
    };
  }, []);

  const toggleShow = (slug: string) => {
    setShowAlerts((current) => {
      const next = new Set(current);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
    if (!showAlerts.has(slug)) {
      setBackendStatus("관심공연 저장 중");
      upsertWatchlist(DEMO_EVENT_ID, selectedBackendChannels())
        .then((result) => {
          setBackendStatus(`관심공연 저장 완료 · 알림 ${result.notificationJobs.length}건 예약`);
          return refreshWatchlist();
        })
        .catch((error: unknown) => {
          setBackendStatus(backendStatusMessage(error, "관심공연 저장에 실패했습니다."));
        });
    }
  };

  const toggleChannel = (id: ChannelId) => {
    setChannelAlerts((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      void upsertWatchlist(DEMO_EVENT_ID, selectedBackendChannels(next))
        .then((result) => {
          setBackendStatus(`채널 저장 완료 · ${result.watchlist.channels.map(channelLabel).join(", ")}`);
        })
        .catch((error: unknown) => {
          setBackendStatus(backendStatusMessage(error, "채널 저장에 실패했습니다."));
        });
      return next;
    });
  };

  async function recordNotification() {
    setBackendStatus("알림 기록 중");
    try {
      const result = await notifyWatchlist(DEMO_EVENT_ID);
      setBackendStatus(`알림 기록 완료 · ${result.notificationJob.status === "SENT" ? "발송됨" : "처리됨"}`);
    } catch (error) {
      setBackendStatus(backendStatusMessage(error, "알림 기록에 실패했습니다."));
    }
  }

  return (
    <section className="ticketground-container py-10">
      <div className="border-b border-line pb-7">
        <p className="text-sm font-black text-ticketground">관심공연·알림</p>
        <h1 className="mt-2 text-[34px] font-black text-ink">예매 오픈 알림</h1>
        <p className="mt-3 max-w-2xl text-sm text-ink-3">
          관심공연별 D-3와 당일 알림 상태를 확인하고 알림 채널을 저장합니다.
        </p>
        <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-sm font-bold text-ink-3" aria-live="polite">{backendStatus}</p>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="grid gap-4" aria-label="관심공연 목록">
          {shows.map((show) => {
            const enabled = showAlerts.has(show.slug);
            return (
              <WatchlistShowCard
                key={show.slug}
                enabled={enabled}
                onRecordNotification={recordNotification}
                onToggle={() => toggleShow(show.slug)}
                show={show}
              />
            );
          })}
        </div>

        <aside className="grid gap-4 lg:sticky lg:top-32 lg:self-start" aria-label="알림 타임라인 및 채널 설정">
          <div className="rounded-lg border border-line bg-surface p-5">
            <div className="flex items-center gap-2">
              <Bell className="size-5 text-ticketground" aria-hidden />
              <h2 className="text-[20px] font-black text-ink">D-3 / 당일 타임라인</h2>
            </div>
            <ol className="mt-5 grid gap-3">
              {timeline.map((item) => (
                <li key={item.label} className="grid grid-cols-[28px_1fr] gap-3" data-timeline-state={item.state}>
                  <span
                    className={cn(
                      "mt-1 flex size-7 items-center justify-center rounded-full border text-sm font-black",
                      item.state === "done" && "border-ok bg-ok text-white",
                      item.state === "next" && "border-ticketground bg-white text-ticketground",
                      item.state === "waiting" && "border-line-strong bg-white text-ink-3",
                    )}
                  >
                    {item.state === "done" ? <CheckCircle2 className="size-4" aria-hidden /> : item.label === "D-3" ? "3" : "0"}
                  </span>
                  <div>
                    <p className="text-sm font-black text-ink">{item.label}</p>
                    <p className="text-sm text-ink-3">{item.copy}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-lg border border-line bg-white p-5">
            <h2 className="text-[20px] font-black text-ink">채널 설정</h2>
            <div className="mt-4 grid gap-3">
              {channels.map((channel) => (
                <div key={channel.id} className="grid gap-3 rounded-lg border border-line p-4">
                  <div>
                    <p className="text-sm font-black text-ink">{channel.label}</p>
                    <p className="text-sm text-ink-3">{channel.detail}</p>
                  </div>
                  <WatchlistToggleButton
                    active={channelAlerts.has(channel.id)}
                    label={`${channel.label} 수신`}
                    onToggle={() => toggleChannel(channel.id)}
                  />
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
