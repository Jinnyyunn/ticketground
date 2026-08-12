import { BellRing, CalendarClock, CircleDollarSign, History, KeyRound, QrCode, ShieldCheck, Smartphone } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { Field, money, Notice, SelectField, TextareaField, valueFromForm, WorkspacePanel } from "./console-primitives";
import { hasPermission, operatorLabel, type AdminSession, type Feedback, type MobileWorkspace, type Mutation } from "./console-types";

type Props = {
  readonly data: MobileWorkspace;
  readonly feedback: Feedback;
  readonly mutate: Mutation;
  readonly session: AdminSession;
};

function dateTimeInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function dateTimeValue(form: HTMLFormElement, name: string): string | null {
  const value = valueFromForm(form, name);
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function dateLabel(value: string | null | undefined): string {
  if (!value) return "미설정";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(date) : value;
}

function SectionHeading({ icon, title, description }: { readonly icon: ReactNode; readonly title: string; readonly description: string }) {
  return <div className="flex items-start gap-3 border-b border-line pb-3"><span className="mt-0.5 text-ticketground">{icon}</span><div><h2 className="text-base font-black text-ink">{title}</h2><p className="mt-1 text-xs font-bold leading-relaxed text-ink-3">{description}</p></div></div>;
}

function Empty({ children }: { readonly children: ReactNode }) {
  return <p className="rounded-lg bg-surface px-3 py-4 text-sm font-bold text-ink-3">{children}</p>;
}

export function MobileAdminWorkspace({ data, feedback, mutate, session }: Props) {
  const retryKeys = useRef(new Map<string, string>());
  const canRelease = hasPermission(session, "mobile.release.manage");
  const canMessage = hasPermission(session, "mobile.messaging.manage");
  const canSecure = hasPermission(session, "mobile.security.manage");
  const canReviewCancellation = hasPermission(session, "mobile.cancellation.manage");
  const canReadFinance = hasPermission(session, "mobile.finance.read");
  const runMutation = async (scope: string, path: string, body: Record<string, unknown>, success: string): Promise<void> => {
    const idempotencyKey = retryKeys.current.get(scope) || `${scope}-${crypto.randomUUID()}`;
    retryKeys.current.set(scope, idempotencyKey);
    if (await mutate(path, { ...body, idempotencyKey }, success)) retryKeys.current.delete(scope);
  };

  return <div className="grid gap-4">
    <div className="grid gap-4 xl:grid-cols-2">
      <WorkspacePanel>
        <SectionHeading icon={<Smartphone size={19} />} title="앱 버전 정책" description="최소 지원 버전과 권장 업데이트 버전을 플랫폼별로 운영합니다." />
        <div className="mt-4 grid gap-4">
          {data.releasePolicies.map((policy) => <form className="grid gap-3 rounded-lg border border-line p-4 sm:grid-cols-2" key={policy.platform} onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            void runMutation(`release-${policy.platform}`, "/api/admin/mobile/release-policy", {
              platform: policy.platform,
              minimumVersion: valueFromForm(form, "minimumVersion"),
              recommendedVersion: valueFromForm(form, "recommendedVersion"),
              storeUrl: valueFromForm(form, "storeUrl"),
            }, `${policy.platform.toUpperCase()} 버전 정책을 저장했습니다.`);
          }}>
            <div className="sm:col-span-2"><strong className="text-sm font-black uppercase text-ink">{policy.platform}</strong><span className="ml-2 text-xs font-bold text-ink-3">최근 변경 {dateLabel(policy.updatedAt)}</span></div>
            <Field defaultValue={policy.minimumVersion} label="최소 지원 버전" name="minimumVersion" required />
            <Field defaultValue={policy.recommendedVersion} label="권장 버전" name="recommendedVersion" required />
            <div className="sm:col-span-2"><Field defaultValue={policy.storeUrl} label="스토어 HTTPS URL" name="storeUrl" required /></div>
            <button className="h-10 rounded-lg bg-ink px-4 text-sm font-black text-on-ink disabled:bg-surface disabled:text-ink-3 sm:col-span-2" disabled={!canRelease} type="submit">버전 정책 저장</button>
          </form>)}
        </div>
      </WorkspacePanel>

      <WorkspacePanel>
        <SectionHeading icon={<CalendarClock size={19} />} title="점검 공지" description="앱 홈에 노출할 점검 기간과 안내 문구를 관리합니다." />
        <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          void runMutation("maintenance", "/api/admin/mobile/maintenance", {
            enabled: new FormData(form).get("enabled") === "on",
            title: valueFromForm(form, "title"),
            message: valueFromForm(form, "message"),
            startsAt: dateTimeValue(form, "startsAt"),
            endsAt: dateTimeValue(form, "endsAt"),
          }, "앱 점검 공지를 저장했습니다.");
        }}>
          <label className="flex min-h-10 items-center gap-2 rounded-lg border border-line px-3 text-sm font-bold text-ink sm:col-span-2"><input defaultChecked={data.maintenance.enabled} name="enabled" type="checkbox" />앱 점검 공지 활성화</label>
          <div className="sm:col-span-2"><Field defaultValue={data.maintenance.title} label="공지 제목" name="title" required /></div>
          <div className="sm:col-span-2"><TextareaField defaultValue={data.maintenance.message} label="공지 내용" name="message" rows={3} /></div>
          <Field defaultValue={dateTimeInput(data.maintenance.startsAt)} label="시작" name="startsAt" type="datetime-local" />
          <Field defaultValue={dateTimeInput(data.maintenance.endsAt)} label="종료" name="endsAt" type="datetime-local" />
          <button className="h-10 rounded-lg bg-ink px-4 text-sm font-black text-on-ink disabled:bg-surface disabled:text-ink-3 sm:col-span-2" disabled={!canRelease} type="submit">점검 공지 저장</button>
        </form>
      </WorkspacePanel>
    </div>

    <WorkspacePanel>
      <SectionHeading icon={<BellRing size={19} />} title="푸시 캠페인" description="수신 대상과 예약 시간을 확정한 뒤 전송 대기열에 등록합니다. 기기 토큰은 화면에 노출하지 않습니다." />
      <form className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4" onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        void runMutation("push", "/api/admin/mobile/push-campaigns", {
          title: valueFromForm(form, "title"),
          message: valueFromForm(form, "message"),
          audience: valueFromForm(form, "audience"),
          scheduledAt: dateTimeValue(form, "scheduledAt"),
        }, "푸시 캠페인을 예약했습니다.");
      }}>
        <Field label="제목" name="title" required />
        <SelectField label="대상" name="audience" options={[{ label: "전체 사용자", value: "ALL" }, { label: "관심공연 사용자", value: "WATCHLIST" }, { label: "티켓 보유자", value: "TICKET_HOLDERS" }]} />
        <Field label="예약 시간" name="scheduledAt" type="datetime-local" required />
        <button className="h-10 self-end rounded-lg bg-ticketground px-4 text-sm font-black text-on-ink disabled:bg-surface disabled:text-ink-3" disabled={!canMessage} type="submit">캠페인 예약</button>
        <div className="md:col-span-2 xl:col-span-4"><TextareaField label="메시지" name="message" rows={2} /></div>
      </form>
      <div className="mt-4 grid gap-2 lg:grid-cols-2">{data.pushCampaigns.length ? data.pushCampaigns.map((campaign) => <div className="rounded-lg border border-line p-3" key={campaign.id}><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm font-black text-ink">{campaign.title}</strong><span className="rounded-full bg-surface px-2 py-1 text-xs font-black text-ink-3">{operatorLabel(campaign.status)}</span></div><p className="mt-2 text-sm font-bold text-ink-3">{campaign.message}</p><p className="mt-2 text-xs font-bold text-ink-4">{campaign.audience} · {dateLabel(campaign.scheduledAt)}</p></div>) : <Empty>예약된 푸시 캠페인이 없습니다.</Empty>}</div>
    </WorkspacePanel>

    <div className="grid gap-4 xl:grid-cols-2">
      <WorkspacePanel>
        <SectionHeading icon={<KeyRound size={19} />} title="신뢰 기기" description="사용자 식별용 원본 기기 ID와 토큰은 숨기고 운영 식별자만 제공합니다." />
        <div className="mt-4 grid gap-3">{data.trustedDevices.length ? data.trustedDevices.map((device) => <div className="rounded-lg border border-line p-3" key={device.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><strong className="text-sm font-black text-ink">{device.deviceName}</strong><p className="mt-1 text-xs font-bold text-ink-3">{device.userName} · {device.platform} · 최근 확인 {dateLabel(device.lastVerifiedAt)}</p>{device.revokeReason ? <p className="mt-1 text-xs font-bold text-ticketground">해제 사유: {device.revokeReason}</p> : null}</div><span className="rounded-full bg-surface px-2 py-1 text-xs font-black text-ink-3">{operatorLabel(device.status)}</span></div>{device.status !== "REVOKED" && canSecure ? <form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const reason = valueFromForm(form, "reason"); if (!reason || !window.confirm(`${device.deviceName} 신뢰를 해제하시겠습니까?`)) return; void runMutation(`device-revoke-${device.id}`, "/api/admin/mobile/devices/revoke", { deviceId: device.id, reason }, "신뢰 기기를 해제했습니다."); }}><input aria-label={`${device.deviceName} 해제 사유`} className="h-9 min-w-0 flex-1 rounded-lg border border-line px-3 text-sm font-bold" name="reason" placeholder="해제 사유" /><button className="h-9 rounded-lg border border-ticketground px-3 text-sm font-black text-ticketground" type="submit">신뢰 해제</button></form> : null}</div>) : <Empty>등록된 신뢰 기기가 없습니다.</Empty>}</div>
      </WorkspacePanel>

      <WorkspacePanel>
        <SectionHeading icon={<QrCode size={19} />} title="입장 QR 감사" description="서명·nonce 없이 추적 코드와 발급 상태만 조회합니다." />
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead className="text-xs font-black text-ink-3"><tr><th className="pb-2">티켓</th><th className="pb-2">채널</th><th className="pb-2">추적 코드</th><th className="pb-2">발급</th><th className="pb-2">상태</th></tr></thead><tbody className="divide-y divide-line">{data.qrAudit.map((entry) => <tr key={entry.id}><td className="py-3 font-bold">{entry.ticketId}</td><td className="py-3">{entry.channel}</td><td className="py-3">{entry.traceCode || "-"}</td><td className="py-3">{dateLabel(entry.issuedAt)}</td><td className="py-3 font-black">{operatorLabel(entry.status)}</td></tr>)}</tbody></table>{!data.qrAudit.length ? <Empty>최근 QR 발급 기록이 없습니다.</Empty> : null}</div>
      </WorkspacePanel>
    </div>

    <WorkspacePanel>
      <SectionHeading icon={<ShieldCheck size={19} />} title="취소 요청 검토" description="승인은 환불 대기 상태만 생성하며 결제를 자동 환불하지 않습니다." />
      <div className="mt-4 grid gap-3">{data.cancellationRequests.length ? data.cancellationRequests.map((request) => <article className="rounded-lg border border-line p-4" key={request.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-black text-ink">{request.eventTitle} · {request.seatLabel}</h3><p className="mt-1 text-sm font-bold text-ink-3">{request.userName} · {request.reason}</p><p className="mt-1 text-xs font-bold text-ink-4">{dateLabel(request.createdAt)} · 환불 {operatorLabel(request.refundStatus)}</p></div><span className="rounded-full bg-surface px-2 py-1 text-xs font-black text-ink-3">{operatorLabel(request.status)}</span></div>{request.status === "PENDING_REVIEW" && canReviewCancellation ? <form className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]" onSubmit={(event) => { event.preventDefault(); }}><input aria-label={`${request.eventTitle} 검토 메모`} className="h-9 min-w-0 rounded-lg border border-line px-3 text-sm font-bold" name="reviewNote" placeholder="검토 메모" /><button className="h-9 rounded-lg border border-line px-3 text-sm font-black" onClick={(event) => { const form = event.currentTarget.form; if (!form) return; const reviewNote = valueFromForm(form, "reviewNote"); if (!reviewNote) return; void runMutation(`cancel-reject-${request.id}`, "/api/admin/mobile/cancellations/review", { cancellationRequestId: request.id, decision: "REJECTED", reviewNote }, "취소 요청을 반려했습니다."); }} type="button">반려</button><button className="h-9 rounded-lg bg-ticketground px-3 text-sm font-black text-on-ink" onClick={(event) => { const form = event.currentTarget.form; if (!form) return; const reviewNote = valueFromForm(form, "reviewNote"); if (!reviewNote || !window.confirm("취소 요청을 승인하고 환불 운영 대기로 전환하시겠습니까?")) return; void runMutation(`cancel-approve-${request.id}`, "/api/admin/mobile/cancellations/review", { cancellationRequestId: request.id, decision: "APPROVED", reviewNote }, "취소 요청을 승인했습니다. 환불은 별도 운영이 필요합니다."); }} type="button">승인</button></form> : request.reviewNote ? <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-sm font-bold text-ink-3">검토 메모: {request.reviewNote}</p> : null}</article>) : <Empty>검토할 취소 요청이 없습니다.</Empty>}</div>
    </WorkspacePanel>

    <WorkspacePanel>
      <SectionHeading icon={<CircleDollarSign size={19} />} title="결제·환불 대사" description="앱 결제 금액과 상태를 조회합니다. 환불 실행은 보안 권한이 있는 기존 정산 경로에서만 처리합니다." />
      {!canReadFinance ? <Empty>결제·환불 조회 권한이 없습니다.</Empty> : <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="text-xs font-black text-ink-3"><tr><th className="pb-2">거래</th><th className="pb-2">티켓</th><th className="pb-2">수단</th><th className="pb-2">상태</th><th className="pb-2 text-right">금액</th><th className="pb-2">일시</th></tr></thead><tbody className="divide-y divide-line">{data.payments.map((payment) => <tr key={payment.id}><td className="py-3 font-bold">{payment.id}</td><td className="py-3">{payment.ticketId}</td><td className="py-3">{operatorLabel(payment.method)}</td><td className="py-3 font-black">{operatorLabel(payment.status)}</td><td className="py-3 text-right font-black">{money(payment.amount)}원</td><td className="py-3">{dateLabel(payment.createdAt)}</td></tr>)}</tbody></table>{!data.payments.length ? <Empty>최근 앱 결제가 없습니다.</Empty> : null}</div>}
    </WorkspacePanel>

    <WorkspacePanel>
      <SectionHeading icon={<History size={19} />} title="앱 운영 감사 기록" description="앱 운영 변경 이력을 해시 체인 원장에 남기며 최근 50건의 작업자와 시각을 조회합니다." />
      <div className="mt-4 grid gap-2">{data.audit.length ? data.audit.map((entry) => <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-3" key={entry.index}><div><strong className="text-sm font-black text-ink">{operatorLabel(entry.action)}</strong><p className="mt-1 text-xs font-bold text-ink-3">작업자 {entry.actorId}</p></div><time className="text-xs font-bold text-ink-4" dateTime={entry.at}>{dateLabel(entry.at)}</time></div>) : <Empty>앱 운영 변경 기록이 없습니다.</Empty>}</div>
    </WorkspacePanel>

    <Notice feedback={feedback} />
  </div>;
}
