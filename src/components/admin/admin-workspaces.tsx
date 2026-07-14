import { CalendarPlus, Ticket, UsersRound } from "lucide-react";
import type { ChangeEvent, FormEvent } from "react";
import { useState } from "react";
import {
  Field,
  hasEvents,
  hasSupportThreads,
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
  saleStates,
  supportStatuses,
  ticketStatuses,
  userStatuses,
  type AccountsWorkspace,
  type AclWorkspaceData,
  type AdmissionWorkspace,
  type AdminSession,
  type AdminTicket,
  type AuditWorkspace,
  type CatalogWorkspace,
  type Feedback,
  type InventoryWorkspace,
  type Mutation,
  type OverviewWorkspace,
  type ResaleWorkspace,
  type SupportWorkspace,
  type WorkspaceData,
} from "./console-types";
import { operatorLabel } from "./console-types";
import type { WorkspaceKey } from "./console-workspaces";

type WorkspaceProps = {
  readonly workspace: WorkspaceKey;
  readonly data: WorkspaceData | null;
  readonly feedback: Feedback;
  readonly mutate: Mutation;
  readonly session: AdminSession;
  readonly visibleTickets: readonly AdminTicket[];
  readonly onLocalError: (message: string) => void;
};

function focusInput(form: HTMLFormElement, name: string): void {
  const field = form.elements.namedItem(name);
  if (field instanceof HTMLInputElement) field.focus();
}

export function WorkspaceContent(props: WorkspaceProps) {
  const { workspace, data, feedback, mutate, session, visibleTickets, onLocalError } = props;
  if (!data) return <WorkspacePanel><p aria-live="polite" className="text-sm font-bold text-ticketground">작업공간 데이터를 불러오지 못했습니다.</p></WorkspacePanel>;
  if (workspace === "overview" && "stats" in data) return <OverviewWorkspace data={data} />;
  if (workspace === "catalog" && hasEvents(data)) return <CatalogWorkspace data={data} feedback={feedback} mutate={mutate} onLocalError={onLocalError} />;
  if (workspace === "sales" && hasEvents(data)) return <SalesWorkspace data={data} feedback={feedback} mutate={mutate} onLocalError={onLocalError} />;
  if (workspace === "inventory" && hasTickets(data)) return <InventoryWorkspace feedback={feedback} mutate={mutate} visibleTickets={visibleTickets} />;
  if (workspace === "accounts" && hasUsers(data)) return <AccountsWorkspace data={data} feedback={feedback} mutate={mutate} />;
  if (workspace === "support" && hasSupportThreads(data)) return <SupportWorkspace data={data} feedback={feedback} mutate={mutate} onLocalError={onLocalError} />;
  if (workspace === "resale" && "resalePools" in data) return <ResaleWorkspace data={data} />;
  if (workspace === "admission" && "admissionCredentials" in data) return <AdmissionWorkspace data={data} />;
  if (workspace === "audit" && "ledger" in data) return <AuditWorkspace data={data} />;
  if (workspace === "acl" && "adminAccounts" in data) return <AclWorkspace data={data} feedback={feedback} mutate={mutate} onLocalError={onLocalError} session={session} />;
  return <WorkspacePanel><p aria-live="polite" className="text-sm font-bold text-ticketground">작업공간 데이터를 표시할 수 없습니다.</p></WorkspacePanel>;
}

function OverviewWorkspace({ data }: { readonly data: OverviewWorkspace }) {
  return <WorkspacePanel><div className="grid divide-y divide-line overflow-hidden sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4"><Stat label="전체 티켓" value={money(data.stats.totalTickets)} /><Stat label="판매 가능" value={money(data.stats.onSaleTickets)} /><Stat label="열린 문의" tone={data.stats.supportOpen ? "warn" : "default"} value={money(data.stats.supportOpen)} /><Stat label="감사 원장" tone={data.stats.ledgerVerified ? "ok" : "warn"} value={data.stats.ledgerVerified ? "정상" : "불일치"} /></div></WorkspacePanel>;
}

type MutableWorkspaceProps = { readonly feedback: Feedback; readonly mutate: Mutation; readonly onLocalError?: (message: string) => void };

