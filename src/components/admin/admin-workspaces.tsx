import { CalendarPlus, CheckCircle2, Ticket, UsersRound } from "lucide-react";
import Link from "next/link";
import type { ChangeEvent, FormEvent } from "react";
import { useState } from "react";
import { apiRequest } from "./admin-console";
import {
  Field,
  hasEvents,
  hasGroupBookingRequests,
  hasSellerApplications,
  hasSellerEvents,
  hasTickets,
  hasUsers,
  money,
  Notice,
  SelectField,
  Stat,
  TextareaField,
  valueFromForm,
  valuesFromForm,
  WorkspacePanel,
} from "./console-primitives";
import {
  groupBookingStatuses,
  saleStates,
  sellerApplicationStatuses,
  userStatuses,
  type AccountsWorkspace,
  type AclWorkspaceData,
  type AdminAccount,
  type AdmissionWorkspace,
  type AdminEvent,
  type AdminEventSummary,
  type AdminSession,
  type AuditWorkspace,
  type CatalogWorkspace,
  type Feedback,
  type FinanceWorkspace,
  type GroupBookingWorkspace,
  type InventoryWorkspace,
  type Mutation,
  type OverviewWorkspace,
  type ResaleWorkspace,
  type SellerAccount,
  type SellerApplicationsWorkspace,
  type SellerEventsWorkspace,
  type WorkspaceData,
} from "./console-types";
import { operatorLabel } from "./console-types";
import type { WorkspaceKey } from "./console-workspaces";
import { MobileAdminWorkspace } from "./mobile-admin-workspace";

type WorkspaceProps = {
  readonly workspace: WorkspaceKey;
  readonly data: WorkspaceData | null;
  readonly feedback: Feedback;
  readonly mutate: Mutation;
  readonly session: AdminSession;
  readonly onAuditFilterChange: (filters: { readonly action?: string; readonly actorId?: string; readonly from?: string; readonly to?: string; readonly page?: number }) => void;
  readonly onAccountFilterChange: (filters: { readonly search?: string }) => void;
  readonly onFinanceFilterChange: (filters: { readonly eventId?: string; readonly from?: string; readonly method?: string; readonly status?: string; readonly to?: string; readonly page?: number }) => void;
  readonly onInventoryFilterChange: (filters: { readonly eventId?: string; readonly performanceDateId?: string; readonly zoneId?: string; readonly page?: number }) => void;
  readonly onSelectEvent: (eventId: string) => void;
  readonly onSellerApplicationFilterChange: (filters: { readonly status?: string; readonly page?: number }) => void;
  readonly onGroupBookingFilterChange: (filters: { readonly status?: string; readonly page?: number }) => void;
  readonly onLocalError: (message: string) => void;
};

function focusInput(form: HTMLFormElement, name: string): void {
  const field = form.elements.namedItem(name);
  if (field instanceof HTMLInputElement) field.focus();
}

export function WorkspaceContent(props: WorkspaceProps) {
  const { workspace, data, feedback, mutate, session, onAccountFilterChange, onAuditFilterChange, onFinanceFilterChange, onGroupBookingFilterChange, onInventoryFilterChange, onLocalError, onSelectEvent, onSellerApplicationFilterChange } = props;
  if (!data) return <WorkspacePanel><p aria-live="polite" className="text-sm font-bold text-ticketground">작업공간 데이터를 불러오지 못했습니다.</p></WorkspacePanel>;
  if (workspace === "overview" && "stats" in data) return <OverviewWorkspace data={data} />;
  if (workspace === "catalog" && hasEvents(data)) return <CatalogWorkspace data={data} feedback={feedback} mutate={mutate} onLocalError={onLocalError} />;
  if (workspace === "sales" && hasEvents(data)) return <SalesWorkspace data={data} feedback={feedback} key={data.events[0]?.id} mutate={mutate} onLocalError={onLocalError} onSelectEvent={onSelectEvent} />;
  if (workspace === "inventory" && hasTickets(data)) return <InventoryWorkspace data={data} feedback={feedback} mutate={mutate} onInventoryFilterChange={onInventoryFilterChange} />;
  if (workspace === "accounts" && hasUsers(data)) return <AccountsWorkspace data={data} feedback={feedback} mutate={mutate} onAccountFilterChange={onAccountFilterChange} />;
  if (workspace === "finance" && "transactions" in data) return <FinanceWorkspace data={data} onFinanceFilterChange={onFinanceFilterChange} />;
  if (workspace === "resale" && "resalePools" in data) return <ResaleWorkspace data={data} feedback={feedback} mutate={mutate} onLocalError={onLocalError} />;
  if (workspace === "admission" && "admissionCredentials" in data) return <AdmissionWorkspace data={data} feedback={feedback} mutate={mutate} onLocalError={onLocalError} />;
  if (workspace === "mobile" && "releasePolicies" in data) return <MobileAdminWorkspace data={data} feedback={feedback} mutate={mutate} session={session} />;
  if (workspace === "audit" && "ledger" in data) return <AuditWorkspace data={data} onAuditFilterChange={onAuditFilterChange} />;
  if (workspace === "acl" && "adminAccounts" in data) return <AclWorkspace data={data} feedback={feedback} mutate={mutate} onLocalError={onLocalError} session={session} />;
  if (workspace === "group-booking" && hasGroupBookingRequests(data)) return <GroupBookingWorkspace data={data} feedback={feedback} mutate={mutate} onGroupBookingFilterChange={onGroupBookingFilterChange} onLocalError={onLocalError} />;
  if (workspace === "seller-applications" && hasSellerApplications(data)) return <SellerApplicationsWorkspace data={data} feedback={feedback} mutate={mutate} onLocalError={onLocalError} onSellerApplicationFilterChange={onSellerApplicationFilterChange} session={session} />;
  if (workspace === "seller-events" && hasSellerEvents(data)) return <SellerEventsWorkspace data={data} feedback={feedback} mutate={mutate} onLocalError={onLocalError} />;
  return <WorkspacePanel><p aria-live="polite" className="text-sm font-bold text-ticketground">작업공간 데이터를 표시할 수 없습니다.</p></WorkspacePanel>;
}

function OverviewWorkspace({ data }: { readonly data: OverviewWorkspace }) {
  return <WorkspacePanel><div className="grid divide-y divide-line overflow-hidden sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4"><Stat label="전체 티켓" value={money(data.stats.totalTickets)} /><Stat label="판매 가능" value={money(data.stats.onSaleTickets)} /><Stat label="감사 원장" tone={data.stats.ledgerVerified ? "ok" : "warn"} value={data.stats.ledgerVerified ? "정상" : "불일치"} /><Stat label="오늘 결제" value={`${money(data.stats.todayPaymentCount)}건`} /><Stat label="오늘 결제액" value={`${money(data.stats.todayPaymentAmount)}원`} /><Stat label="누적 수수료" value={`${money(data.stats.totalPaymentFees)}원`} /><Stat label="판매자 정산" value={`${money(data.stats.totalSettlements)}원`} /></div></WorkspacePanel>;
}

type MutableWorkspaceProps = { readonly feedback: Feedback; readonly mutate: Mutation; readonly onLocalError?: (message: string) => void };

const maxPosterBytes = 5 * 1024 * 1024;

function readFileAsDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("포스터 파일을 읽지 못했습니다.")));
    reader.addEventListener("error", () => reject(new Error("포스터 파일을 읽지 못했습니다.")));
    reader.readAsDataURL(file);
  });
}

function dataUrlByteLength(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return Math.ceil((base64.length * 3) / 4);
}

// Large real-world poster photos routinely exceed 5MB; instead of rejecting
// them outright, downscale to a reasonable poster size and re-encode as JPEG.
async function shrinkImage(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.addEventListener("load", () => resolve());
      image.addEventListener("error", () => reject(new Error("포스터 파일을 읽지 못했습니다.")));
      image.src = objectUrl;
    });
    const maxEdge = 1600;
    const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("포스터 파일을 처리하지 못했습니다.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.82, 0.7, 0.55, 0.4]) {
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      if (dataUrlByteLength(dataUrl) <= maxPosterBytes) return dataUrl;
    }
    throw new Error("포스터 파일 용량을 5MB 이하로 줄이지 못했습니다. 더 작은 이미지를 사용해주세요.");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function readImageFile(file: File): Promise<string> {
  if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(file.type)) throw new Error("포스터는 PNG, JPEG, WebP 파일만 등록할 수 있습니다.");
  if (file.size <= maxPosterBytes) return readFileAsDataUrl(file);
  return shrinkImage(file);
}

function readPoster(form: HTMLFormElement): Promise<string> {
  const field = form.elements.namedItem("poster");
  if (!(field instanceof HTMLInputElement) || !field.files?.[0]) return Promise.reject(new Error("공연 포스터 이미지를 선택해주세요."));
  return readImageFile(field.files[0]);
}

function readOptionalPoster(form: HTMLFormElement): Promise<string | null> {
  const field = form.elements.namedItem("poster");
  if (!(field instanceof HTMLInputElement) || !field.files?.[0]) return Promise.resolve(null);
  return readImageFile(field.files[0]);
}

function ipAllowlistFromForm(form: HTMLFormElement): string[] {
  return valueFromForm(form, "ipAllowlist").split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
}

const eventCategoryOptions = ["musical", "concert", "theater", "classic", "sports", "exhibition", "children"].map((value) => ({ label: operatorLabel(value), value }));

function linesFromForm(form: HTMLFormElement, name: string): string[] {
  return valueFromForm(form, name).split("\n").map((item) => item.trim()).filter(Boolean);
}

function pinnedRankFromForm(form: HTMLFormElement): number | null {
  const raw = valueFromForm(form, "pinnedRank");
  return raw ? Number(raw) : null;
}

function pricesFromForm(form: HTMLFormElement): { grade: string; seat: string; price: number; seatCount: number }[] {
  return linesFromForm(form, "prices").map((line) => {
    const [grade, seat, price, seatCount] = line.split(",").map((part) => part.trim());
    return { grade: grade || "", seat: seat || grade || "", price: Number(price) || 0, seatCount: Number(seatCount) || 12 };
  });
}

function schedulesFromForm(form: HTMLFormElement): { label: string; date: string; times: string[] }[] {
  return linesFromForm(form, "schedules").map((line) => {
    const [label, date, times] = line.split("|").map((part) => part.trim());
    return {
      label: label || "",
      date: date || "",
      times: (times || "").split(",").map((time) => time.trim()).filter(Boolean),
    };
  });
}

