"use client";

import Link from "next/link";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Field, money, Notice, SelectField, TextareaField, valueFromForm, WorkspacePanel } from "@/components/admin/console-primitives";
import type { Feedback } from "@/components/admin/console-types";
import { SellerSiteHeader } from "./seller-site-header";
import {
  sellerEventCategoryOptions,
  sellerPublishStatusLabels,
  type SellerEvent,
  type SellerEventPrice,
  type SellerEventSchedule,
  type SellerSession,
  type SellerVenue,
} from "./seller-types";

const maxPosterBytes = 5 * 1024 * 1024;

async function sellerRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { credentials: "include", ...options, headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) } });
  const payload: { readonly ok: boolean; readonly data?: T; readonly error?: { readonly message: string } } = await response.json();
  if (!response.ok || !payload.ok || payload.data === undefined) throw new Error(payload.error?.message || `${path} 요청 실패`);
  return payload.data;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("파일을 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

function parseSchedules(text: string): SellerEventSchedule[] {
  return text.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const [label, date, times] = line.split("|");
    return { label: (label || "").trim(), date: (date || "").trim(), times: (times || "").split(",").map((time) => time.trim()).filter(Boolean) };
  });
}

function parsePrices(text: string): SellerEventPrice[] {
  return text.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const [grade, seat, price, seatCount] = line.split(",").map((part) => part.trim());
    return { grade: grade || "", seat: seat || "", price: Number(price), seatCount: seatCount ? Number(seatCount) : 12 };
  });
}

function schedulesToText(schedules: readonly SellerEventSchedule[]): string {
  return schedules.map((schedule) => `${schedule.label}|${schedule.date}|${schedule.times.join(",")}`).join("\n");
}

function pricesToText(prices: readonly SellerEventPrice[]): string {
  return prices.map((price) => [price.grade, price.seat, price.price, price.seatCount ?? 12].join(",")).join("\n");
}