function readImageFile(file: File): Promise<string> {
  if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(file.type)) return Promise.reject(new Error("포스터는 PNG, JPEG, WebP 파일만 등록할 수 있습니다."));
  if (file.size > 5 * 1024 * 1024) return Promise.reject(new Error("포스터 파일은 5MB 이하로 등록해주세요."));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("포스터 파일을 읽지 못했습니다.")));
    reader.addEventListener("error", () => reject(new Error("포스터 파일을 읽지 못했습니다.")));
    reader.readAsDataURL(file);
  });
}

function readPoster(form: HTMLFormElement): Promise<string> {
  const field = form.elements.namedItem("poster");
  if (!(field instanceof HTMLInputElement) || !field.files?.[0]) return Promise.reject(new Error("공연 포스터 이미지를 선택해주세요."));
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

function pricesFromForm(form: HTMLFormElement): { grade: string; seat: string; price: number }[] {
  return linesFromForm(form, "prices").map((line) => {
    const [grade, seat, price] = line.split(",").map((part) => part.trim());
    return { grade: grade || "", seat: seat || grade || "", price: Number(price) || 0 };
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
    let imageDataUrl: string;
    try {
      imageDataUrl = await readPoster(form);
    } catch (error) {
      onLocalError?.(error instanceof Error ? error.message : "포스터 이미지를 확인해주세요.");
      return;
    }
    await mutate("/api/admin/events/create", {
      title,
      category: valueFromForm(form, "category"),
      startsAt: valueFromForm(form, "startsAt"),
      venueId: valueFromForm(form, "venueId"),
      saleState: valueFromForm(form, "saleState"),
      saleNote: valueFromForm(form, "saleNote"),
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
      pinnedRank: pinnedRankFromForm(form),
      imageDataUrl,
    }, "신규 공연과 티켓이 생성되었습니다.");
  };
  return <WorkspacePanel><div className="flex items-center gap-2 border-b border-line pb-3"><CalendarPlus size={18} /><h2 className="text-base font-black">신규 공연/티켓 추가</h2></div><form className="mt-4 grid gap-3 md:grid-cols-2" noValidate onSubmit={submit}><Field label="공연명" name="title" required /><Field label="짧은 제목 (선택)" name="shortTitle" /><SelectField label="카테고리" name="category" defaultValue="concert" options={eventCategoryOptions} /><Field label="시작 일시" name="startsAt" defaultValue="2026-12-24T19:30:00+09:00" /><SelectField label="공연장" name="venueId" defaultValue={data.events[0]?.venueId} options={data.venues.map((venue) => ({ label: venue.name, value: venue.id }))} /><SelectField label="초기 판매 상태" name="saleState" defaultValue="OPEN_SOON" options={saleStates.map((value) => ({ label: operatorLabel(value), value }))} /><Field label="운영 메모" name="saleNote" defaultValue="관리자 초안" /><Field label="공연 기간 (선택)" name="period" placeholder="2026.12.24 ~ 2026.12.31" /><Field label="러닝타임 (선택)" name="runtime" placeholder="170분(인터미션 20분 포함)" /><Field label="관람 연령 (선택)" name="ageLimit" placeholder="전체 관람" /><Field label="배지 문구 (선택)" name="badge" placeholder="관리자 등록" /><Field label="아티스트 슬러그 (선택)" name="artistSlug" /><Field label="공연 슬러그 (선택, 영문/숫자/하이픈)" name="slug" /><Field label="고정 랭킹 1~10 (선택)" name="pinnedRank" type="number" /><label className="grid gap-1 text-sm font-bold text-ink-3 md:col-span-2">포스터 이미지<input accept="image/jpeg,image/png,image/webp" className="h-10 min-w-0 rounded-lg border border-line bg-background px-3 py-1 text-sm font-bold text-ink file:mr-3 file:rounded-md file:border-0 file:bg-surface file:px-2 file:py-1 file:text-sm file:font-bold" name="poster" onChange={handlePosterChange} required type="file" /></label>{posterPreview && <div className="md:col-span-2"><img alt="포스터 미리보기" className="h-48 w-36 rounded-lg border border-line object-cover" src={posterPreview} /></div>}<p className="-mt-1 text-xs font-bold text-ink-3 md:col-span-2">PNG, JPEG, WebP · 최대 5MB · 등록 후 공개 웹 공연 카드와 상세 페이지에 표시됩니다.</p><div className="md:col-span-2"><TextareaField defaultValue={"VIP,VIP석,154000\nR,R석,121000\nS,S석,99000"} hint="한 줄에 하나씩: 등급,좌석명,가격" label="좌석 가격" name="prices" rows={3} /></div><div className="md:col-span-2"><TextareaField defaultValue="1회차|2026-12-24|19:30" hint="한 줄에 하나씩: 회차명|날짜(YYYY-MM-DD)|시간1,시간2" label="공연 일정" name="schedules" rows={3} /></div><div className="md:col-span-2"><TextareaField hint="한 줄에 한 명씩 (선택)" label="출연진" name="casts" rows={3} /></div><div className="md:col-span-2"><TextareaField hint="한 줄에 하나씩 (선택)" label="유의사항" name="notices" rows={3} /></div><div className="md:col-span-2"><TextareaField hint="공연 소개 (선택, 최대 400자)" label="공연 소개" name="summary" rows={3} /></div><button className="h-10 rounded-lg bg-ink px-4 text-sm font-black text-on-ink md:col-span-2" type="submit">공연/티켓 생성</button></form><div className="mt-4"><Notice feedback={feedback} /></div></WorkspacePanel>;
}

function SalesWorkspace({ data, feedback, mutate, onLocalError }: { readonly data: CatalogWorkspace } & MutableWorkspaceProps) {
  const event = data.events[0];
  if (!event) return <WorkspacePanel><p className="text-sm font-bold text-ink-3">판매 설정할 공연이 없습니다.</p></WorkspacePanel>;
  const submit = (submission: FormEvent<HTMLFormElement>): void => {
    submission.preventDefault();
    const form = submission.currentTarget;
    const title = valueFromForm(form, "title");
    if (!title) {
      onLocalError?.("공연명을 입력해주세요.");
      focusInput(form, "title");
      return;
    }
    const prices = Object.fromEntries(event.zones.map((zone) => [zone.id, Number(valueFromForm(form, zone.id))]));
    void mutate("/api/admin/events/sale", { eventId: event.id, title, category: valueFromForm(form, "category"), startsAt: valueFromForm(form, "startsAt"), venueId: valueFromForm(form, "venueId"), saleState: valueFromForm(form, "saleState"), saleNote: valueFromForm(form, "saleNote"), discountRate: Number(valueFromForm(form, "discountRate")), pinnedRank: pinnedRankFromForm(form), prices }, "판매 설정이 갱신되었습니다.");
  };
  return <WorkspacePanel><div className="flex items-center gap-2 border-b border-line pb-3"><Ticket size={18} /><h2 className="text-base font-black">공연 판매 설정</h2></div><form className="mt-4 grid gap-3 lg:grid-cols-3" noValidate onSubmit={submit}><Field label="공연명" name="title" defaultValue={event.title} required /><SelectField label="카테고리" name="category" defaultValue={event.category} options={eventCategoryOptions} /><SelectField label="판매 상태" name="saleState" defaultValue={event.saleState} options={saleStates.map((value) => ({ label: operatorLabel(value), value }))} /><Field label="시작 일시" name="startsAt" defaultValue={event.date} /><SelectField label="공연장" name="venueId" defaultValue={event.venueId} options={data.venues.map((venue) => ({ label: venue.name, value: venue.id }))} /><Field label="할인율" name="discountRate" defaultValue={event.discountRate || 0} type="number" /><Field label="운영 메모" name="saleNote" defaultValue={event.saleNote || ""} /><Field label="고정 랭킹 1~10 (선택, 비우면 자동 랭킹)" name="pinnedRank" defaultValue={event.pinnedRank ?? undefined} type="number" />{event.zones.map((zone) => <Field defaultValue={zone.faceValue} key={zone.id} label={`${zone.name} 가격`} name={zone.id} type="number" />)}<button className="h-10 rounded-lg bg-ticketground px-4 text-sm font-black text-on-ink lg:col-span-3" type="submit">판매 설정 저장</button></form><div className="mt-4"><Notice feedback={feedback} /></div></WorkspacePanel>;
}

function InventoryWorkspace({ feedback, mutate, visibleTickets }: { readonly data?: InventoryWorkspace } & MutableWorkspaceProps & { readonly visibleTickets: readonly AdminTicket[] }) {
  return <WorkspacePanel><h2 className="text-base font-black">티켓 재고 상태</h2><form className="mt-4 grid gap-3 md:grid-cols-3" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; void mutate("/api/admin/tickets/status", { ticketId: valueFromForm(form, "ticketId"), status: valueFromForm(form, "status") }, "티켓 재고 상태가 갱신되었습니다."); }}><SelectField label="티켓" name="ticketId" defaultValue={visibleTickets[0]?.id} options={visibleTickets.map((ticket) => ({ label: `${ticket.seatLabel} · ${operatorLabel(ticket.status)} · ${money(ticket.faceValue)}원`, value: ticket.id }))} /><SelectField label="상태" name="status" defaultValue="ADMIN_HOLD" options={ticketStatuses.map((value) => ({ label: operatorLabel(value), value }))} /><button className="h-10 self-end rounded-lg bg-ink px-4 text-sm font-black text-on-ink" type="submit">재고 상태 저장</button></form><div className="mt-4"><Notice feedback={feedback} /></div></WorkspacePanel>;
}

