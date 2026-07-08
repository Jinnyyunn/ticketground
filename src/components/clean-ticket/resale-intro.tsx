import Link from "next/link";
import { Percent, ShieldCheck, Shuffle, Tag } from "lucide-react";
import { TicketgroundTag } from "@/components/ticketground/primitives";

const resalePolicyItems = [
  {
    icon: Tag,
    label: "등록가",
    value: "정가의 90~110%",
    note: "정가 범위 안에서만 공식 풀에 등록",
  },
  {
    icon: Percent,
    label: "수수료",
    value: "거래액 5%",
    note: "플랫폼 클린티켓 운영 수수료",
  },
  {
    icon: Shuffle,
    label: "좌석",
    value: "조건부 랜덤 매칭",
    note: "구매자는 좌석번호 직접 선택 불가",
  },
] as const;

export function ResaleIntro({ apiStatus }: { readonly apiStatus: string }) {
  return (
    <aside
      className="relative overflow-hidden rounded-xl border border-line bg-card text-ink shadow-ticket-3"
      aria-labelledby="resale-policy-title"
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-ticketground" aria-hidden="true" />
      <div
        className="pointer-events-none absolute -top-16 right-0 size-56 rounded-full bg-accent-2/20 blur-3xl"
        aria-hidden="true"
      />
      <div className="relative grid gap-5 bg-surface p-5 lg:grid-cols-[1fr_280px] lg:items-end">
        <header className="min-w-0">
          <TicketgroundTag tone="sale">CLEAN TICKET</TicketgroundTag>
          <h1 className="mt-3 balanced-title text-3xl font-black text-ink sm:text-4xl">Tig 공식 양도 티켓</h1>
          <p className="mt-3 max-w-3xl text-base leading-loose text-ink-3">
            좌석 지정 거래를 막고 공식 풀에서 조건부 랜덤 매칭으로 배정합니다. Tig 공식 양도 티켓 등록은 정가의 90~110%만 허용됩니다.
          </p>
          <Link
            href="/resale"
            className="mt-3 inline-flex h-9 items-center rounded-full border border-line bg-card px-4 text-sm font-black text-ink transition-colors hover:border-line-strong hover:bg-surface focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            양도 허용 공연 전체 보기 →
          </Link>
        </header>
        <div className="rounded-lg border border-line bg-background p-4 shadow-ticket-1" aria-live="polite">
          <p className="flex items-center gap-1.5 text-xs font-black text-ticketground">
            <span className="relative flex size-1.5" aria-hidden="true">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-ticketground/60" />
              <span className="relative inline-flex size-1.5 rounded-full bg-ticketground" />
            </span>
            Tig 공식 양도 티켓 상태
          </p>
          <p className="mt-1 text-sm font-bold leading-relaxed text-ink">{apiStatus}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 border-y border-line bg-ink px-5 py-3 text-on-ink">
        <p id="resale-policy-title" className="flex items-center gap-1.5 text-sm font-black">
          <ShieldCheck className="size-3.5 shrink-0 text-accent-2" aria-hidden />
          클린티켓 정책 요약
        </p>
        <span className="shrink-0 rounded-sm bg-accent-2 px-2.5 py-1 text-xs font-black text-on-accent-2">
          공식 검증
        </span>
      </div>
      <dl className="grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {resalePolicyItems.map((item) => (
          <div
            key={item.label}
            className="flex items-start gap-3 bg-background p-4 transition-colors hover:bg-surface sm:p-5"
            data-resale-policy-item={item.label}
          >
            <span
              className="grid size-8 shrink-0 place-items-center rounded-md border border-line bg-ink text-accent-2"
              aria-hidden="true"
            >
              <item.icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <dt className="text-xs font-black text-ticketground">{item.label}</dt>
              <dd className="mt-0.5 text-base font-black leading-snug text-ink">{item.value}</dd>
              <dd className="mt-1 text-xs font-bold leading-relaxed text-ink-3">{item.note}</dd>
            </div>
          </div>
        ))}
      </dl>
    </aside>
  );
}
