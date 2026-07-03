"use client";

import {
  BadgeCheck,
  Banknote,
  CalendarPlus,
  ClipboardCheck,
  KeyRound,
  LifeBuoy,
  LogOut,
  QrCode,
  ShieldCheck,
  Ticket,
  UserCog,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type AdminRole = {
  key: string;
  name: string;
  permissions: string[];
};

type Permission = {
  key: string;
  label: string;
  group: string;
};

type AdminSession = {
  admin: {
    id: string;
    username: string;
    roles: { key: string; name: string }[];
    permissions: string[];
  };
  csrf: string;
  expiresAt: string;
  roles: AdminRole[];
  permissionCatalog: Permission[];
};

type AdminEvent = {
  id: string;
  title: string;
  category: string;
  venueId: string;
  venue: string;
  date: string;
  saleState: string;
  saleNote?: string;
  discountRate?: number;
  zones: { id: string; name: string; faceValue: number }[];
};

type AdminUser = {
  id: string;
  name: string;
  status: string;
  trustScore: number;
};

type AdminTicket = {
  id: string;
  eventId: string;
  zoneId: string;
  seatLabel: string;
  status: string;
  ownerId: string | null;
  faceValue: number;
};

type SupportThread = {
  id: string;
  userId: string;
  subject?: string;
  status: string;
  messages: { actorId: string; message: string; at: string }[];
};

type AdminSummary = {
  stats: {
    totalTickets: number;
    onSaleTickets: number;
    ownedTickets: number;
    resalePools: number;
    supportOpen: number;
    watchUsers: number;
    watchlistEntries: number;
    notificationJobs: number;
    admissionCredentials: number;
    trustedDevices: number;
    operatorAlerts: number;
    ledgerEntries: number;
    ledgerVerified: boolean;
  };
  event: AdminEvent;
  users: AdminUser[];
  tickets: AdminTicket[];
  resalePools: { id: string; ticketId: string; status: string; buyerCount?: number; price: number }[];
  supportThreads: SupportThread[];
  watchlist: { id: string; userId: string; eventId: string }[];
  notificationJobs: { id: string; userId: string; channel: string; status: string }[];
  operatorAlerts: { id: string; type: string; status: string; message: string }[];
  admissionCredentials: { id: string; userId: string; ticketId: string; status: string; riskStatus?: string }[];
  ledger: { id: string; actorId: string; action: string; at: string }[];
  ledgerCheck: { ok: boolean };
};

type Venue = {
  id: string;
  name: string;
};

type VenuesResponse = {
  venues: Venue[];
  events: AdminEvent[];
  event: AdminEvent;
};

type ApiResult<T> = {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
};

const saleStates = ["ON_SALE", "OPEN_SOON", "DISCOUNT_SOON", "ADMIN_HOLD"];
const userStatuses = ["ACTIVE", "WATCHLIST", "BANNED"];
const ticketStatuses = ["ON_SALE", "ADMIN_HOLD"];
const supportStatuses = ["OPEN", "ANSWERED", "CLOSED"];

async function apiRequest<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(path, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  const payload = (await response.json()) as ApiResult<T>;
  if (!response.ok || !payload.ok || !payload.data) {
    throw new Error(payload.error?.message || `${path} 요청 실패`);
  }
  return payload.data;
}

function money(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function valueFromForm(form: HTMLFormElement, name: string) {
  const value = new FormData(form).get(name);
  return typeof value === "string" ? value.trim() : "";
}

function hasPermission(session: AdminSession | null, permission: string) {
  return session?.admin.permissions.includes(permission) ?? false;
}

function StatCell({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "ok" | "warn" }) {
  const toneClass = tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : "text-ink";
  return (
    <div className="min-w-0 border-l border-line bg-white px-4 py-3 first:border-l-0">
      <p className="truncate text-xs font-bold text-ink-3">{label}</p>
      <strong className={`mt-1 block truncate text-2xl font-black ${toneClass}`}>{value}</strong>
    </div>
  );
}

function Panel({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-lg border border-line bg-white">
      <div className="flex min-h-12 items-center gap-2 border-b border-line px-4">
        <span className="text-ink-3">{icon}</span>
        <h2 className="text-base font-black text-ink">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
}: {
  label: string;
  name: string;
  defaultValue?: string | number;
  type?: string;
}) {
  return (
    <label className="grid gap-1 text-xs font-bold text-ink-3">
      {label}
      <input
        className="h-10 min-w-0 rounded-md border border-line bg-white px-3 text-sm font-bold text-ink outline-none focus:border-link"
        defaultValue={defaultValue}
        name={name}
        type={type}
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  options: { label: string; value: string }[];
}) {
  return (
    <label className="grid gap-1 text-xs font-bold text-ink-3">
      {label}
      <select
        className="h-10 min-w-0 rounded-md border border-line bg-white px-3 text-sm font-bold text-ink outline-none focus:border-link"
        defaultValue={defaultValue}
        name={name}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function AdminConsolePage() {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  const visibleTickets = useMemo(() => summary?.tickets.filter((ticket) => !ticket.ownerId).slice(0, 8) || [], [summary]);
  const supportThread = summary?.supportThreads.find((thread) => thread.status !== "CLOSED") || summary?.supportThreads[0];
  const primaryEvent = summary?.event;
  const canManageAccounts = hasPermission(session, "accounts.manage");
  const canManageCatalog = hasPermission(session, "catalog.manage");
  const canManageSupport = hasPermission(session, "support.manage");

  const refreshData = useCallback(async (activeSession: AdminSession | null) => {
    const nextSummary = await apiRequest<AdminSummary>("/api/admin/summary");
    setSummary(nextSummary);
    if (hasPermission(activeSession, "catalog.manage")) {
      const nextVenues = await apiRequest<VenuesResponse>("/api/admin/venues");
      setVenues(nextVenues.venues);
    } else {
      setVenues([]);
    }
  }, []);

  useEffect(() => {
    apiRequest<AdminSession>("/api/admin/session")
      .then(async (nextSession) => {
        setSession(nextSession);
        await refreshData(nextSession);
      })
      .catch(() => {
        setSession(null);
      })
      .finally(() => setLoading(false));
  }, [refreshData]);

  async function mutate<T>(path: string, body: Record<string, unknown>, success: string) {
    if (!session) return;
    setError("");
    setNotice("");
    await apiRequest<T>(path, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "x-tig-csrf": session.csrf },
    });
    await refreshData(session);
    setNotice(success);
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    const form = event.currentTarget;
    try {
      const nextSession = await apiRequest<AdminSession>("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({
          username: valueFromForm(form, "username"),
          password: valueFromForm(form, "password"),
        }),
      });
      setSession(nextSession);
      await refreshData(nextSession);
      setNotice("관리자 세션이 시작되었습니다.");
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "로그인 실패");
    }
  }

  async function handleLogout() {
    if (!session) return;
    await apiRequest<{ loggedOut: boolean }>("/api/admin/logout", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "x-tig-csrf": session.csrf },
    });
    setSession(null);
    setSummary(null);
    setNotice("");
  }

  if (loading) {
    return <main className="grid min-h-screen place-items-center bg-surface px-5 text-sm font-black text-ink">운영 콘솔을 확인하는 중입니다.</main>;
  }

  if (!session || !summary || !primaryEvent) {
    return (
      <main className="grid min-h-screen place-items-center bg-surface px-5 py-10">
        <form className="w-full max-w-[420px] rounded-lg border border-line bg-white p-6 shadow-ticket-1" onSubmit={handleLogin}>
          <div className="flex items-center gap-2 text-ink">
            <KeyRound size={20} />
            <h1 className="text-2xl font-black">Ticketground Admin</h1>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-ink-3">브라우저 세션으로 운영 콘솔에 로그인합니다.</p>
          <div className="mt-5 grid gap-3">
            <Field label="Admin ID" name="username" />
            <Field label="Password" name="password" type="password" />
          </div>
          {error ? <p className="mt-4 rounded-md bg-tint-red px-3 py-2 text-sm font-bold text-ticketground">{error}</p> : null}
          <button className="mt-5 h-11 w-full rounded-md bg-ink px-4 text-sm font-black text-white" type="submit">
            로그인
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-surface text-ink">
      <header className="sticky top-0 z-10 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-black">Ticketground 운영 콘솔</h1>
            <p className="truncate text-xs font-bold text-ink-3">{session.admin.username} · {session.admin.roles.map((role) => role.name).join(", ")}</p>
          </div>
          <button className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-black text-ink" onClick={handleLogout} type="button">
            <LogOut size={16} />
            로그아웃
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1440px] gap-4 px-4 py-4">
        {notice ? <p className="rounded-md border border-line bg-white px-4 py-2 text-sm font-bold text-ok">{notice}</p> : null}
        {error ? <p className="rounded-md border border-line bg-white px-4 py-2 text-sm font-bold text-ticketground">{error}</p> : null}

        <section className="grid overflow-hidden rounded-lg border border-line bg-white md:grid-cols-4 xl:grid-cols-8">
          <StatCell label="전체 티켓" value={money(summary.stats.totalTickets)} />
          <StatCell label="판매 가능" value={money(summary.stats.onSaleTickets)} />
          <StatCell label="소유 티켓" value={money(summary.stats.ownedTickets)} />
          <StatCell label="재판매 풀" value={money(summary.stats.resalePools)} />
          <StatCell label="열린 문의" value={money(summary.stats.supportOpen)} tone={summary.stats.supportOpen ? "warn" : "default"} />
          <StatCell label="감시 계정" value={money(summary.stats.watchUsers)} tone={summary.stats.watchUsers ? "warn" : "default"} />
          <StatCell label="입장 자격" value={money(summary.stats.admissionCredentials)} />
          <StatCell label="원장 검증" value={summary.stats.ledgerVerified ? "정상" : "불일치"} tone={summary.stats.ledgerVerified ? "ok" : "warn"} />
        </section>

        {canManageCatalog ? (
          <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
            <Panel title="공연/상품 Sale 설정" icon={<Ticket size={18} />}>
              <form
                className="grid gap-3 lg:grid-cols-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const prices = Object.fromEntries(primaryEvent.zones.map((zone) => [zone.id, Number(valueFromForm(form, zone.id))]));
                  mutate("/api/admin/events/sale", {
                    eventId: valueFromForm(form, "eventId"),
                    title: valueFromForm(form, "title"),
                    category: valueFromForm(form, "category"),
                    startsAt: valueFromForm(form, "startsAt"),
                    venueId: valueFromForm(form, "venueId"),
                    saleState: valueFromForm(form, "saleState"),
                    saleNote: valueFromForm(form, "saleNote"),
                    discountRate: Number(valueFromForm(form, "discountRate")),
                    prices,
                  }, "판매 설정이 갱신되었습니다.").catch((mutationError) => setError(mutationError instanceof Error ? mutationError.message : "판매 설정 실패"));
                }}
              >
                <input name="eventId" type="hidden" value={primaryEvent.id} />
                <Field label="공연명" name="title" defaultValue={primaryEvent.title} />
                <SelectField label="카테고리" name="category" defaultValue={primaryEvent.category} options={["concert", "festival", "musical", "sports"].map((item) => ({ label: item, value: item }))} />
                <SelectField label="판매 상태" name="saleState" defaultValue={primaryEvent.saleState} options={saleStates.map((item) => ({ label: item, value: item }))} />
                <Field label="시작 일시" name="startsAt" defaultValue={primaryEvent.date} />
                <SelectField label="공연장" name="venueId" defaultValue={primaryEvent.venueId} options={venues.map((venue) => ({ label: venue.name, value: venue.id }))} />
                <Field label="할인율" name="discountRate" defaultValue={primaryEvent.discountRate || 0} type="number" />
                <Field label="운영 메모" name="saleNote" defaultValue={primaryEvent.saleNote || ""} />
                {primaryEvent.zones.map((zone) => (
                  <Field key={zone.id} label={`${zone.name} 가격`} name={zone.id} defaultValue={zone.faceValue} type="number" />
                ))}
                <button className="h-10 rounded-md bg-ticketground px-4 text-sm font-black text-white lg:col-span-3" type="submit">Sale 저장</button>
              </form>
            </Panel>

            <Panel title="신규 공연/티켓 추가" icon={<CalendarPlus size={18} />}>
              <form
                className="grid gap-3 md:grid-cols-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  mutate("/api/admin/events/create", {
                    title: valueFromForm(form, "title"),
                    category: valueFromForm(form, "category"),
                    startsAt: valueFromForm(form, "startsAt"),
                    venueId: valueFromForm(form, "venueId"),
                    saleState: valueFromForm(form, "saleState"),
                    saleNote: valueFromForm(form, "saleNote"),
                    prices: {
                      zone_vip: Number(valueFromForm(form, "zone_vip")),
                      zone_r: Number(valueFromForm(form, "zone_r")),
                      zone_s: Number(valueFromForm(form, "zone_s")),
                    },
                  }, "신규 공연과 티켓이 생성되었습니다.").catch((mutationError) => setError(mutationError instanceof Error ? mutationError.message : "신규 공연 생성 실패"));
                }}
              >
                <Field label="공연명" name="title" defaultValue="Admin Draft Live" />
                <SelectField label="카테고리" name="category" defaultValue="concert" options={["concert", "festival", "musical", "sports"].map((item) => ({ label: item, value: item }))} />
                <Field label="시작 일시" name="startsAt" defaultValue="2026-12-24T19:30:00+09:00" />
                <SelectField label="공연장" name="venueId" defaultValue={primaryEvent.venueId} options={venues.map((venue) => ({ label: venue.name, value: venue.id }))} />
                <SelectField label="초기 상태" name="saleState" defaultValue="OPEN_SOON" options={saleStates.map((item) => ({ label: item, value: item }))} />
                <Field label="운영 메모" name="saleNote" defaultValue="관리자 초안" />
                <Field label="VIP 가격" name="zone_vip" defaultValue={154000} type="number" />
                <Field label="R 가격" name="zone_r" defaultValue={121000} type="number" />
                <Field label="S 가격" name="zone_s" defaultValue={99000} type="number" />
                <button className="h-10 rounded-md bg-ink px-4 text-sm font-black text-white md:col-span-2" type="submit">공연/티켓 생성</button>
              </form>
            </Panel>
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-3">
          {canManageAccounts ? (
            <Panel title="회원/계정 상태" icon={<UserCog size={18} />}>
              <form
                className="grid gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  mutate("/api/admin/users/status", {
                    userId: valueFromForm(form, "userId"),
                    status: valueFromForm(form, "status"),
                    reason: valueFromForm(form, "reason"),
                  }, "계정 상태가 갱신되었습니다.").catch((mutationError) => setError(mutationError instanceof Error ? mutationError.message : "계정 상태 변경 실패"));
                }}
              >
                <SelectField label="회원" name="userId" defaultValue={summary.users[0]?.id} options={summary.users.map((user) => ({ label: `${user.name} · ${user.status} · ${user.trustScore}`, value: user.id }))} />
                <SelectField label="상태" name="status" defaultValue="WATCHLIST" options={userStatuses.map((item) => ({ label: item, value: item }))} />
                <Field label="사유" name="reason" defaultValue="운영 콘솔 검토" />
                <button className="h-10 rounded-md bg-ink px-4 text-sm font-black text-white" type="submit">계정 상태 저장</button>
              </form>
            </Panel>
          ) : null}

          {canManageCatalog ? (
            <Panel title="티켓 재고 상태" icon={<ClipboardCheck size={18} />}>
              <form
                className="grid gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  mutate("/api/admin/tickets/status", {
                    ticketId: valueFromForm(form, "ticketId"),
                    status: valueFromForm(form, "status"),
                  }, "티켓 재고 상태가 갱신되었습니다.").catch((mutationError) => setError(mutationError instanceof Error ? mutationError.message : "티켓 상태 변경 실패"));
                }}
              >
                <SelectField label="티켓" name="ticketId" defaultValue={visibleTickets[0]?.id} options={visibleTickets.map((ticket) => ({ label: `${ticket.seatLabel} · ${ticket.status} · ${money(ticket.faceValue)}원`, value: ticket.id }))} />
                <SelectField label="상태" name="status" defaultValue="ADMIN_HOLD" options={ticketStatuses.map((item) => ({ label: item, value: item }))} />
                <button className="h-10 rounded-md bg-ink px-4 text-sm font-black text-white" type="submit">재고 상태 저장</button>
              </form>
              <div className="mt-4 max-h-48 overflow-auto border-t border-line pt-3 text-xs font-bold text-ink-3">
                {visibleTickets.map((ticket) => (
                  <p key={ticket.id} className="flex justify-between gap-3 py-1">
                    <span>{ticket.seatLabel}</span>
                    <span>{ticket.status}</span>
                  </p>
                ))}
              </div>
            </Panel>
          ) : null}

          {canManageSupport ? (
            <Panel title="문의 답변/상태" icon={<LifeBuoy size={18} />}>
              {supportThread ? (
                <form
                  className="grid gap-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = event.currentTarget;
                    mutate("/api/admin/support/messages", {
                      threadId: valueFromForm(form, "threadId"),
                      message: valueFromForm(form, "message"),
                    }, "문의 답변이 등록되었습니다.").then(() => {
                      const status = valueFromForm(form, "status");
                      if (status) {
                        return mutate("/api/admin/support/status", { threadId: valueFromForm(form, "threadId"), status }, "문의 상태가 갱신되었습니다.");
                      }
                      return undefined;
                    }).catch((mutationError) => setError(mutationError instanceof Error ? mutationError.message : "문의 처리 실패"));
                  }}
                >
                  <input name="threadId" type="hidden" value={supportThread.id} />
                  <p className="rounded-md bg-surface px-3 py-2 text-sm font-bold text-ink">{supportThread.subject || supportThread.id} · {supportThread.status}</p>
                  <Field label="답변" name="message" defaultValue="운영자 확인 후 처리했습니다." />
                  <SelectField label="상태" name="status" defaultValue="ANSWERED" options={supportStatuses.map((item) => ({ label: item, value: item }))} />
                  <button className="h-10 rounded-md bg-ink px-4 text-sm font-black text-white" type="submit">문의 처리</button>
                </form>
              ) : (
                <p className="text-sm font-bold text-ink-3">열린 문의가 없습니다.</p>
              )}
            </Panel>
          ) : null}
        </div>

        <div className="grid gap-4 xl:grid-cols-4">
          <Panel title="재판매/양도 Overview" icon={<Banknote size={18} />}>
            <div className="grid gap-2 text-sm font-bold text-ink-3">
              <p>열린 재판매 풀 {summary.stats.resalePools}개</p>
              <p>관심 알림 {summary.stats.watchlistEntries}개 · 작업 {summary.stats.notificationJobs}개</p>
              <p>운영 알림 {summary.stats.operatorAlerts}개</p>
            </div>
          </Panel>
          <Panel title="입장 QR/현장 Overview" icon={<QrCode size={18} />}>
            <div className="grid gap-2 text-sm font-bold text-ink-3">
              <p>입장 자격 {summary.stats.admissionCredentials}개</p>
              <p>신뢰 기기 {summary.stats.trustedDevices}개</p>
              <p>현장 리스크 {summary.admissionCredentials.filter((item) => item.riskStatus && item.riskStatus !== "CLEAR").length}건</p>
            </div>
          </Panel>
          <Panel title="감사 원장 검증" icon={<BadgeCheck size={18} />}>
            <div className="grid gap-2 text-sm font-bold text-ink-3">
              <p className={summary.ledgerCheck.ok ? "text-ok" : "text-warn"}>{summary.ledgerCheck.ok ? "Ledger chain verified" : "Ledger chain mismatch"}</p>
              <p>엔트리 {summary.stats.ledgerEntries}개</p>
              <p>최근 작업 {summary.ledger[0]?.action || "없음"}</p>
            </div>
          </Panel>
          <Panel title="ACL/Roles" icon={<ShieldCheck size={18} />}>
            <div className="flex flex-wrap gap-2">
              {session.admin.roles.map((role) => (
                <span key={role.key} className="rounded-md bg-ink px-2 py-1 text-xs font-black text-white">{role.name}</span>
              ))}
            </div>
            <div className="mt-3 grid gap-1 text-xs font-bold text-ink-3">
              {session.permissionCatalog.map((permission) => (
                <p key={permission.key} className="flex items-center justify-between gap-2 border-t border-line pt-1">
                  <span>{permission.group}</span>
                  <span className={session.admin.permissions.includes(permission.key) ? "text-ok" : "text-ink-4"}>{permission.label}</span>
                </p>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </main>
  );
}