function AccountsWorkspace({ data, feedback, mutate }: { readonly data: AccountsWorkspace } & MutableWorkspaceProps) {
  return <WorkspacePanel><h2 className="text-base font-black">회원/계정 상태</h2><form className="mt-4 grid gap-3 md:grid-cols-3" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; void mutate("/api/admin/users/status", { userId: valueFromForm(form, "userId"), status: valueFromForm(form, "status"), reason: valueFromForm(form, "reason") }, "계정 상태가 갱신되었습니다."); }}><SelectField label="회원" name="userId" defaultValue={data.users[0]?.id} options={data.users.map((user) => ({ label: `${user.name} · ${operatorLabel(user.status)} · 신뢰도 ${user.trustScore}`, value: user.id }))} /><SelectField label="상태" name="status" defaultValue="WATCHLIST" options={userStatuses.map((value) => ({ label: operatorLabel(value), value }))} /><Field label="사유" name="reason" defaultValue="운영 콘솔 검토" /><button className="h-10 rounded-lg bg-ink px-4 text-sm font-black text-on-ink md:col-span-3" type="submit">계정 상태 저장</button></form><div className="mt-4"><Notice feedback={feedback} /></div></WorkspacePanel>;
}

function SupportWorkspace({ data, feedback, mutate, onLocalError }: { readonly data: SupportWorkspace } & MutableWorkspaceProps) {
  const thread = data.supportThreads.find((item) => item.status !== "CLOSED") || data.supportThreads[0];
  if (!thread) return <WorkspacePanel><p className="text-sm font-bold text-ink-3">처리할 문의가 없습니다.</p></WorkspacePanel>;
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const form = event.currentTarget;
    const message = valueFromForm(form, "message");
    if (!message) {
      onLocalError?.("답변을 입력해주세요.");
      focusInput(form, "message");
      return;
    }
    void (async () => {
      const replied = await mutate("/api/admin/support/messages", { threadId: thread.id, message }, "");
      if (replied) await mutate("/api/admin/support/status", { threadId: thread.id, status: valueFromForm(form, "status") }, "문의 답변과 상태가 갱신되었습니다.");
    })();
  };
  return <WorkspacePanel><h2 className="text-base font-black">문의 답변/상태</h2><p className="mt-3 border-y border-line py-2 text-sm font-bold text-ink-3">{thread.subject || thread.id} · {operatorLabel(thread.status)}</p><form className="mt-4 grid gap-3 md:grid-cols-2" noValidate onSubmit={submit}><Field label="답변" name="message" defaultValue="운영자 확인 후 처리했습니다." /><SelectField label="처리 상태" name="status" defaultValue="ANSWERED" options={supportStatuses.map((value) => ({ label: operatorLabel(value), value }))} /><button className="h-10 rounded-lg bg-ink px-4 text-sm font-black text-on-ink md:col-span-2" type="submit">문의 답변 등록</button></form><div className="mt-4"><Notice feedback={feedback} /></div></WorkspacePanel>;
}