function CatalogWorkspace({ data, feedback, mutate, onLocalError }: { readonly data: CatalogWorkspace } & MutableWorkspaceProps) {
  const prefill = data.sellerApplicationPrefill;
  const [posterPreview, setPosterPreview] = useState<string | null>(null);
  const handlePosterChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.currentTarget.files?.[0];
    if (!file) {
      setPosterPreview(null);
      return;
    }
    readImageFile(file)
      .then(setPosterPreview)
      .catch((error: unknown) => {
        setPosterPreview(null);
        onLocalError?.(error instanceof Error ? error.message : "포스터 이미지를 확인해주세요.");
      });
  };
  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const form = event.currentTarget;
    const title = valueFromForm(form, "title");
    if (!title) {
      onLocalError?.("공연명을 입력해주세요.");
      focusInput(form, "title");
      return;
    }
    const venueId = valueFromForm(form, "venueId");
    if (!venueId) {
      onLocalError?.("공연장을 선택해주세요.");
      focusInput(form, "venueId");
      return;
    }
    let imageDataUrl: string;
    try {
      imageDataUrl = await readPoster(form);
    } catch (error) {
      onLocalError?.(error instanceof Error ? error.message : "포스터 이미지를 확인해주세요.");
      return;
    }
    if (!window.confirm(`${title} 공연/티켓을 등록하시겠습니까?`)) return;
    await mutate("/api/admin/events/create", {
      title,
      category: valueFromForm(form, "category"),
      startsAt: valueFromForm(form, "startsAt"),
      venueId: valueFromForm(form, "venueId"),
      saleState: valueFromForm(form, "saleState"),
      saleNote: valueFromForm(form, "saleNote"),
      checkoutNotice: valueFromForm(form, "checkoutNotice") || undefined,
      shortTitle: valueFromForm(form, "shortTitle") || undefined,
      period: valueFromForm(form, "period") || undefined,
      runtime: valueFromForm(form, "runtime") || undefined,
      ageLimit: valueFromForm(form, "ageLimit") || undefined,
      badge: valueFromForm(form, "badge") || undefined,
      artistSlug: valueFromForm(form, "artistSlug") || undefined,
      slug: valueFromForm(form, "slug") || undefined,
      summary: valueFromForm(form, "summary") || undefined,
      prices: pricesFromForm(form),
      schedules: schedulesFromForm(form),
      casts: linesFromForm(form, "casts"),
      notices: linesFromForm(form, "notices"),
      sourceApplicationId: prefill?.applicationId,
      pinnedRank: pinnedRankFromForm(form),
      imageDataUrl,
    }, "신규 공연과 티켓이 생성되었습니다.");
  };
  const pricesDefault = prefill?.seatGrades.length
    ? prefill.seatGrades.map((grade) => `${grade.gradeName},${grade.gradeName},${grade.price},${grade.quantity}`).join("\n")
    : "VIP,VIP석,154000\nR,R석,121000\nS,S석,99000";
  const schedulesDefault = prefill?.sessions.length
    ? prefill.sessions.map((session, index) => `${session.label || `${index + 1}회차`}|${session.date}|${session.times.join(",")}`).join("\n")
    : "1회차|2026-12-24|19:30";
  return <WorkspacePanel>{prefill ? <div className="mb-4 rounded-lg border border-ticketground bg-surface p-4"><p className="text-sm font-black text-ink">기업 판매자 신청서에서 넘어온 등록입니다</p><p className="mt-1 text-xs font-bold text-ink-3">아래 값은 신청서 내용으로 미리 채워졌습니다. 제안 공연장 &ldquo;{prefill.venueName}&rdquo;과 실제 공연장 목록이 다를 수 있으니 공연장은 직접 선택하고, 포스터도 제안 이미지를 참고해 다시 첨부해주세요.</p><div className="mt-3 flex items-center gap-3"><img alt="신청서 제안 포스터" className="h-24 w-16 rounded-lg border border-line object-cover" src={prefill.posterImageDataUrl} /><Link className="text-xs font-black text-ticketground underline" href="/console/seller-applications">신청서 상세로 돌아가기</Link></div></div> : null}<div className="flex items-center gap-2 border-b border-line pb-3"><CalendarPlus size={18} /><h2 className="text-base font-black">신규 공연/티켓 추가</h2></div><form className="mt-4 grid gap-3 md:grid-cols-2" noValidate onSubmit={submit}><Field defaultValue={prefill?.title} label="공연명" name="title" required /><Field label="짧은 제목 (선택)" name="shortTitle" /><SelectField label="카테고리" name="category" defaultValue={prefill?.category ?? "concert"} options={eventCategoryOptions} /><Field label="시작 일시" name="startsAt" defaultValue="2026-12-24T19:30:00+09:00" /><SelectField label="공연장" name="venueId" defaultValue={prefill ? "" : data.events[0]?.venueId} options={prefill ? [{ label: "공연장을 선택해주세요", value: "" }, ...data.venues.map((venue) => ({ label: venue.name, value: venue.id }))] : data.venues.map((venue) => ({ label: venue.name, value: venue.id }))} /><SelectField label="초기 판매 상태" name="saleState" defaultValue="OPEN_SOON" options={saleStates.map((value) => ({ label: operatorLabel(value), value }))} /><Field label="운영 메모" name="saleNote" defaultValue="관리자 초안" /><Field defaultValue={prefill?.period} label="공연 기간 (선택)" name="period" placeholder="2026.12.24 ~ 2026.12.31" /><Field label="러닝타임 (선택)" name="runtime" placeholder="170분(인터미션 20분 포함)" /><Field label="관람 연령 (선택)" name="ageLimit" placeholder="전체 관람" /><Field label="배지 문구 (선택)" name="badge" placeholder="관리자 등록" /><Field label="아티스트 슬러그 (선택)" name="artistSlug" /><Field label="공연 슬러그 (선택, 영문/숫자/하이픈)" name="slug" /><Field label="고정 랭킹 1~10 (선택)" name="pinnedRank" type="number" /><label className="grid gap-1 text-sm font-bold text-ink-3 md:col-span-2">포스터 이미지<input accept="image/jpeg,image/png,image/webp" className="h-10 min-w-0 rounded-lg border border-line bg-background px-3 py-1 text-sm font-bold text-ink file:mr-3 file:rounded-md file:border-0 file:bg-surface file:px-2 file:py-1 file:text-sm file:font-bold" name="poster" onChange={handlePosterChange} required type="file" /></label>{posterPreview && <div className="md:col-span-2"><img alt="포스터 미리보기" className="h-48 w-36 rounded-lg border border-line object-cover" src={posterPreview} /></div>}<p className="-mt-1 text-xs font-bold text-ink-3 md:col-span-2">PNG, JPEG, WebP · 최대 5MB · 등록 후 공개 웹 공연 카드와 상세 페이지에 표시됩니다.</p><div className="md:col-span-2"><TextareaField defaultValue={pricesDefault} hint="한 줄에 하나씩: 등급,좌석명,가격" label="좌석 가격" name="prices" rows={3} /></div><div className="md:col-span-2"><TextareaField defaultValue={schedulesDefault} hint="한 줄에 하나씩: 회차명|날짜(YYYY-MM-DD)|시간1,시간2" label="공연 일정" name="schedules" rows={3} /></div><div className="md:col-span-2"><TextareaField defaultValue={prefill?.castNotes} hint="한 줄에 한 명씩 (선택)" label="출연진" name="casts" rows={3} /></div><div className="md:col-span-2"><TextareaField defaultValue={prefill?.noticesDraft} hint="한 줄에 하나씩 (선택)" label="유의사항" name="notices" rows={3} /></div><div className="md:col-span-2"><TextareaField defaultValue={prefill?.summary} hint="공연 소개 (선택, 최대 400자)" label="공연 소개" name="summary" rows={3} /></div><button className="h-10 rounded-lg bg-ink px-4 text-sm font-black text-on-ink md:col-span-2" type="submit">공연/티켓 생성</button></form><div className="mt-4"><Notice feedback={feedback} /></div></WorkspacePanel>;
}

function dateFromEvent(event: AdminEvent): string {
  return event.schedules?.[0]?.date.replaceAll(".", "-") ?? event.date.slice(0, 10);
}

function timeFromEvent(event: AdminEvent): string {
  return event.schedules?.[0]?.times[0] ?? (event.date.slice(11, 16) || "19:30");
}

function scheduleText(event: AdminEvent): string {
  if (event.schedules?.length) {
    return event.schedules.map((schedule) => `${schedule.label}|${schedule.date.replaceAll(".", "-")}|${schedule.times.join(",")}`).join("\n");
  }
  return `1회차|${dateFromEvent(event)}|${timeFromEvent(event)}`;
}

