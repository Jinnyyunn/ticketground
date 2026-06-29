"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, CalendarDays, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type WatchShow = {
  readonly slug: string;
  readonly title: string;
  readonly venue: string;
  readonly category: string;
  readonly openLabel: string;
  readonly dDayLabel: string;
  readonly defaultEnabled: boolean;
};

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

export function WatchlistBoard({ shows }: { readonly shows: readonly WatchShow[] }) {
  const [showAlerts, setShowAlerts] = useState(() => new Set(shows.filter((show) => show.defaultEnabled).map((show) => show.slug)));
  const [channelAlerts, setChannelAlerts] = useState(() => new Set(channels.filter((channel) => channel.defaultEnabled).map((channel) => channel.id)));

  const toggleShow = (slug: string) => {
    setShowAlerts((current) => {
      const next = new Set(current);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const toggleChannel = (id: ChannelId) => {
    setChannelAlerts((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <section className="ticketground-container py-10">
      <div className="border-b border-line pb-7">
        <p className="text-sm font-black text-ticketground">관심공연·알림</p>
        <h1 className="mt-2 text-[34px] font-black text-ink">예매 오픈 알림</h1>
        <p className="mt-3 max-w-2xl text-sm text-ink-3">
          관심공연별 D-3와 당일 알림 상태를 확인합니다. 이 화면의 설정은 브라우저 상태로만 표시되며 실제 알림 발송이나 저장에 연결되어 있지 않습니다.
        </p>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="grid gap-4" aria-label="관심공연 목록">
          {shows.map((show) => {
            const enabled = showAlerts.has(show.slug);
            return (
              <article key={show.slug} className="rounded-lg border border-line bg-white p-5 shadow-ticket-1">
                <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-surface px-3 py-1 text-sm font-black text-ink-2">{show.category}</span>
                      <span className="rounded-full bg-tint-red px-3 py-1 text-sm font-black text-ticketground">{show.dDayLabel}</span>
                    </div>
                    <h2 className="mt-3 text-[22px] font-black text-ink">{show.title}</h2>
                    <p className="mt-2 text-sm text-ink-3">{show.venue}</p>
                    <p className="mt-1 flex items-center gap-2 text-sm font-bold text-ink-2">
                      <CalendarDays className="size-4" aria-hidden />
                      예매 오픈 {show.openLabel}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 md:justify-end">
                    <Link href={`/goods/${show.slug}`} className="inline-flex h-10 items-center rounded-lg border border-line px-4 text-sm font-black text-ink hover:border-line-strong">
                      상세보기
                    </Link>
                    <ToggleButton
                      active={enabled}
                      label={`${show.title} 알림`}
                      onToggle={() => toggleShow(show.slug)}
                    />
                  </div>
                </div>
              </article>
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
                  <ToggleButton
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

function ToggleButton({ active, label, onToggle }: { readonly active: boolean; readonly label: string; readonly onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-label={`${label} ${active ? "켜짐" : "꺼짐"}`}
      aria-pressed={active}
      onClick={onToggle}
      className={cn(
        "inline-flex h-10 min-w-28 items-center justify-center rounded-lg border px-4 text-sm font-black focus-visible:ring-3 focus-visible:ring-ring/50",
        active ? "border-ink bg-ink text-white" : "border-line-strong bg-white text-ink",
      )}
    >
      {active ? "켜짐" : "꺼짐"}
    </button>
  );
}