function ResaleWorkspace({ data }: { readonly data: ResaleWorkspace }) { return <WorkspacePanel><h2 className="text-base font-black">재판매/양도 현황</h2><dl className="mt-4 grid gap-3 text-sm font-bold text-ink-3 sm:grid-cols-2"><div><dt>열린 재판매 풀</dt><dd className="mt-1 text-xl text-ink">{data.resalePools.filter((pool) => pool.status === "OPEN").length}건</dd></div><div><dt>관심 알림</dt><dd className="mt-1 text-xl text-ink">{data.watchlist.length}건</dd></div><div><dt>알림 작업</dt><dd className="mt-1 text-xl text-ink">{data.notificationJobs.length}건</dd></div><div><dt>운영 알림</dt><dd className="mt-1 text-xl text-ink">{data.operatorAlerts.length}건</dd></div></dl><p className="mt-5 border-t border-line pt-3 text-sm font-bold text-ink-3">현재 백엔드에 운영 변경 기능이 없어 이 작업공간은 읽기 전용입니다.</p></WorkspacePanel>; }
function AdmissionWorkspace({ data }: { readonly data: AdmissionWorkspace }) { const risks = data.admissionCredentials.filter((item) => item.riskStatus && item.riskStatus !== "CLEAR").length; return <WorkspacePanel><h2 className="text-base font-black">입장/QR 현황</h2><dl className="mt-4 grid gap-3 text-sm font-bold text-ink-3 sm:grid-cols-2"><div><dt>입장 자격</dt><dd className="mt-1 text-xl text-ink">{data.admissionCredentials.length}건</dd></div><div><dt>현장 리스크</dt><dd className={`mt-1 text-xl ${risks ? "text-warn" : "text-ok"}`}>{risks}건</dd></div></dl><p className="mt-5 border-t border-line pt-3 text-sm font-bold text-ink-3">현재 백엔드에 운영 변경 기능이 없어 이 작업공간은 읽기 전용입니다.</p></WorkspacePanel>; }
function AuditWorkspace({ data }: { readonly data: AuditWorkspace }) { return <WorkspacePanel><div className="flex items-center justify-between gap-3"><h2 className="text-base font-black">감사 원장</h2><span className={`text-sm font-black ${data.ledgerCheck.ok ? "text-ok" : "text-warn"}`}>{data.ledgerCheck.ok ? "원장 검증 정상" : "원장 검증 불일치"}</span></div><div className="mt-4 divide-y divide-line border-y border-line">{data.ledger.map((entry) => <div className="flex items-center justify-between gap-3 py-3 text-sm" key={entry.id}><span className="font-bold text-ink">{entry.action}</span><time className="shrink-0 text-xs font-bold text-ink-3">{entry.at}</time></div>)}</div></WorkspacePanel>; }
function RoleFields({ roles, selected = [] }: { readonly roles: readonly { readonly key: string; readonly name: string }[]; readonly selected?: readonly string[] }) {
  return <fieldset className="grid gap-2 rounded-lg border border-line p-3"><legend className="px-1 text-sm font-bold text-ink-3">관리자 역할</legend><div className="flex flex-wrap gap-3">{roles.map((role) => <label className="inline-flex items-center gap-2 text-sm font-bold text-ink" key={role.key}><input defaultChecked={selected.includes(role.key)} name="roleKeys" type="checkbox" value={role.key} />{role.name}</label>)}</div></fieldset>;
}