function EventPicker({
  currentEventId,
  eventSummaries,
  onSelectEvent,
}: {
  readonly currentEventId: string;
  readonly eventSummaries: readonly AdminEventSummary[];
  readonly onSelectEvent: (eventId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();
  const visibleEvents = normalized
    ? eventSummaries.filter((event) => event.title.toLowerCase().includes(normalized))
    : eventSummaries;

  return (
    <section className="rounded-lg border border-line bg-background p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <label className="grid gap-1 text-sm font-bold text-ink-3 md:min-w-[280px]">
          공연 검색
          <input
            className="h-10 rounded-lg border border-line bg-background px-3 text-sm font-bold text-ink"
            name="eventSearch"
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="공연명으로 검색"
            type="search"
            value={query}
          />
        </label>
        <p className="text-sm font-bold text-ink-3">전체 {eventSummaries.length}개 · 표시 {visibleEvents.length}개</p>
      </div>
      <div className="mt-3 grid max-h-72 gap-2 overflow-y-auto pr-1">
        {visibleEvents.map((event) => {
          const active = event.id === currentEventId;
          return (
            <button
              aria-pressed={active}
              className={`grid gap-1 rounded-lg border px-3 py-3 text-left transition-colors ${active ? "border-ink bg-ink text-on-ink" : "border-line bg-card text-ink hover:border-line-strong"}`}
              key={event.id}
              onClick={() => onSelectEvent(event.id)}
              type="button"
            >
              <span className="text-sm font-black">{event.title}</span>
              <span className={`text-xs font-bold ${active ? "text-on-ink/75" : "text-ink-3"}`}>
                {operatorLabel(event.category)} · {operatorLabel(event.saleState)} · {event.venue} · {event.ticketCount.toLocaleString("ko-KR")}석 / 판매 {event.soldCount.toLocaleString("ko-KR")}석
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function SalesWorkspace({ data, feedback, mutate, onLocalError, onSelectEvent }: { readonly data: CatalogWorkspace; readonly onSelectEvent: (eventId: string) => void } & MutableWorkspaceProps) {
  const event = data.events[0];
  const [posterPreview, setPosterPreview] = useState<string | null>(null);
  if (!event) return <WorkspacePanel><p className="text-sm font-bold text-ink-3">판매 설정할 공연이 없습니다.</p></WorkspacePanel>;
  const summaries = data.eventSummaries ?? data.events.map((item) => ({
    id: item.id,
    title: item.title,
    category: item.category,
    saleState: item.saleState,
    venue: item.venue,
    date: item.date,
    ticketCount: 0,
    soldCount: 0,
  }));
  const handlePosterChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.currentTarget.files?.[0];
    if (!file) {
      setPosterPreview(null);
      return;
    }
    readImageFile(file)
      .then(setPosterPreview)
      .catch((error: unknown) => {
        setPosterPreview(null);
        onLocalError?.(error instanceof Error ? error.message : "포스터 이미지를 확인해주세요.");
      });
  };
  const submit = (submission: FormEvent<HTMLFormElement>): void => {
    submission.preventDefault();
    const form = submission.currentTarget;
    const title = valueFromForm(form, "title");
    if (!title) {
      onLocalError?.("공연명을 입력해주세요.");
      focusInput(form, "title");
      return;
    }
    if (!window.confirm(`${title} 판매 설정을 저장하시겠습니까?`)) return;
    const prices = Object.fromEntries(event.zones.map((zone) => [zone.id, Number(valueFromForm(form, `${zone.id}:price`))]));
    const seatCounts = Object.fromEntries(event.zones.map((zone) => [zone.id, Number(valueFromForm(form, `${zone.id}:seatCount`))]));
    void (async () => {
      let imageDataUrl: string | null;
      try {
        imageDataUrl = await readOptionalPoster(form);
      } catch (error) {
        onLocalError?.(error instanceof Error ? error.message : "포스터 이미지를 확인해주세요.");
        return;
      }
      await mutate("/api/admin/events/sale", {
        eventId: event.id,
        title,
        category: valueFromForm(form, "category"),
        startsAt: valueFromForm(form, "startsAt"),
        venueId: valueFromForm(form, "venueId"),
        saleState: valueFromForm(form, "saleState"),
        saleNote: valueFromForm(form, "saleNote"),
        checkoutNotice: valueFromForm(form, "checkoutNotice"),
        discountRate: Number(valueFromForm(form, "discountRate")),
        badge: valueFromForm(form, "badge"),
        pinnedRank: pinnedRankFromForm(form),
        prices,
        seatCounts,
        schedules: schedulesFromForm(form),
        ...(imageDataUrl ? { imageDataUrl } : {}),
      }, "판매 설정이 갱신되었습니다.");
    })();
  };
  return <WorkspacePanel><div className="flex items-center gap-2 border-b border-line pb-3"><Ticket size={18} /><h2 className="text-base font-black">공연 판매 설정</h2></div><div className="mt-4"><EventPicker currentEventId={event.id} eventSummaries={summaries} onSelectEvent={onSelectEvent} /></div><form className="mt-4 grid gap-3 lg:grid-cols-3" noValidate onSubmit={submit}><Field label="공연명" name="title" defaultValue={event.title} required /><SelectField label="카테고리" name="category" defaultValue={event.category} options={eventCategoryOptions} /><SelectField label="판매 상태" name="saleState" defaultValue={event.saleState} options={saleStates.map((value) => ({ label: operatorLabel(value), value }))} /><Field label="시작 일시" name="startsAt" defaultValue={event.date} /><SelectField label="공연장" name="venueId" defaultValue={event.venueId} options={data.venues.map((venue) => ({ label: venue.name, value: venue.id }))} /><Field label="할인율" name="discountRate" defaultValue={event.discountRate || 0} type="number" /><Field label="운영 메모" name="saleNote" defaultValue={event.saleNote || ""} /><Field label="배지 문구 (선택, 비우면 배지 없음)" name="badge" defaultValue={event.badge || ""} placeholder="단독판매" /><div className="lg:col-span-3"><Field label="예매 안내 문구 (사용자 페이지 예매 패널에 그대로 노출, 비우면 기본 문구)" name="checkoutNotice" defaultValue={event.checkoutNotice || ""} placeholder="티켓 예매 및 결제 전 포트원 다날 휴대폰 본인인증이 필요합니다." /></div><Field label="고정 랭킹 1~10 (선택, 비우면 자동 랭킹)" name="pinnedRank" defaultValue={event.pinnedRank ?? undefined} type="number" /><label className="grid gap-1 text-sm font-bold text-ink-3 lg:col-span-3">포스터 교체<input accept="image/jpeg,image/png,image/webp" className="h-10 min-w-0 rounded-lg border border-line bg-background px-3 py-1 text-sm font-bold text-ink file:mr-3 file:rounded-md file:border-0 file:bg-surface file:px-2 file:py-1 file:text-sm file:font-bold" name="poster" onChange={handlePosterChange} type="file" /></label>{posterPreview ? <div className="lg:col-span-3"><img alt="교체 포스터 미리보기" className="h-48 w-36 rounded-lg border border-line object-cover" src={posterPreview} /></div> : null}<div className="lg:col-span-3"><TextareaField defaultValue={scheduleText(event)} hint="한 줄에 하나씩: 회차명|날짜(YYYY-MM-DD)|시간1,시간2" label="공연 일정" name="schedules" rows={Math.max(3, event.schedules?.length ?? 1)} /></div>{event.zones.map((zone) => <div className="grid gap-3 rounded-lg border border-line p-3 md:grid-cols-2" key={zone.id}><Field defaultValue={zone.faceValue} label={`${zone.name} 가격`} name={`${zone.id}:price`} type="number" /><Field defaultValue={zone.seatCount ?? 12} label={`${zone.name} 판매 좌석 수`} name={`${zone.id}:seatCount`} type="number" /></div>)}<button className="h-10 rounded-lg bg-ticketground px-4 text-sm font-black text-on-ink lg:col-span-3" type="submit">판매 설정 저장</button></form><div className="mt-4"><Notice feedback={feedback} /></div></WorkspacePanel>;
}

function InventoryWorkspace({
  data,
  feedback,
  mutate,
  onInventoryFilterChange,
}: {
  readonly data: InventoryWorkspace;
  readonly onInventoryFilterChange: (filters: { readonly eventId?: string; readonly performanceDateId?: string; readonly zoneId?: string; readonly page?: number }) => void;
} & MutableWorkspaceProps) {
  const [selectedTicketIds, setSelectedTicketIds] = useState<readonly string[]>([]);
  const event = data.events[0];
  const pageLabel = `${data.page.total.toLocaleString("ko-KR")}건 중 ${data.tickets.length.toLocaleString("ko-KR")}건 표시`;
  const selectedCount = selectedTicketIds.filter((ticketId) => data.tickets.some((ticket) => ticket.id === ticketId)).length;
  const updateFilters = (filters: { readonly eventId?: string; readonly performanceDateId?: string; readonly zoneId?: string; readonly page?: number }): void => {
    setSelectedTicketIds([]);
    onInventoryFilterChange(filters);
  };
  const bulkUpdate = (status: string): void => {
    const visibleSelection = selectedTicketIds.filter((ticketId) => data.tickets.some((ticket) => ticket.id === ticketId));
    if (!visibleSelection.length) return;
    if (!window.confirm(`선택한 티켓 ${visibleSelection.length.toLocaleString("ko-KR")}개를 ${operatorLabel(status)} 상태로 변경하시겠습니까?`)) return;
    void mutate("/api/admin/tickets/statuses", {
      updates: visibleSelection.map((ticketId) => ({ ticketId, status })),
    }, `${visibleSelection.length.toLocaleString("ko-KR")}개 티켓 상태가 갱신되었습니다.`).then((ok) => {
      if (ok) setSelectedTicketIds([]);
    });
  };
  const toggleTicket = (ticketId: string): void => {
    setSelectedTicketIds((current) => current.includes(ticketId) ? current.filter((item) => item !== ticketId) : [...current, ticketId]);
  };
  const currentFilters = {
    eventId: data.filters.eventId || undefined,
    performanceDateId: data.filters.performanceDateId || undefined,
    zoneId: data.filters.zoneId || undefined,
  };

  return (
    <WorkspacePanel>
      <div className="flex flex-col gap-3 border-b border-line pb-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-base font-black">티켓 재고 상태</h2>
          <p className="mt-1 text-sm font-bold text-ink-3">{pageLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="h-9 rounded-lg bg-ink px-3 text-sm font-black text-on-ink disabled:bg-surface disabled:text-ink-3" disabled={!selectedCount} onClick={() => bulkUpdate("ADMIN_HOLD")} type="button">선택 보류</button>
          <button className="h-9 rounded-lg border border-line bg-background px-3 text-sm font-black text-ink disabled:bg-surface disabled:text-ink-3" disabled={!selectedCount} onClick={() => bulkUpdate("ON_SALE")} type="button">선택 해제</button>
        </div>
      </div>
      <form
        className="mt-4 grid gap-3 lg:grid-cols-4"
        onSubmit={(submission) => {
          submission.preventDefault();
          const form = submission.currentTarget;
          updateFilters({
            eventId: valueFromForm(form, "eventId"),
            performanceDateId: valueFromForm(form, "performanceDateId") || undefined,
            zoneId: valueFromForm(form, "zoneId") || undefined,
            page: 1,
          });
        }}
      >
        <SelectField label="공연" name="eventId" defaultValue={data.filters.eventId ?? undefined} options={data.eventSummaries.map((summary) => ({ label: summary.title, value: summary.id }))} />
        <SelectField label="회차" name="performanceDateId" defaultValue={data.filters.performanceDateId ?? ""} options={[{ label: "전체 회차", value: "" }, ...(event?.dates ?? []).map((date) => ({ label: `${date.label} · ${date.startsAt.slice(0, 16).replace("T", " ")}`, value: date.id }))]} />
        <SelectField label="구역" name="zoneId" defaultValue={data.filters.zoneId ?? ""} options={[{ label: "전체 구역", value: "" }, ...(event?.zones ?? []).map((zone) => ({ label: zone.name, value: zone.id }))]} />
        <button className="h-10 self-end rounded-lg bg-ticketground px-4 text-sm font-black text-on-ink" type="submit">필터 적용</button>
      </form>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {data.zoneSummary.map((zone) => (
          <div className="rounded-lg border border-line bg-background p-3" key={zone.zoneId}>
            <p className="text-sm font-black text-ink">{zone.zoneName}</p>
            <p className="mt-1 text-xs font-bold text-ink-3">판매 가능 {zone.availableCount.toLocaleString("ko-KR")} · 판매/거래 {zone.soldCount.toLocaleString("ko-KR")} · 보류 {zone.heldCount.toLocaleString("ko-KR")}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-2 md:hidden">
        {data.tickets.map((ticket) => (
          <label className="grid gap-2 rounded-lg border border-line p-3 text-sm font-bold text-ink" key={ticket.id}>
            <span className="flex items-center justify-between gap-3">
              <span>{ticket.seatLabel}</span>
              <input checked={selectedTicketIds.includes(ticket.id)} onChange={() => toggleTicket(ticket.id)} type="checkbox" />
            </span>
            <span className="text-xs text-ink-3">{operatorLabel(ticket.status)} · {money(ticket.faceValue)}원 · {ticket.id}</span>
          </label>
        ))}
      </div>
      <div className="mt-4 hidden overflow-hidden rounded-lg border border-line md:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="border-b border-line bg-surface text-xs font-black text-ink-3">
            <tr>
              <th className="w-12 p-3">선택</th>
              <th className="p-3">좌석</th>
              <th className="p-3">상태</th>
              <th className="p-3">가격</th>
              <th className="p-3">티켓 ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data.tickets.map((ticket) => (
              <tr key={ticket.id}>
                <td className="p-3"><input aria-label={`${ticket.seatLabel} 선택`} checked={selectedTicketIds.includes(ticket.id)} onChange={() => toggleTicket(ticket.id)} type="checkbox" /></td>
                <td className="p-3 font-black text-ink">{ticket.seatLabel}</td>
                <td className="p-3 font-bold text-ink-3">{operatorLabel(ticket.status)}</td>
                <td className="p-3 font-bold text-ink-3">{money(ticket.faceValue)}원</td>
                <td className="p-3 font-mono text-xs text-ink-3">{ticket.id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.tickets.length ? null : <p className="mt-4 rounded-lg border border-line p-3 text-sm font-bold text-ink-3">조건에 맞는 티켓이 없습니다.</p>}
      <div className="mt-4 flex flex-col gap-3 border-t border-line pt-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-bold text-ink-3">선택 {selectedCount.toLocaleString("ko-KR")}개 · {data.page.page.toLocaleString("ko-KR")}페이지</p>
        <div className="flex gap-2">
          <button className="h-9 rounded-lg border border-line bg-background px-3 text-sm font-black disabled:bg-surface disabled:text-ink-3" disabled={!data.page.hasPrevious} onClick={() => updateFilters({ ...currentFilters, page: Math.max(1, data.page.page - 1) })} type="button">이전</button>
          <button className="h-9 rounded-lg border border-line bg-background px-3 text-sm font-black disabled:bg-surface disabled:text-ink-3" disabled={!data.page.hasNext} onClick={() => updateFilters({ ...currentFilters, page: data.page.page + 1 })} type="button">다음</button>
        </div>
      </div>
      <div className="mt-4"><Notice feedback={feedback} /></div>
    </WorkspacePanel>
  );
}

function AccountsWorkspace({
  data,
  feedback,
  mutate,
  onAccountFilterChange,
}: { readonly data: AccountsWorkspace; readonly onAccountFilterChange: (filters: { readonly search?: string }) => void } & MutableWorkspaceProps) {
  const [selectedUserId, setSelectedUserId] = useState(data.users[0]?.id ?? "");
  const [selectedBulkIds, setSelectedBulkIds] = useState<string[]>([]);
  const [pendingSingle, setPendingSingle] = useState<{ readonly userId: string; readonly status: string; readonly reason: string } | null>(null);
  const selectedUser = data.users.find((user) => user.id === selectedUserId) ?? data.users[0] ?? null;
  const toggleBulk = (userId: string): void => setSelectedBulkIds((current) => current.includes(userId) ? current.filter((idValue) => idValue !== userId) : [...current, userId]);
  const submitSingle = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!selectedUser) return;
    const form = event.currentTarget;
    setPendingSingle({
      userId: selectedUser.id,
      status: valueFromForm(form, "status"),
      reason: valueFromForm(form, "reason") || "운영 콘솔 검토"
    });
  };
  const confirmSingle = async (): Promise<void> => {
    if (!pendingSingle) return;
    const saved = await mutate("/api/admin/users/status", pendingSingle, "계정 상태가 갱신되었습니다.");
    if (saved) setPendingSingle(null);
  };
  const submitBulk = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!selectedBulkIds.length) return;
    if (!window.confirm(`선택한 계정 ${selectedBulkIds.length.toLocaleString("ko-KR")}개의 상태를 일괄 변경하시겠습니까?`)) return;
    void mutate("/api/admin/users/statuses", {
      updates: selectedBulkIds.map((userId) => ({ userId, status: valueFromForm(form, "bulkStatus") })),
      reason: valueFromForm(form, "bulkReason") || "운영 콘솔 일괄 변경"
    }, `${selectedBulkIds.length.toLocaleString("ko-KR")}개 계정 상태가 갱신되었습니다.`);
  };
  return (
    <WorkspacePanel>
      <div className="flex flex-col gap-3 border-b border-line pb-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-base font-black">회원 검색/상태 관리</h2>
          <p className="mt-1 text-sm font-bold text-ink-3">{data.users.length.toLocaleString("ko-KR")}명 표시</p>
        </div>
        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); onAccountFilterChange({ search: valueFromForm(event.currentTarget, "search") || undefined }); }}>
          <Field label="검색" name="search" defaultValue={data.filters.search ?? undefined} placeholder="회원 ID 또는 이름" />
          <button className="h-10 self-end rounded-lg bg-ticketground px-4 text-sm font-black text-on-ink" type="submit">검색</button>
        </form>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(220px,320px)_minmax(0,1fr)]">
        <div className="grid content-start gap-2">
          {data.users.map((user) => {
            const active = selectedUser?.id === user.id;
            return (
              <button className={`rounded-lg border p-3 text-left ${active ? "border-ink bg-surface" : "border-line bg-background"}`} key={user.id} onClick={() => setSelectedUserId(user.id)} type="button">
                <span className="block text-sm font-black text-ink">{user.name}</span>
                <span className="mt-1 block text-xs font-bold text-ink-3">{operatorLabel(user.status)} · 신뢰도 {user.trustScore}</span>
              </button>
            );
          })}
          {data.users.length ? null : <p className="rounded-lg border border-line p-3 text-sm font-bold text-ink-3">검색 결과가 없습니다.</p>}
        </div>
        <div className="min-w-0 rounded-lg border border-line p-4">
          {selectedUser ? (
            <>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-black text-ink">{selectedUser.name}</h3>
                  <p className="mt-1 font-mono text-xs text-ink-3">{selectedUser.id}</p>
                </div>
                <p className="text-sm font-black text-ink">{operatorLabel(selectedUser.status)} · 신뢰도 {selectedUser.trustScore}</p>
              </div>
              <section className="mt-4 border-t border-line pt-4">
                <h4 className="text-sm font-black text-ink">제재 이력</h4>
                <div className="mt-3 grid gap-2">
                  {selectedUser.sanctions.length ? selectedUser.sanctions.map((sanction) => (
                    <div className="rounded-lg border border-line p-3" key={sanction.id}>
                      <p className="text-sm font-bold text-ink">{sanction.reason}</p>
                      <p className="mt-1 text-xs font-bold text-ink-3">{operatorLabel(sanction.penalty)} · {sanction.at.slice(0, 16).replace("T", " ")}</p>
                    </div>
                  )) : <p className="rounded-lg border border-line p-3 text-sm font-bold text-ink-3">제재 이력이 없습니다.</p>}
                </div>
              </section>
              <form className="mt-4 grid gap-3 border-t border-line pt-4 md:grid-cols-3" key={selectedUser.id} onSubmit={submitSingle}>
                <SelectField label="상태" name="status" defaultValue={selectedUser.status} options={userStatuses.map((value) => ({ label: operatorLabel(value), value }))} />
                <Field label="사유" name="reason" defaultValue="운영 콘솔 검토" />
                <button className="h-10 self-end rounded-lg bg-ink px-4 text-sm font-black text-on-ink" type="submit">변경 확인</button>
              </form>
              {pendingSingle ? (
                <div className="mt-3 rounded-lg border border-line p-3">
                  <p className="text-sm font-black text-ink">수정하시겠습니까?</p>
                  <p className="mt-1 text-sm font-bold text-ink-3">{selectedUser.name} 계정을 {operatorLabel(pendingSingle.status)} 상태로 변경합니다.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button className="h-9 rounded-lg bg-ink px-3 text-sm font-black text-on-ink" onClick={() => void confirmSingle()} type="button">계정 상태 저장</button>
                    <button className="h-9 rounded-lg border border-line bg-background px-3 text-sm font-black text-ink" onClick={() => setPendingSingle(null)} type="button">취소</button>
                  </div>
                </div>
              ) : null}
            </>
          ) : <p className="text-sm font-bold text-ink-3">회원을 선택해주세요.</p>}
        </div>
      </div>
      <form className="mt-4 grid gap-3 rounded-lg border border-line p-4 md:grid-cols-[minmax(0,1fr)_180px_minmax(180px,1fr)_auto]" onSubmit={submitBulk}>
        <div className="grid gap-2">
          <p className="text-sm font-black text-ink">일괄 변경 대상</p>
          <div className="flex flex-wrap gap-2">
            {data.users.map((user) => (
              <label className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-bold text-ink-3" key={user.id}>
                <input aria-label={`${user.name} 선택`} checked={selectedBulkIds.includes(user.id)} onChange={() => toggleBulk(user.id)} type="checkbox" />
                {user.name}
              </label>
            ))}
          </div>
        </div>
        <SelectField label="일괄 상태" name="bulkStatus" defaultValue="WATCHLIST" options={userStatuses.map((value) => ({ label: operatorLabel(value), value }))} />
        <Field label="일괄 사유" name="bulkReason" defaultValue="운영 콘솔 일괄 변경" />
        <button className="h-10 self-end rounded-lg bg-ticketground px-4 text-sm font-black text-on-ink disabled:bg-surface disabled:text-ink-3" disabled={!selectedBulkIds.length} type="submit">선택 계정 일괄 변경</button>
      </form>
      <div className="mt-4"><Notice feedback={feedback} /></div>
    </WorkspacePanel>
  );
}

function FinanceWorkspace({
  data,
  onFinanceFilterChange,
}: {
  readonly data: FinanceWorkspace;
  readonly onFinanceFilterChange: (filters: { readonly eventId?: string; readonly from?: string; readonly method?: string; readonly status?: string; readonly to?: string; readonly page?: number }) => void;
}) {
  const currentFilters = {
    eventId: data.filters.eventId || undefined,
    from: data.filters.from || undefined,
    method: data.filters.method || undefined,
    status: data.filters.status || undefined,
    to: data.filters.to || undefined,
  };
  const updateFilters = (filters: typeof currentFilters & { readonly page?: number }): void => onFinanceFilterChange(filters);
  return (
    <WorkspacePanel>
      <div className="flex flex-col gap-3 border-b border-line pb-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-base font-black">정산 거래</h2>
          <p className="mt-1 text-sm font-bold text-ink-3">{data.page.total.toLocaleString("ko-KR")}건 중 {data.transactions.length.toLocaleString("ko-KR")}건 표시</p>
        </div>
      </div>
      <div className="mt-4 grid divide-y divide-line overflow-hidden rounded-lg border border-line sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
        <Stat label="거래 수" value={`${money(data.summary.count)}건`} />
        <Stat label="총 결제액" value={`${money(data.summary.totalAmount)}원`} />
        <Stat label="플랫폼 수수료" value={`${money(data.summary.totalFees)}원`} />
        <Stat label="판매자 정산" value={`${money(data.summary.totalSettlements)}원`} />
      </div>
      <form
        className="mt-4 grid gap-3 lg:grid-cols-6"
        onSubmit={(submission) => {
          submission.preventDefault();
          const form = submission.currentTarget;
          updateFilters({
            eventId: valueFromForm(form, "eventId") || undefined,
            from: valueFromForm(form, "from") || undefined,
            method: valueFromForm(form, "method") || undefined,
            status: valueFromForm(form, "status") || undefined,
            to: valueFromForm(form, "to") || undefined,
            page: 1,
          });
        }}
      >
        <SelectField label="공연" name="eventId" defaultValue={data.filters.eventId ?? ""} options={[{ label: "전체 공연", value: "" }, ...data.eventSummaries.map((summary) => ({ label: summary.title, value: summary.id }))]} />
        <Field label="시작일" name="from" defaultValue={data.filters.from ?? undefined} type="datetime-local" />
        <Field label="종료일" name="to" defaultValue={data.filters.to ?? undefined} type="datetime-local" />
        <SelectField label="결제 수단" name="method" defaultValue={data.filters.method ?? ""} options={[{ label: "전체 수단", value: "" }, { label: "신용카드", value: "CREDIT_CARD" }, { label: "계좌이체", value: "BANK_TRANSFER" }, { label: "간편결제", value: "EASY_PAY" }]} />
        <SelectField label="상태" name="status" defaultValue={data.filters.status ?? ""} options={[{ label: "전체 상태", value: "" }, { label: "결제 완료", value: "PAID" }, { label: "대기", value: "PENDING" }, { label: "실패", value: "FAILED" }]} />
        <button className="h-10 self-end rounded-lg bg-ticketground px-4 text-sm font-black text-on-ink" type="submit">필터 적용</button>
      </form>
      <div className="mt-4 grid gap-3 md:hidden">
        {data.transactions.map((transaction) => (
          <article className="rounded-lg border border-line bg-background p-3" key={transaction.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-ink">{transaction.eventTitle || transaction.eventId || "공연 정보 없음"}</p>
                <p className="mt-1 font-mono text-xs text-ink-3">{transaction.seatLabel || transaction.ticketId}</p>
              </div>
              <strong className="shrink-0 text-sm font-black text-ink">{money(transaction.amount)}원</strong>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold text-ink-3">
              <div><dt>일시</dt><dd className="mt-1 font-mono">{transaction.createdAt.slice(0, 16).replace("T", " ")}</dd></div>
              <div><dt>유형</dt><dd className="mt-1">{operatorLabel(transaction.type)}</dd></div>
              <div><dt>수수료</dt><dd className="mt-1">{money(transaction.platformFee)}원</dd></div>
              <div><dt>정산</dt><dd className="mt-1">{money(transaction.transferAmount)}원</dd></div>
            </dl>
            <p className="mt-3 text-xs font-bold text-ink-3">{operatorLabel(transaction.method)} · {operatorLabel(transaction.status)}</p>
          </article>
        ))}
      </div>
      <div className="mt-4 hidden overflow-hidden rounded-lg border border-line md:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="border-b border-line bg-surface text-xs font-black text-ink-3">
            <tr>
              <th className="p-3">일시</th>
              <th className="p-3">공연/좌석</th>
              <th className="p-3">유형</th>
              <th className="p-3">금액</th>
              <th className="p-3">수수료/정산</th>
              <th className="p-3">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data.transactions.map((transaction) => (
              <tr key={transaction.id}>
                <td className="p-3 font-mono text-xs text-ink-3">{transaction.createdAt.slice(0, 16).replace("T", " ")}</td>
                <td className="min-w-0 p-3"><p className="truncate font-black text-ink">{transaction.eventTitle || transaction.eventId || "공연 정보 없음"}</p><p className="mt-1 font-mono text-xs text-ink-3">{transaction.seatLabel || transaction.ticketId}</p></td>
                <td className="p-3 font-bold text-ink-3">{operatorLabel(transaction.type)}</td>
                <td className="p-3 font-black text-ink">{money(transaction.amount)}원</td>
                <td className="p-3 font-bold text-ink-3">수수료 {money(transaction.platformFee)}원 · 정산 {money(transaction.transferAmount)}원</td>
                <td className="p-3 font-bold text-ink-3">{operatorLabel(transaction.method)} · {operatorLabel(transaction.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.transactions.length ? null : <p className="mt-4 rounded-lg border border-line p-3 text-sm font-bold text-ink-3">조건에 맞는 결제 거래가 없습니다.</p>}
      <div className="mt-4 flex flex-col gap-3 border-t border-line pt-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-bold text-ink-3">{data.page.page.toLocaleString("ko-KR")}페이지</p>
        <div className="flex gap-2">
          <button className="h-9 rounded-lg border border-line bg-background px-3 text-sm font-black disabled:bg-surface disabled:text-ink-3" disabled={!data.page.hasPrevious} onClick={() => updateFilters({ ...currentFilters, page: Math.max(1, data.page.page - 1) })} type="button">이전</button>
          <button className="h-9 rounded-lg border border-line bg-background px-3 text-sm font-black disabled:bg-surface disabled:text-ink-3" disabled={!data.page.hasNext} onClick={() => updateFilters({ ...currentFilters, page: data.page.page + 1 })} type="button">다음</button>
        </div>
      </div>
    </WorkspacePanel>
  );
}

function ResaleWorkspace({ data, feedback, mutate, onLocalError }: { readonly data: ResaleWorkspace } & MutableWorkspaceProps) {
  const openPools = data.resalePools.filter((pool) => pool.status === "OPEN");
  const unreadAlerts = data.operatorAlerts.filter((alert) => alert.status !== "ACKED");
  const acknowledgeAll = (): void => {
    if (!unreadAlerts.length) return;
    if (!window.confirm(`미확인 알림 ${unreadAlerts.length.toLocaleString("ko-KR")}건을 모두 확인 처리하시겠습니까?`)) return;
    void mutate("/api/admin/alerts/ack", { alertIds: unreadAlerts.map((alert) => alert.id) }, "운영 알림을 확인 처리했습니다.");
  };

  return (
    <WorkspacePanel>
      <div className="flex flex-col gap-3 border-b border-line pb-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-base font-black">재판매/양도 현황</h2>
          <p className="mt-1 text-sm font-bold text-ink-3">열린 풀 {openPools.length.toLocaleString("ko-KR")}건 · 미확인 알림 {unreadAlerts.length.toLocaleString("ko-KR")}건</p>
        </div>
        <button className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-background px-3 text-sm font-black text-ink disabled:bg-surface disabled:text-ink-3" disabled={!unreadAlerts.length} onClick={acknowledgeAll} type="button"><CheckCircle2 size={16} />모두 확인</button>
      </div>
      <section className="mt-4">
        <h3 className="text-sm font-black text-ink">재판매 풀</h3>
        <div className="mt-3 grid gap-3">
          {data.resalePools.length ? data.resalePools.map((pool) => (
            <form
              className="grid gap-3 rounded-lg border border-line p-3 lg:grid-cols-[minmax(0,1fr)_220px_auto]"
              key={pool.id}
              onSubmit={(submission) => {
                submission.preventDefault();
                if (pool.status === "CANCELED") return;
                const reason = valueFromForm(submission.currentTarget, "reason");
                if (!reason) {
                  onLocalError?.("강제 취소 사유를 입력해주세요.");
                  focusInput(submission.currentTarget, "reason");
                  return;
                }
                if (!window.confirm(`${pool.eventTitle} · ${pool.seatLabel} 양도 티켓을 강제취소하시겠습니까?`)) return;
                void mutate("/api/admin/resale/cancel", { poolId: pool.id, reason }, "재판매 풀이 취소되었습니다.");
              }}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-ink">{pool.eventTitle}</p>
                <p className="mt-1 text-xs font-bold text-ink-3">{pool.seatLabel} · {pool.zoneName} · 판매자 {pool.sellerName} · {money(pool.price)}원 · {operatorLabel(pool.status)}</p>
                <p className="mt-1 font-mono text-xs text-ink-3">{pool.id}</p>
                {pool.cancelReason ? <p className="mt-1 text-xs font-bold text-warn">취소 사유: {pool.cancelReason}</p> : null}
              </div>
              <Field label="강제 취소 사유" name="reason" placeholder="판매자 응답 없음" />
              <button className="h-10 self-end rounded-lg bg-ink px-4 text-sm font-black text-on-ink disabled:bg-surface disabled:text-ink-3" disabled={pool.status === "CANCELED"} type="submit">강제 취소</button>
            </form>
          )) : <p className="rounded-lg border border-line p-3 text-sm font-bold text-ink-3">재판매 풀이 없습니다.</p>}
        </div>
      </section>
      <section className="mt-5 border-t border-line pt-4">
        <h3 className="text-sm font-black text-ink">운영 알림</h3>
        <div className="mt-3 grid gap-2">
          {data.operatorAlerts.length ? data.operatorAlerts.map((alert) => (
            <div className="flex flex-col gap-3 rounded-lg border border-line p-3 sm:flex-row sm:items-center sm:justify-between" key={alert.id}>
              <div className="min-w-0">
                <p className="text-sm font-bold text-ink">{alert.message}</p>
                <p className="mt-1 text-xs font-bold text-ink-3">{operatorLabel(alert.status)} · {alert.createdAt?.slice(0, 16).replace("T", " ") ?? alert.id}</p>
              </div>
              <button className="h-9 rounded-lg border border-line bg-background px-3 text-sm font-black text-ink disabled:bg-surface disabled:text-ink-3" disabled={alert.status === "ACKED"} onClick={() => { if (window.confirm("이 운영 알림을 확인 처리하시겠습니까?")) void mutate("/api/admin/alerts/ack", { alertId: alert.id }, "운영 알림을 확인 처리했습니다."); }} type="button">확인</button>
            </div>
          )) : <p className="rounded-lg border border-line p-3 text-sm font-bold text-ink-3">운영 알림이 없습니다.</p>}
        </div>
      </section>
      <div className="mt-4"><Notice feedback={feedback} /></div>
    </WorkspacePanel>
  );
}
function AdmissionWorkspace({
  data,
  feedback,
  mutate,
  onLocalError,
}: { readonly data: AdmissionWorkspace } & MutableWorkspaceProps) {
  const risks = data.admissionCredentials.filter((item) => item.riskStatus && item.riskStatus !== "CLEAR" && item.riskStatus !== "NORMAL").length;
  const held = data.admissionCredentials.filter((item) => item.adminHold).length;
  const submitHold = (credentialId: string, hold: boolean) => (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const form = event.currentTarget;
    const reason = valueFromForm(form, "reason");
    if (!reason) {
      onLocalError?.("입장 QR 보류 사유를 입력해주세요.");
      focusInput(form, "reason");
      return;
    }
    if (!window.confirm(hold ? `${credentialId} 입장 QR 발급을 보류하시겠습니까?` : `${credentialId} 입장 QR 보류를 해제하시겠습니까?`)) return;
    void mutate("/api/admin/admission/hold", { credentialId, hold, reason }, hold ? "입장 QR 발급을 보류했습니다." : "입장 QR 보류를 해제했습니다.");
  };
  return (
    <WorkspacePanel>
      <div className="flex flex-col gap-3 border-b border-line pb-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-base font-black">입장/QR 현황</h2>
          <p className="mt-1 text-sm font-bold text-ink-3">최근 QR 로그 {data.qrIssueLogs.length.toLocaleString("ko-KR")}건</p>
        </div>
      </div>
      <dl className="mt-4 grid divide-y divide-line overflow-hidden rounded-lg border border-line text-sm font-bold text-ink-3 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Stat label="입장 자격" value={`${data.admissionCredentials.length.toLocaleString("ko-KR")}건`} />
        <Stat label="현장 리스크" tone={risks ? "warn" : "ok"} value={`${risks.toLocaleString("ko-KR")}건`} />
        <Stat label="관리 보류" tone={held ? "warn" : "ok"} value={`${held.toLocaleString("ko-KR")}건`} />
      </dl>
      <section className="mt-5">
        <h3 className="text-sm font-black text-ink">입장 자격 보류</h3>
        <div className="mt-3 grid gap-3">
          {data.admissionCredentials.map((credential) => (
            <form className="grid gap-3 rounded-lg border border-line p-3 lg:grid-cols-[minmax(0,1fr)_minmax(180px,260px)_auto]" key={credential.id} onSubmit={submitHold(credential.id, !credential.adminHold)}>
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-ink">{credential.ticketId}</p>
                <p className="mt-1 text-xs font-bold text-ink-3">{credential.userId} · {operatorLabel(credential.status)} · {credential.riskStatus || "NORMAL"}</p>
                <p className={`mt-1 text-xs font-bold ${credential.adminHold ? "text-warn" : "text-ok"}`}>{credential.adminHold ? `보류 중: ${credential.adminHoldReason || "사유 없음"}` : "보류 없음"}</p>
              </div>
              <Field label={credential.adminHold ? "해제 사유" : "보류 사유"} name="reason" defaultValue={credential.adminHold ? "현장 확인 완료" : "고위험 계정 현장 확인"} />
              <button className={`h-10 self-end rounded-lg px-4 text-sm font-black ${credential.adminHold ? "border border-line bg-background text-ink" : "bg-ink text-on-ink"}`} type="submit">{credential.adminHold ? "보류 해제" : "QR 보류"}</button>
            </form>
          ))}
          {data.admissionCredentials.length ? null : <p className="rounded-lg border border-line p-3 text-sm font-bold text-ink-3">입장 자격이 없습니다.</p>}
        </div>
      </section>
      <section className="mt-5 border-t border-line pt-4">
        <h3 className="text-sm font-black text-ink">최근 QR 발급 로그</h3>
        <div className="mt-3 hidden overflow-hidden rounded-lg border border-line md:block">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="border-b border-line bg-surface text-xs font-black text-ink-3">
              <tr>
                <th className="p-3">발급 시각</th>
                <th className="p-3">티켓/자격</th>
                <th className="p-3">회원/기기</th>
                <th className="p-3">채널/추적</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.qrIssueLogs.map((log) => (
                <tr key={log.id}>
                  <td className="p-3 font-mono text-xs text-ink-3">{log.issuedAt.slice(0, 16).replace("T", " ")}</td>
                  <td className="p-3"><p className="font-mono text-xs font-bold text-ink">{log.ticketId}</p><p className="mt-1 font-mono text-xs text-ink-3">{log.credentialId || "자격 없음"}</p></td>
                  <td className="p-3"><p className="font-mono text-xs font-bold text-ink">{log.userId}</p><p className="mt-1 font-mono text-xs text-ink-3">{log.deviceId}</p></td>
                  <td className="p-3 font-bold text-ink-3">{operatorLabel(log.channel)} · {log.traceCode}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 grid gap-3 md:hidden">
          {data.qrIssueLogs.map((log) => (
            <article className="rounded-lg border border-line p-3" key={log.id}>
              <p className="font-mono text-xs font-bold text-ink-3">{log.issuedAt.slice(0, 16).replace("T", " ")}</p>
              <p className="mt-2 text-sm font-black text-ink">{log.ticketId}</p>
              <p className="mt-1 text-xs font-bold text-ink-3">{log.userId} · {log.deviceId} · {operatorLabel(log.channel)} · {log.traceCode}</p>
            </article>
          ))}
        </div>
        {data.qrIssueLogs.length ? null : <p className="mt-3 rounded-lg border border-line p-3 text-sm font-bold text-ink-3">최근 QR 발급 로그가 없습니다.</p>}
      </section>
      <div className="mt-4"><Notice feedback={feedback} /></div>
    </WorkspacePanel>
  );
}
function AuditWorkspace({
  data,
  onAuditFilterChange,
}: {
  readonly data: AuditWorkspace;
  readonly onAuditFilterChange: (filters: { readonly action?: string; readonly actorId?: string; readonly from?: string; readonly to?: string; readonly page?: number }) => void;
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(data.ledger[0]?.index ?? null);
  const currentFilters = {
    action: data.filters.action || undefined,
    actorId: data.filters.actorId || undefined,
    from: data.filters.from || undefined,
    to: data.filters.to || undefined,
  };
  const selectedEntry = data.ledger.find((entry) => entry.index === selectedIndex) ?? data.ledger[0] ?? null;
  const exportParams = new URLSearchParams();
  if (currentFilters.action) exportParams.set("action", currentFilters.action);
  if (currentFilters.actorId) exportParams.set("actorId", currentFilters.actorId);
  if (currentFilters.from) exportParams.set("from", currentFilters.from);
  if (currentFilters.to) exportParams.set("to", currentFilters.to);
  const exportHref = `/api/admin/ledger/export${exportParams.toString() ? `?${exportParams.toString()}` : ""}`;
  const updateFilters = (filters: typeof currentFilters & { readonly page?: number }): void => {
    setSelectedIndex(null);
    onAuditFilterChange(filters);
  };
  return (
    <WorkspacePanel>
      <div className="flex flex-col gap-3 border-b border-line pb-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-base font-black">감사 원장</h2>
          <p className="mt-1 text-sm font-bold text-ink-3">{data.page.total.toLocaleString("ko-KR")}건 중 {data.ledger.length.toLocaleString("ko-KR")}건 표시</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-sm font-black ${data.ledgerCheck.ok ? "text-ok" : "text-warn"}`}>{data.ledgerCheck.ok ? "원장 검증 정상" : "원장 검증 불일치"}</span>
          <a className="inline-flex h-9 items-center rounded-lg border border-line bg-background px-3 text-sm font-black text-ink no-underline" href={exportHref}>내보내기</a>
        </div>
      </div>
      <form
        className="mt-4 grid gap-3 lg:grid-cols-5"
        onSubmit={(submission) => {
          submission.preventDefault();
          const form = submission.currentTarget;
          updateFilters({
            action: valueFromForm(form, "action") || undefined,
            actorId: valueFromForm(form, "actorId") || undefined,
            from: valueFromForm(form, "from") || undefined,
            to: valueFromForm(form, "to") || undefined,
            page: 1,
          });
        }}
      >
        <Field label="액션" name="action" defaultValue={data.filters.action ?? undefined} placeholder="EVENT_SALE_UPDATED" />
        <Field label="행위자" name="actorId" defaultValue={data.filters.actorId ?? undefined} placeholder="ADMIN" />
        <Field label="시작일" name="from" defaultValue={data.filters.from ?? undefined} type="datetime-local" />
        <Field label="종료일" name="to" defaultValue={data.filters.to ?? undefined} type="datetime-local" />
        <button className="h-10 self-end rounded-lg bg-ticketground px-4 text-sm font-black text-on-ink" type="submit">필터 적용</button>
      </form>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,420px)]">
        <div className="grid gap-3 md:hidden">
          {data.ledger.map((entry) => {
            const active = selectedEntry?.index === entry.index;
            return (
              <article className={`rounded-lg border p-3 ${active ? "border-ink bg-surface" : "border-line bg-background"}`} key={entry.index}>
                <div className="grid gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-xs font-bold text-ink-3">{entry.at.slice(0, 16).replace("T", " ")}</p>
                    <p className="text-xs font-bold text-ink-3">{entry.actorId}</p>
                  </div>
                  <button className="min-w-0 break-all text-left text-sm font-black text-ink underline-offset-2 hover:underline" onClick={() => setSelectedIndex(entry.index)} type="button">{entry.action}</button>
                </div>
              </article>
            );
          })}
        </div>
        <div className="hidden overflow-hidden rounded-lg border border-line md:block">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="border-b border-line bg-surface text-xs font-black text-ink-3">
              <tr>
                <th className="p-3">시간</th>
                <th className="p-3">행위자</th>
                <th className="p-3">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.ledger.map((entry) => {
                const active = selectedEntry?.index === entry.index;
                return (
                  <tr className={active ? "bg-surface" : "bg-background"} key={entry.index}>
                    <td className="p-3 font-mono text-xs text-ink-3">{entry.at.slice(0, 16).replace("T", " ")}</td>
                    <td className="p-3 font-bold text-ink-3">{entry.actorId}</td>
                    <td className="p-3"><button className="text-left text-sm font-black text-ink underline-offset-2 hover:underline" onClick={() => setSelectedIndex(entry.index)} type="button">{entry.action}</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <aside className="min-w-0 rounded-lg border border-line bg-background p-3">
          <h3 className="text-sm font-black text-ink">상세 페이로드</h3>
          {selectedEntry ? (
            <div className="mt-3 grid gap-2">
              <p className="text-xs font-bold text-ink-3">{selectedEntry.action} · {selectedEntry.actorId}</p>
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-line bg-surface p-3 text-xs font-bold text-ink">{JSON.stringify(selectedEntry.payload, null, 2)}</pre>
            </div>
          ) : <p className="mt-3 text-sm font-bold text-ink-3">표시할 감사 항목이 없습니다.</p>}
        </aside>
      </div>
      {data.ledger.length ? null : <p className="mt-4 rounded-lg border border-line p-3 text-sm font-bold text-ink-3">조건에 맞는 감사 항목이 없습니다.</p>}
      <div className="mt-4 flex flex-col gap-3 border-t border-line pt-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-bold text-ink-3">{data.page.page.toLocaleString("ko-KR")}페이지</p>
        <div className="flex gap-2">
          <button className="h-9 rounded-lg border border-line bg-background px-3 text-sm font-black disabled:bg-surface disabled:text-ink-3" disabled={!data.page.hasPrevious} onClick={() => updateFilters({ ...currentFilters, page: Math.max(1, data.page.page - 1) })} type="button">이전</button>
          <button className="h-9 rounded-lg border border-line bg-background px-3 text-sm font-black disabled:bg-surface disabled:text-ink-3" disabled={!data.page.hasNext} onClick={() => updateFilters({ ...currentFilters, page: data.page.page + 1 })} type="button">다음</button>
        </div>
      </div>
    </WorkspacePanel>
  );
}
function RoleFields({ roles, selected = [] }: { readonly roles: readonly { readonly key: string; readonly name: string }[]; readonly selected?: readonly string[] }) {
  return <fieldset className="grid gap-2 rounded-lg border border-line p-3"><legend className="px-1 text-sm font-bold text-ink-3">관리자 역할</legend><div className="flex flex-wrap gap-3">{roles.map((role) => <label className="inline-flex items-center gap-2 text-sm font-bold text-ink" key={role.key}><input defaultChecked={selected.includes(role.key)} name="roleKeys" type="checkbox" value={role.key} />{role.name}</label>)}</div></fieldset>;
}

function AclWorkspace({ data, feedback, mutate, onLocalError, session }: { readonly data: AclWorkspaceData; readonly session: AdminSession } & MutableWorkspaceProps) {
  const canManage = session.admin.permissions.includes("acl.manage");
  // The backend rejects modifying an account that holds a permission the
  // actor lacks (ADMIN_ROLE_ESCALATION) - mirror that here so a lower-
  // privileged admin sees a read-only account instead of a form that can
  // only ever fail after they fill it out and submit.
  const accountIsManageable = (account: AdminAccount): boolean =>
    account.permissions.every((permission) => session.admin.permissions.includes(permission));
  const create = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const form = event.currentTarget;
    const roleKeys = valuesFromForm(form, "roleKeys");
    if (!roleKeys.length) return onLocalError?.("관리자 역할을 하나 이상 선택해주세요.");
    const username = valueFromForm(form, "username");
    if (!window.confirm(`${username} 관리자 계정을 생성하시겠습니까?`)) return;
    void mutate("/api/admin/admin-accounts", { username, password: valueFromForm(form, "password"), roleKeys, ipAllowlist: ipAllowlistFromForm(form) }, "관리자 계정이 생성되었습니다.");
  };
  return <div className="grid gap-4">{canManage ? <WorkspacePanel><div className="flex items-center gap-2 border-b border-line pb-3"><UsersRound size={18} /><h2 className="text-base font-black">관리자 계정 추가</h2></div><form className="mt-4 grid gap-3 md:grid-cols-2" noValidate onSubmit={create}><Field label="관리자 아이디" name="username" required /><Field label="초기 비밀번호" name="password" required type="password" /><RoleFields roles={session.roles} /><label className="grid gap-1 text-sm font-bold text-ink-3">IP ACL<textarea className="min-h-24 rounded-lg border border-line bg-background p-3 text-sm font-bold text-ink" name="ipAllowlist" placeholder={"203.0.113.20\n198.51.100.0/24"} /></label><p className="-mt-1 text-xs font-bold text-ink-3 md:col-span-2">비워두면 모든 IP를 허용합니다. IPv4 주소 또는 CIDR을 줄바꿈이나 쉼표로 구분하세요.</p><button className="h-10 rounded-lg bg-ink px-4 text-sm font-black text-on-ink md:col-span-2" type="submit">관리자 계정 생성</button></form></WorkspacePanel> : <WorkspacePanel><p className="text-sm font-bold text-ink-3">이 계정은 관리자와 ACL을 조회할 수 있지만 변경할 권한은 없습니다.</p></WorkspacePanel>}<WorkspacePanel><h2 className="text-base font-black">등록된 관리자</h2><div className="mt-4 grid gap-4">{data.adminAccounts.length ? data.adminAccounts.map((account) => account.bootstrap ? <div className="rounded-lg border border-ticketground p-4" key={account.id}><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-black text-ink">{account.username}</p><span className="rounded-full bg-ticketground px-2 py-1 text-xs font-black text-on-ink">환경변수 관리자</span></div><p className="mt-1 text-sm font-bold text-ink-3">{account.roleKeys.map((key) => session.roles.find((role) => role.key === key)?.name || key).join(", ")}</p><p className="mt-1 text-xs font-bold text-ink-3">로그인 계정은 서버 환경변수로 관리되며 이 화면에서 역할과 ACL을 수정할 수 없습니다.</p></div> : canManage && accountIsManageable(account) ? <form className="grid gap-3 rounded-lg border border-line p-4 md:grid-cols-2" key={account.id} onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const roleKeys = valuesFromForm(form, "roleKeys"); if (!roleKeys.length) return onLocalError?.("관리자 역할을 하나 이상 선택해주세요."); if (!window.confirm(`${account.username} 계정/ACL 설정을 저장하시겠습니까?`)) return; const password = valueFromForm(form, "password"); void mutate("/api/admin/admin-accounts/update", { adminId: account.id, roleKeys, ipAllowlist: ipAllowlistFromForm(form), active: valueFromForm(form, "active") === "true", ...(password ? { password } : {}) }, "관리자 계정 설정이 저장되었습니다."); }}><div><p className="font-black text-ink">{account.username}</p><p className="mt-1 text-xs font-bold text-ink-3">{account.id}</p></div><SelectField defaultValue={String(account.active)} label="상태" name="active" options={[{ label: "활성", value: "true" }, { label: "비활성", value: "false" }]} /><RoleFields roles={session.roles} selected={account.roleKeys} /><Field label="새 비밀번호 (선택)" name="password" type="password" /><label className="grid gap-1 text-sm font-bold text-ink-3">IP ACL<textarea className="min-h-24 rounded-lg border border-line bg-background p-3 text-sm font-bold text-ink" defaultValue={account.ipAllowlist.join("\n")} name="ipAllowlist" /></label><button className="h-10 rounded-lg bg-ticketground px-4 text-sm font-black text-on-ink md:col-span-2" type="submit">계정/ACL 저장</button></form> : <div className="rounded-lg border border-line p-4" key={account.id}><p className="font-black text-ink">{account.username}</p><p className="mt-1 text-sm font-bold text-ink-3">{account.roleKeys.map((key) => session.roles.find((role) => role.key === key)?.name || key).join(", ")}</p><p className="mt-1 text-xs font-bold text-ink-3">{account.active ? "활성" : "비활성"} · {account.ipAllowlist.length ? account.ipAllowlist.join(", ") : "모든 IP 허용"}</p></div>) : <p className="text-sm font-bold text-ink-3">등록된 별도 관리자 계정이 없습니다.</p>}</div><div className="mt-4"><Notice feedback={feedback} /></div></WorkspacePanel></div>;
}

function GroupBookingWorkspace({
  data,
  feedback,
  mutate,
  onGroupBookingFilterChange,
  onLocalError,
}: { readonly data: GroupBookingWorkspace; readonly onGroupBookingFilterChange: (filters: { readonly status?: string; readonly page?: number }) => void } & MutableWorkspaceProps) {
  const [selectedRequestId, setSelectedRequestId] = useState(data.requests[0]?.id ?? "");
  const request = data.requests.find((item) => item.id === selectedRequestId) || data.requests[0];

  const approve = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!request) return;
    const form = event.currentTarget;
    const assignedCount = Number(valueFromForm(form, "assignedCount"));
    if (!Number.isInteger(assignedCount) || assignedCount < 1) {
      onLocalError?.("배정 수량을 확인해주세요.");
      focusInput(form, "assignedCount");
      return;
    }
    void mutate(`/api/admin/group-booking/requests/${request.id}/approve`, {
      assignedCount,
      reviewNote: valueFromForm(form, "reviewNote"),
    }, "단체 예매 신청이 승인되고 티켓이 배정되었습니다.");
  };

  const reject = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!request) return;
    const form = event.currentTarget;
    const reviewNote = valueFromForm(form, "reviewNote");
    if (!reviewNote) {
      onLocalError?.("반려 사유를 입력해주세요.");
      focusInput(form, "reviewNote");
      return;
    }
    void mutate(`/api/admin/group-booking/requests/${request.id}/reject`, { reviewNote }, "단체 예매 신청이 반려되었습니다.");
  };

  return (
    <WorkspacePanel>
      <div className="flex flex-col gap-3 border-b border-line pb-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-base font-black">단체/기관 예매 신청</h2>
          <p className="mt-1 text-sm font-bold text-ink-3">{data.requests.length.toLocaleString("ko-KR")}건 표시</p>
        </div>
        <form className="grid gap-2 sm:grid-cols-[160px_auto]" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; onGroupBookingFilterChange({ status: valueFromForm(form, "status") || undefined }); }}>
          <SelectField defaultValue={data.filters.status ?? ""} label="상태" name="status" options={[{ label: "전체 상태", value: "" }, ...groupBookingStatuses.map((value) => ({ label: operatorLabel(value), value }))]} />
          <button className="h-10 self-end rounded-lg bg-ticketground px-4 text-sm font-black text-on-ink" type="submit">필터 적용</button>
        </form>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(240px,360px)_minmax(0,1fr)]">
        <div className="grid content-start gap-2">
          {data.requests.map((item) => (
            <button className={`rounded-lg border p-3 text-left ${request?.id === item.id ? "border-ink bg-surface" : "border-line bg-background"}`} key={item.id} onClick={() => setSelectedRequestId(item.id)} type="button">
              <span className="flex items-center justify-between gap-2">
                <span className="block text-sm font-black text-ink">{item.orgName}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-black ${item.status === "PENDING" ? "bg-ink text-on-ink" : item.status === "APPROVED" ? "text-ok" : "text-ticketground"}`}>{operatorLabel(item.status)}</span>
              </span>
              <span className="mt-1 block text-xs font-bold text-ink-3">{operatorLabel(item.orgType)} · {item.eventTitle}</span>
              <span className="mt-1 block text-xs font-bold text-ink-3">예상 인원 {item.expectedHeadcount.toLocaleString("ko-KR")}명 · {item.createdAt.slice(0, 16).replace("T", " ")}</span>
            </button>
          ))}
          {data.requests.length ? null : <p className="rounded-lg border border-line p-3 text-sm font-bold text-ink-3">조건에 맞는 신청이 없습니다.</p>}
        </div>
        <div className="min-w-0 rounded-lg border border-line p-4">
          {request ? (
            <>
              <div className="border-b border-line pb-3">
                <h3 className="text-base font-black text-ink">{request.orgName}</h3>
                <p className="mt-1 text-sm font-bold text-ink-3">{operatorLabel(request.orgType)} · {operatorLabel(request.status)}</p>
              </div>
              <div className="mt-4 grid gap-2 text-sm font-bold text-ink-3 md:grid-cols-2">
                <p>담당자: <span className="text-ink">{request.contactName}</span></p>
                <p>연락처: <span className="text-ink">{request.contactPhone}</span></p>
                <p>이메일: <span className="text-ink">{request.contactEmail}</span></p>
                <p>결제 방식: <span className="text-ink">{operatorLabel(request.paymentMethod)}</span></p>
                <p>희망 공연: <span className="text-ink">{request.eventTitle} · {request.venue}</span></p>
                <p>희망 일정: <span className="text-ink">{request.dateLabel} · {request.zoneName}</span></p>
                <p>예상 인원: <span className="text-ink">{request.expectedHeadcount.toLocaleString("ko-KR")}명</span></p>
                <p>신청일: <span className="text-ink">{request.createdAt.slice(0, 16).replace("T", " ")}</span></p>
              </div>
              {request.requestNote ? <p className="mt-3 rounded-lg border border-line bg-surface p-3 text-sm font-bold text-ink-3">요청사항: {request.requestNote}</p> : null}
              <a className="mt-3 inline-block text-sm font-black text-ticketground underline" href={request.businessRegistrationFileUrl} rel="noreferrer" target="_blank">사업자등록증/고유번호증 확인</a>
              {request.status === "PENDING" ? (
                <div className="mt-4 grid gap-4 border-t border-line pt-4 md:grid-cols-2" key={request.id}>
                  <form className="grid gap-3" noValidate onSubmit={approve}>
                    <h4 className="text-sm font-black text-ink">승인 및 티켓 배정</h4>
                    <Field defaultValue={request.expectedHeadcount} label="배정 수량" name="assignedCount" type="number" />
                    <TextareaField label="검토 메모 (선택)" name="reviewNote" rows={2} />
                    <button className="h-10 rounded-lg bg-ink px-4 text-sm font-black text-on-ink" type="submit">승인 및 배정</button>
                  </form>
                  <form className="grid gap-3" noValidate onSubmit={reject}>
                    <h4 className="text-sm font-black text-ink">반려</h4>
                    <TextareaField label="반려 사유" name="reviewNote" rows={2} />
                    <button className="h-10 rounded-lg border border-ticketground px-4 text-sm font-black text-ticketground" type="submit">반려</button>
                  </form>
                </div>
              ) : (
                <div className="mt-4 rounded-lg border border-line bg-surface p-3 text-sm font-bold text-ink-3" key={request.id}>
                  <p>검토자: {request.reviewedBy || "-"} · {request.reviewedAt?.slice(0, 16).replace("T", " ") || "-"}</p>
                  {request.reviewNote ? <p className="mt-1">메모: {request.reviewNote}</p> : null}
                  {request.status === "APPROVED" ? <p className="mt-1">배정 수량: {request.assignedCount?.toLocaleString("ko-KR")}명 · 티켓 {request.assignedTicketIds.length}건</p> : null}
                </div>
              )}
            </>
          ) : <p className="text-sm font-bold text-ink-3">검토할 신청이 없습니다.</p>}
        </div>
      </div>
      <div className="mt-4"><Notice feedback={feedback} /></div>
    </WorkspacePanel>
  );
}

function IssueSellerAccountForm({ applicationId, session }: { readonly applicationId: string; readonly session: AdminSession }) {
  const [issued, setIssued] = useState<{ readonly account: SellerAccount; readonly tempPassword: string } | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const form = event.currentTarget;
    const username = valueFromForm(form, "username");
    if (!username) {
      setError("아이디를 입력해주세요.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const result = await apiRequest<{ readonly account: SellerAccount; readonly tempPassword: string }>("/api/admin/seller-accounts/issue", {
        method: "POST",
        body: JSON.stringify({ applicationId, username }),
        headers: { "x-tig-csrf": session.csrf },
      });
      setIssued(result);
    } catch (issueError) {
      setError(issueError instanceof Error ? issueError.message : "계정 발급에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  if (issued) {
    return (
      <div className="mt-3 rounded-lg border border-ok bg-surface p-3 text-sm font-bold text-ink">
        <p>판매자 계정이 발급되었습니다. 아래 정보는 지금만 표시되며 다시 조회할 수 없으니 이 자리에서 전달해주세요.</p>
        <p className="mt-2">아이디: <span className="font-black text-ticketground">{issued.account.username}</span></p>
        <p>임시 비밀번호: <span className="font-black text-ticketground">{issued.tempPassword}</span></p>
      </div>
    );
  }

  return (
    <form className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]" noValidate onSubmit={submit}>
      <Field label="판매자 로그인 아이디" name="username" placeholder="영문 소문자, 숫자, . _ -" />
      <button className="h-10 self-end rounded-lg bg-ok px-4 text-sm font-black text-white disabled:bg-surface-3 disabled:text-ink-4" disabled={submitting} type="submit">판매자 계정 발급</button>
      {error ? <p className="text-xs font-bold text-ticketground sm:col-span-2">{error}</p> : null}
    </form>
  );
}

function SellerApplicationsWorkspace({
  data,
  feedback,
  mutate,
  onLocalError,
  onSellerApplicationFilterChange,
  session,
}: { readonly data: SellerApplicationsWorkspace; readonly onSellerApplicationFilterChange: (filters: { readonly status?: string; readonly page?: number }) => void; readonly session: AdminSession } & MutableWorkspaceProps) {
  const [selectedId, setSelectedId] = useState(data.applications[0]?.id ?? "");
  const application = data.applications.find((item) => item.id === selectedId) || data.applications[0];
  const checklist = application?.review.verificationChecklist;
  const checklistComplete = Boolean(checklist?.bizNumberVerified && checklist?.contactPhoneVerified && checklist?.eventAuthenticityChecked);

  const toggleChecklistItem = (field: "bizNumberVerified" | "contactPhoneVerified" | "eventAuthenticityChecked", checked: boolean): void => {
    if (!application) return;
    void mutate(`/api/admin/seller-applications/${application.id}/checklist`, { [field]: checked }, "");
  };

  const approve = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!application) return;
    const form = event.currentTarget;
    void mutate(`/api/admin/seller-applications/${application.id}/approve`, { reviewNote: valueFromForm(form, "reviewNote") }, "신청이 승인되었습니다. 카탈로그 등록 도구에서 실제 공연을 만들어 마무리해주세요.");
  };

  const reject = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!application) return;
    const form = event.currentTarget;
    const reviewNote = valueFromForm(form, "reviewNote");
    if (!reviewNote) {
      onLocalError?.("반려 사유를 입력해주세요.");
      focusInput(form, "reviewNote");
      return;
    }
    void mutate(`/api/admin/seller-applications/${application.id}/reject`, { reviewNote }, "신청이 반려되었습니다.");
  };

  return (
    <WorkspacePanel>
      <div className="flex flex-col gap-3 border-b border-line pb-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-base font-black">기업 판매자 신청</h2>
          <p className="mt-1 text-sm font-bold text-ink-3">{data.applications.length.toLocaleString("ko-KR")}건 표시</p>
        </div>
        <form className="grid gap-2 sm:grid-cols-[160px_auto]" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; onSellerApplicationFilterChange({ status: valueFromForm(form, "status") || undefined }); }}>
          <SelectField defaultValue="" label="상태" name="status" options={[{ label: "전체 상태", value: "" }, ...sellerApplicationStatuses.map((value) => ({ label: operatorLabel(value), value }))]} />
          <button className="h-10 self-end rounded-lg bg-ticketground px-4 text-sm font-black text-on-ink" type="submit">필터 적용</button>
        </form>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(240px,360px)_minmax(0,1fr)]">
        <div className="grid content-start gap-2">
          {data.applications.map((item) => (
            <button className={`rounded-lg border p-3 text-left ${application?.id === item.id ? "border-ink bg-surface" : "border-line bg-background"}`} key={item.id} onClick={() => setSelectedId(item.id)} type="button">
              <span className="flex items-center justify-between gap-2">
                <span className="block text-sm font-black text-ink">{item.organization.legalName}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-black ${item.status === "PENDING" ? "bg-ink text-on-ink" : item.status === "REJECTED" ? "text-ticketground" : "text-ok"}`}>{operatorLabel(item.status)}</span>
              </span>
              <span className="mt-1 block text-xs font-bold text-ink-3">{operatorLabel(item.organization.orgType)} · {item.proposedEvent.title}</span>
              <span className="mt-1 block text-xs font-bold text-ink-3">{item.createdAt.slice(0, 16).replace("T", " ")}</span>
            </button>
          ))}
          {data.applications.length ? null : <p className="rounded-lg border border-line p-3 text-sm font-bold text-ink-3">조건에 맞는 신청이 없습니다.</p>}
        </div>
        <div className="min-w-0 rounded-lg border border-line p-4">
          {application ? (
            <>
              <div className="border-b border-line pb-3">
                <h3 className="text-base font-black text-ink">{application.organization.legalName}</h3>
                <p className="mt-1 text-sm font-bold text-ink-3">{operatorLabel(application.organization.orgType)} · {operatorLabel(application.status)}</p>
              </div>
              <div className="mt-4 grid gap-2 text-sm font-bold text-ink-3 md:grid-cols-2">
                <p>사업자등록번호: <span className="text-ink">{application.organization.bizRegistrationNumber}</span></p>
                <p>대표자: <span className="text-ink">{application.organization.representativeName}</span></p>
                <p>담당자: <span className="text-ink">{application.contact.name}{application.contact.title ? ` (${application.contact.title})` : ""}</span></p>
                <p>연락처: <span className="text-ink">{application.contact.phone} · {application.contact.email}</span></p>
                <p>제안 공연: <span className="text-ink">{application.proposedEvent.title} · {operatorLabel(application.proposedEvent.category)}</span></p>
                <p>희망 공연장: <span className="text-ink">{application.proposedEvent.venueName}</span></p>
                <p>판매 형태: <span className="text-ink">{operatorLabel(application.saleTerms.channelType)}</span></p>
                <p>정산 계좌: <span className="text-ink">{application.saleTerms.settlement.bankName} {application.saleTerms.settlement.accountNumber} ({application.saleTerms.settlement.accountHolder})</span></p>
              </div>
              <div className="mt-3 grid gap-2 text-sm font-bold text-ink-3">
                <p>좌석 등급/가격: {application.proposedEvent.seatGrades.map((grade) => `${grade.gradeName} ${money(grade.price)}원×${grade.quantity}`).join(" · ")}</p>
                <p>공연 일정: {application.proposedEvent.sessions.map((session) => `${session.label ? `${session.label} ` : ""}${session.date} ${session.times.join(",")}`).join(" · ")}</p>
                {application.proposedEvent.discountPolicyNotes ? <p>할인 정책 제안: {application.proposedEvent.discountPolicyNotes}</p> : null}
                {application.saleTerms.requestedCommissionNotes ? <p>수수료/정산 조건 제안: {application.saleTerms.requestedCommissionNotes}</p> : null}
                {application.otherNotes ? <p>기타 요청사항: {application.otherNotes}</p> : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-3">
                <a className="text-sm font-black text-ticketground underline" href={application.organization.bizRegistrationDocDataUrl} rel="noreferrer" target="_blank">사업자등록증 확인</a>
                <a className="text-sm font-black text-ticketground underline" href={application.proposedEvent.posterImageDataUrl} rel="noreferrer" target="_blank">제안 포스터 확인</a>
              </div>

              {application.status === "PENDING" ? (
                <div className="mt-4 grid gap-4 border-t border-line pt-4 md:grid-cols-2" key={application.id}>
                  <div className="grid gap-3">
                    <h4 className="text-sm font-black text-ink">검증 체크리스트 (전부 확인해야 승인 가능)</h4>
                    <label className="flex items-center gap-2 text-sm font-bold text-ink"><input checked={checklist?.bizNumberVerified ?? false} onChange={(event) => toggleChecklistItem("bizNumberVerified", event.currentTarget.checked)} type="checkbox" />사업자등록번호 확인함</label>
                    <label className="flex items-center gap-2 text-sm font-bold text-ink"><input checked={checklist?.contactPhoneVerified ?? false} onChange={(event) => toggleChecklistItem("contactPhoneVerified", event.currentTarget.checked)} type="checkbox" />담당자 연락처 유선 확인함</label>
                    <label className="flex items-center gap-2 text-sm font-bold text-ink"><input checked={checklist?.eventAuthenticityChecked ?? false} onChange={(event) => toggleChecklistItem("eventAuthenticityChecked", event.currentTarget.checked)} type="checkbox" />공연 정보 진위 확인함</label>
                    <form className="grid gap-3" noValidate onSubmit={approve}>
                      <TextareaField label="검토 메모 (선택)" name="reviewNote" rows={2} />
                      <button className="h-10 rounded-lg bg-ink px-4 text-sm font-black text-on-ink disabled:bg-surface disabled:text-ink-3" disabled={!checklistComplete} type="submit">승인</button>
                      {!checklistComplete ? <p className="text-xs font-bold text-ink-3">체크리스트를 모두 확인해야 승인할 수 있습니다.</p> : null}
                    </form>
                  </div>
                  <form className="grid gap-3" noValidate onSubmit={reject}>
                    <h4 className="text-sm font-black text-ink">반려</h4>
                    <TextareaField label="반려 사유" name="reviewNote" rows={2} />
                    <button className="h-10 rounded-lg border border-ticketground px-4 text-sm font-black text-ticketground" type="submit">반려</button>
                  </form>
                </div>
              ) : (
                <div className="mt-4 rounded-lg border border-line bg-surface p-3 text-sm font-bold text-ink-3" key={application.id}>
                  {application.status === "APPROVED" ? (
                    <>
                      <p>승인 완료 — 판매자 계정을 발급하면 기업이 직접 로그인해 공연을 등록할 수 있고, 관리자가 대신 카탈로그 등록 도구에서 만들어줄 수도 있습니다.</p>
                      <Link className="mt-2 inline-block font-black text-ticketground underline" href={`/console/catalog?sourceApplicationId=${application.id}`}>카탈로그에 등록하기</Link>
                      <IssueSellerAccountForm applicationId={application.id} key={application.id} session={session} />
                    </>
                  ) : application.status === "REGISTERED" ? (
                    <p>카탈로그에 등록 완료됨 (이벤트 ID: {application.review.linkedEventId})</p>
                  ) : (
                    <p>반려됨 — 사유: {application.review.rejectionReason}</p>
                  )}
                </div>
              )}
            </>
          ) : <p className="text-sm font-bold text-ink-3">검토할 신청이 없습니다.</p>}
        </div>
      </div>
      <div className="mt-4"><Notice feedback={feedback} /></div>
    </WorkspacePanel>
  );
}

function SellerEventsWorkspace({ data, feedback, mutate, onLocalError }: { readonly data: SellerEventsWorkspace } & MutableWorkspaceProps) {
  const [selectedId, setSelectedId] = useState(data.events[0]?.id ?? "");
  const event = data.events.find((item) => item.id === selectedId) || data.events[0];

  const publish = (): void => {
    if (!event) return;
    void mutate(`/api/admin/seller-events/${event.id}/publish`, {}, `${event.title} 공연이 공개되었습니다.`);
  };

  const reject = (formEvent: FormEvent<HTMLFormElement>): void => {
    formEvent.preventDefault();
    if (!event) return;
    const form = formEvent.currentTarget;
    const reviewNote = valueFromForm(form, "reviewNote");
    if (!reviewNote) {
      onLocalError?.("반려 사유를 입력해주세요.");
      focusInput(form, "reviewNote");
      return;
    }
    void mutate(`/api/admin/seller-events/${event.id}/reject`, { reviewNote }, `${event.title} 공연을 반려했습니다.`);
  };

  return (
    <WorkspacePanel>
      <div className="border-b border-line pb-3">
        <h2 className="text-base font-black">기업 등록 공연 검토</h2>
        <p className="mt-1 text-sm font-bold text-ink-3">검토 대기 {data.events.length.toLocaleString("ko-KR")}건</p>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(240px,360px)_minmax(0,1fr)]">
        <div className="grid content-start gap-2">
          {data.events.map((item) => (
            <button className={`rounded-lg border p-3 text-left ${event?.id === item.id ? "border-ink bg-surface" : "border-line bg-background"}`} key={item.id} onClick={() => setSelectedId(item.id)} type="button">
              <span className="block text-sm font-black text-ink">{item.title}</span>
              <span className="mt-1 block text-xs font-bold text-ink-3">{operatorLabel(item.category)} · {item.venue}</span>
            </button>
          ))}
          {data.events.length ? null : <p className="rounded-lg border border-line p-3 text-sm font-bold text-ink-3">검토할 공연이 없습니다.</p>}
        </div>
        <div className="min-w-0 rounded-lg border border-line p-4">
          {event ? (
            <div key={event.id}>
              <h3 className="text-base font-black text-ink">{event.title}</h3>
              <p className="mt-1 text-sm font-bold text-ink-3">{operatorLabel(event.category)} · {event.venue} · {event.date.slice(0, 10)}</p>
              <p className="mt-2 text-sm font-bold text-ink-3">등록 티켓 {money(event.ticketCount)}장 · 판매 {money(event.soldCount)}장</p>
              <div className="mt-4 grid gap-4 border-t border-line pt-4 md:grid-cols-2">
                <div className="grid gap-3">
                  <h4 className="text-sm font-black text-ink">공개 승인</h4>
                  <p className="text-sm font-bold text-ink-3">공개 카탈로그와 홈, 검색에 즉시 노출됩니다.</p>
                  <button className="h-10 rounded-lg bg-ok px-4 text-sm font-black text-white" onClick={publish} type="button">게시 승인</button>
                </div>
                <form className="grid gap-3" noValidate onSubmit={reject}>
                  <h4 className="text-sm font-black text-ink">반려</h4>
                  <TextareaField label="반려 사유" name="reviewNote" rows={2} />
                  <button className="h-10 rounded-lg border border-ticketground px-4 text-sm font-black text-ticketground" type="submit">반려</button>
                </form>
              </div>
            </div>
          ) : <p className="text-sm font-bold text-ink-3">검토할 공연을 선택해주세요.</p>}
        </div>
      </div>
      <div className="mt-4"><Notice feedback={feedback} /></div>
    </WorkspacePanel>
  );
}