function InlineLoginForm({ onLoggedIn }: { readonly onLoggedIn: (session: SellerSession) => void }) {
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const form = event.currentTarget;
    const username = valueFromForm(form, "username");
    const password = valueFromForm(form, "password");
    if (!username || !password) {
      setError("아이디와 비밀번호를 입력해주세요.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const sessionData = await sellerRequest<SellerSession>("/api/seller/login", { method: "POST", body: JSON.stringify({ username, password }) });
      onLoggedIn(sessionData);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "로그인에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="ticketground-container py-12">
      <div className="mx-auto w-full max-w-md rounded-xl border border-line bg-card p-6 shadow-ticket-2">
        <p className="text-sm font-black text-ticketground">기업 판매자 시스템</p>
        <h1 className="balanced-title mt-2 text-2xl font-black leading-tight text-ink">판매자 로그인</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-3">관리자로부터 발급받은 아이디와 임시 비밀번호로 로그인해 주세요.</p>
        <form className="mt-6 grid gap-3" noValidate onSubmit={submit}>
          <Field label="아이디" name="username" />
          <Field label="비밀번호" name="password" type="password" />
          {error ? <p aria-live="polite" className="text-sm font-bold text-ticketground">{error}</p> : null}
          <button className="mt-2 h-11 rounded-lg bg-ink text-sm font-black text-on-ink disabled:bg-surface-3 disabled:text-ink-4" disabled={submitting} type="submit">
            {submitting ? "로그인 중" : "로그인"}
          </button>
        </form>
        <p className="mt-5 text-center text-sm font-bold text-ink-3">
          아직 등록 신청을 안 하셨나요? <Link className="text-ticketground underline" href="/seller/apply">기업 판매자 등록 신청</Link>
        </p>
      </div>
    </section>
  );
}

function ChangePasswordForm({ onDone }: { readonly onDone: () => void }) {
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const form = event.currentTarget;
    const currentPassword = valueFromForm(form, "currentPassword");
    const nextPassword = valueFromForm(form, "nextPassword");
    if (!currentPassword || !nextPassword) {
      setError("현재 비밀번호와 새 비밀번호를 모두 입력해주세요.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await sellerRequest("/api/seller/change-password", { method: "POST", body: JSON.stringify({ currentPassword, nextPassword }) });
      onDone();
    } catch (changeError) {
      setError(changeError instanceof Error ? changeError.message : "비밀번호 변경에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="ticketground-container py-12">
      <div className="mx-auto w-full max-w-md rounded-xl border border-line bg-card p-6 shadow-ticket-2">
        <p className="text-sm font-black text-ticketground">최초 로그인</p>
        <h1 className="balanced-title mt-2 text-2xl font-black leading-tight text-ink">비밀번호를 변경해주세요</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-3">발급받은 임시 비밀번호는 최초 1회만 사용할 수 있습니다. 새 비밀번호는 12자 이상이어야 합니다.</p>
        <form className="mt-6 grid gap-3" noValidate onSubmit={submit}>
          <Field label="현재(임시) 비밀번호" name="currentPassword" type="password" />
          <Field label="새 비밀번호 (12자 이상)" name="nextPassword" type="password" />
          {error ? <p aria-live="polite" className="text-sm font-bold text-ticketground">{error}</p> : null}
          <button className="mt-2 h-11 rounded-lg bg-ink text-sm font-black text-on-ink disabled:bg-surface-3 disabled:text-ink-4" disabled={submitting} type="submit">
            {submitting ? "변경 중" : "비밀번호 변경"}
          </button>
        </form>
      </div>
    </section>
  );
}

function EventForm({
  event,
  venues,
  csrf,
  feedback,
  onDone,
}: {
  readonly event: SellerEvent | null;
  readonly venues: readonly SellerVenue[];
  readonly csrf: string;
  readonly feedback: Feedback;
  readonly onDone: (feedback: Feedback) => void;
}) {
  const [posterPreview, setPosterPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handlePosterChange = (changeEvent: ChangeEvent<HTMLInputElement>): void => {
    const file = changeEvent.currentTarget.files?.[0];
    if (!file) return;
    if (file.size > maxPosterBytes) {
      onDone({ tone: "error", message: "포스터 파일은 5MB 이하여야 합니다." });
      changeEvent.currentTarget.value = "";
      return;
    }
    void readFileAsDataUrl(file).then(setPosterPreview);
  };

  const submit = async (formEvent: FormEvent<HTMLFormElement>): Promise<void> => {
    formEvent.preventDefault();
    const form = formEvent.currentTarget;
    const title = valueFromForm(form, "title");
    const startsAt = valueFromForm(form, "startsAt");
    const venueId = valueFromForm(form, "venueId");
    const schedules = parseSchedules(valueFromForm(form, "schedules"));
    const prices = parsePrices(valueFromForm(form, "prices"));
    if (!title || !startsAt || !venueId || !schedules.length || !prices.length) {
      onDone({ tone: "error", message: "공연명, 시작 일시, 공연장, 공연 일정, 좌석 가격을 확인해주세요." });
      return;
    }
    if (!event && !posterPreview) {
      onDone({ tone: "error", message: "포스터 이미지를 등록해주세요." });
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        eventId: event?.id,
        title,
        shortTitle: valueFromForm(form, "shortTitle"),
        category: valueFromForm(form, "category"),
        startsAt,
        venueId,
        schedules,
        prices,
        imageDataUrl: posterPreview || undefined,
        casts: valueFromForm(form, "casts").split("\n").map((line) => line.trim()).filter(Boolean),
        notices: valueFromForm(form, "notices").split("\n").map((line) => line.trim()).filter(Boolean),
        summary: valueFromForm(form, "summary"),
      };
      await sellerRequest(event ? "/api/seller/events/update" : "/api/seller/events/create", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "x-tig-seller-csrf": csrf },
      });
      onDone({ tone: "success", message: event ? `${title} 공연을 수정했습니다. 관리자 검토 후 다시 공개됩니다.` : `${title} 공연을 등록했습니다. 관리자 검토 후 공개됩니다.` });
      form.reset();
      setPosterPreview(null);
    } catch (submitError) {
      onDone({ tone: "error", message: submitError instanceof Error ? submitError.message : "요청을 완료하지 못했습니다." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <WorkspacePanel>
      <h2 className="text-base font-black">{event ? `${event.title} 수정` : "신규 공연/티켓 등록"}</h2>
      <p className="mt-1 text-sm font-bold text-ink-3">저장하면 관리자 검토를 거친 뒤 공개 카탈로그에 노출됩니다.</p>
      <form className="mt-4 grid gap-3 md:grid-cols-2" key={event?.id ?? "create"} noValidate onSubmit={submit}>
        <Field defaultValue={event?.title} label="공연명" name="title" required />
        <Field defaultValue={event?.shortTitle} label="짧은 제목 (선택)" name="shortTitle" />
        <SelectField defaultValue={event?.category ?? "concert"} label="장르" name="category" options={sellerEventCategoryOptions} />
        <Field defaultValue={event?.date} label="시작 일시 (예: 2026-12-24T19:30:00+09:00)" name="startsAt" />
        <SelectField defaultValue={event?.venueId} label="공연장" name="venueId" options={[{ label: "공연장을 선택해주세요", value: "" }, ...venues.map((venue) => ({ label: venue.name, value: venue.id }))]} />
        <label className="grid gap-1 text-sm font-bold text-ink-3 md:col-span-2">
          포스터 이미지{event ? " (선택, 비우면 유지)" : ""}
          <input accept="image/jpeg,image/png,image/webp" className="h-10 min-w-0 rounded-lg border border-line bg-background px-3 py-1 text-sm font-bold text-ink file:mr-3 file:rounded-md file:border-0 file:bg-surface file:px-2 file:py-1 file:text-sm file:font-bold" onChange={handlePosterChange} type="file" />
        </label>
        {posterPreview ? <div className="md:col-span-2"><img alt="포스터 미리보기" className="h-48 w-36 rounded-lg border border-line object-cover" src={posterPreview} /></div> : null}
        <div className="md:col-span-2"><TextareaField defaultValue={event ? pricesToText(event.prices) : ""} hint="한 줄에 하나씩: 등급,좌석명,가격,좌석수" label="좌석 가격" name="prices" rows={3} /></div>
        <div className="md:col-span-2"><TextareaField defaultValue={event ? schedulesToText(event.schedules) : ""} hint="한 줄에 하나씩: 회차명|날짜(YYYY-MM-DD)|시간1,시간2" label="공연 일정" name="schedules" rows={3} /></div>
        <div className="md:col-span-2"><TextareaField defaultValue={event?.casts.join("\n")} hint="한 줄에 한 명씩 (선택)" label="출연진" name="casts" rows={2} /></div>
        <div className="md:col-span-2"><TextareaField defaultValue={event?.notices.join("\n")} hint="한 줄에 하나씩 (선택)" label="유의사항" name="notices" rows={2} /></div>
        <div className="md:col-span-2"><TextareaField defaultValue={event?.summary} hint="공연 소개 (선택, 최대 400자)" label="공연 소개" name="summary" rows={3} /></div>
        <button className="h-10 rounded-lg bg-ink px-4 text-sm font-black text-on-ink disabled:bg-surface-3 disabled:text-ink-4 md:col-span-2" disabled={submitting} type="submit">
          {submitting ? "저장 중" : event ? "수정 저장" : "공연/티켓 등록"}
        </button>
      </form>
      <div className="mt-4"><Notice feedback={feedback} /></div>
    </WorkspacePanel>
  );
}

export function SellerDashboard() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SellerSession | null>(null);
  const [events, setEvents] = useState<readonly SellerEvent[]>([]);
  const [venues, setVenues] = useState<readonly SellerVenue[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const loadDashboard = async (): Promise<void> => {
    const [eventsData, catalog] = await Promise.all([
      sellerRequest<readonly SellerEvent[]>("/api/seller/events"),
      fetch("/api/catalog", { cache: "no-store" }).then((response) => response.json()),
    ]);
    setEvents(eventsData);
    setVenues((catalog?.data?.venues ?? []) as readonly SellerVenue[]);
  };

  useEffect(() => {
    (async () => {
      try {
        const sessionData = await sellerRequest<SellerSession>("/api/seller/session");
        setSession(sessionData);
        if (!sessionData.mustChangePassword) await loadDashboard();
      } catch {
        setSession(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleLoggedOut = (): void => {
    setSession(null);
    setEvents([]);
  };

  if (loading) {
    return (
      <>
        <SellerSiteHeader onLoggedOut={handleLoggedOut} session={null} />
        <main className="grid min-h-[60vh] place-items-center text-sm font-black text-ink-3">확인하는 중입니다.</main>
      </>
    );
  }

  if (!session) {
    return (
      <>
        <SellerSiteHeader onLoggedOut={handleLoggedOut} session={null} />
        <InlineLoginForm
          onLoggedIn={(nextSession) => {
            setSession(nextSession);
            if (!nextSession.mustChangePassword) void loadDashboard();
          }}
        />
      </>
    );
  }

  if (session.mustChangePassword) {
    return (
      <>
        <SellerSiteHeader onLoggedOut={handleLoggedOut} session={session} />
        <ChangePasswordForm onDone={() => { setSession(null); }} />
      </>
    );
  }

  const selectedEvent = events.find((item) => item.id === selectedId) || null;

  return (
    <>
    <SellerSiteHeader onLoggedOut={handleLoggedOut} session={session} />
    <section className="ticketground-container py-8">
      <div className="flex flex-col gap-2 border-b border-line pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black text-ticketground">기업 판매자</p>
          <h1 className="text-xl font-black text-ink">{session.organizationName} 대시보드</h1>
        </div>
        <p className="text-sm font-bold text-ink-3">{session.username}로 로그인됨</p>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(240px,320px)_minmax(0,1fr)]">
        <div className="grid content-start gap-2">
          <button className={`rounded-lg border p-3 text-left text-sm font-black ${selectedId === null ? "border-ink bg-surface" : "border-line bg-background"}`} onClick={() => setSelectedId(null)} type="button">
            + 신규 공연 등록
          </button>
          {events.map((item) => (
            <button className={`rounded-lg border p-3 text-left ${selectedId === item.id ? "border-ink bg-surface" : "border-line bg-background"}`} key={item.id} onClick={() => setSelectedId(item.id)} type="button">
              <span className="block text-sm font-black text-ink">{item.title}</span>
              <span className="mt-1 block text-xs font-bold text-ink-3">{sellerPublishStatusLabels[item.publishStatus]} · 판매 {money(item.soldCount)}/{money(item.ticketCount)}</span>
            </button>
          ))}
          {events.length ? null : <p className="rounded-lg border border-line p-3 text-sm font-bold text-ink-3">등록한 공연이 없습니다.</p>}
        </div>
        <EventForm
          csrf={session.csrf}
          event={selectedEvent}
          feedback={feedback}
          onDone={(next) => {
            setFeedback(next);
            void loadDashboard();
          }}
          venues={venues}
        />
      </div>
    </section>
    </>
  );
}