function AclWorkspace({ data, feedback, mutate, onLocalError, session }: { readonly data: AclWorkspaceData; readonly session: AdminSession } & MutableWorkspaceProps) {
  const canManage = session.admin.permissions.includes("acl.manage");
  const create = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const form = event.currentTarget;
    const roleKeys = valuesFromForm(form, "roleKeys");
    if (!roleKeys.length) return onLocalError?.("관리자 역할을 하나 이상 선택해주세요.");
    void mutate("/api/admin/admin-accounts", { username: valueFromForm(form, "username"), password: valueFromForm(form, "password"), roleKeys, ipAllowlist: ipAllowlistFromForm(form) }, "관리자 계정이 생성되었습니다.");
  };
  return <div className="grid gap-4">{canManage ? <WorkspacePanel><div className="flex items-center gap-2 border-b border-line pb-3"><UsersRound size={18} /><h2 className="text-base font-black">관리자 계정 추가</h2></div><form className="mt-4 grid gap-3 md:grid-cols-2" noValidate onSubmit={create}><Field label="관리자 아이디" name="username" required /><Field label="초기 비밀번호" name="password" required type="password" /><RoleFields roles={session.roles} /><label className="grid gap-1 text-sm font-bold text-ink-3">IP ACL<textarea className="min-h-24 rounded-lg border border-line bg-background p-3 text-sm font-bold text-ink" name="ipAllowlist" placeholder={"203.0.113.20\n198.51.100.0/24"} /></label><p className="-mt-1 text-xs font-bold text-ink-3 md:col-span-2">비워두면 모든 IP를 허용합니다. IPv4 주소 또는 CIDR을 줄바꿈이나 쉼표로 구분하세요.</p><button className="h-10 rounded-lg bg-ink px-4 text-sm font-black text-on-ink md:col-span-2" type="submit">관리자 계정 생성</button></form></WorkspacePanel> : <WorkspacePanel><p className="text-sm font-bold text-ink-3">이 계정은 관리자와 ACL을 조회할 수 있지만 변경할 권한은 없습니다.</p></WorkspacePanel>}<WorkspacePanel><h2 className="text-base font-black">등록된 관리자</h2><div className="mt-4 grid gap-4">{data.adminAccounts.length ? data.adminAccounts.map((account) => account.bootstrap ? <div className="rounded-lg border border-ticketground/30 bg-ticketground/5 p-4" key={account.id}><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-black text-ink">{account.username}</p><span className="rounded-full bg-ticketground px-2 py-1 text-xs font-black text-on-ink">환경변수 관리자</span></div><p className="mt-1 text-sm font-bold text-ink-3">{account.roleKeys.map((key) => session.roles.find((role) => role.key === key)?.name || key).join(", ")}</p><p className="mt-1 text-xs font-bold text-ink-3">로그인 계정은 서버 환경변수로 관리되며 이 화면에서 역할과 ACL을 수정할 수 없습니다.</p></div> : canManage ? <form className="grid gap-3 rounded-lg border border-line p-4 md:grid-cols-2" key={account.id} onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const roleKeys = valuesFromForm(form, "roleKeys"); if (!roleKeys.length) return onLocalError?.("관리자 역할을 하나 이상 선택해주세요."); void mutate("/api/admin/admin-accounts/update", { adminId: account.id, roleKeys, ipAllowlist: ipAllowlistFromForm(form), active: valueFromForm(form, "active") === "true" }, "관리자 계정 설정이 저장되었습니다."); }}><div><p className="font-black text-ink">{account.username}</p><p className="mt-1 text-xs font-bold text-ink-3">{account.id}</p></div><SelectField defaultValue={String(account.active)} label="상태" name="active" options={[{ label: "활성", value: "true" }, { label: "비활성", value: "false" }]} /><RoleFields roles={session.roles} selected={account.roleKeys} /><label className="grid gap-1 text-sm font-bold text-ink-3">IP ACL<textarea className="min-h-24 rounded-lg border border-line bg-background p-3 text-sm font-bold text-ink" defaultValue={account.ipAllowlist.join("\n")} name="ipAllowlist" /></label><button className="h-10 rounded-lg bg-ticketground px-4 text-sm font-black text-on-ink md:col-span-2" type="submit">계정/ACL 저장</button></form> : <div className="rounded-lg border border-line p-4" key={account.id}><p className="font-black text-ink">{account.username}</p><p className="mt-1 text-sm font-bold text-ink-3">{account.roleKeys.map((key) => session.roles.find((role) => role.key === key)?.name || key).join(", ")}</p><p className="mt-1 text-xs font-bold text-ink-3">{account.active ? "활성" : "비활성"} · {account.ipAllowlist.length ? account.ipAllowlist.join(", ") : "모든 IP 허용"}</p></div>) : <p className="text-sm font-bold text-ink-3">등록된 별도 관리자 계정이 없습니다.</p>}</div><div className="mt-4"><Notice feedback={feedback} /></div></WorkspacePanel></div>;
}
