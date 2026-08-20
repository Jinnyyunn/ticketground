"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { getTicketShowBackendEventId, getTicketShowPerformanceDateId } from "@/data/ticketing-backend-events";
import { currency } from "@/data/ticketing";
import {
  buyTicket,
  buyTickets,
  getIdentityStatus,
  getState,
  getTosspaymentsConfig,
  mockCompleteNiceIdentityVerification,
  startNiceIdentityVerification,
  storedSessionUserId,
  TicketgroundApiError,
  type ApiIdentityStatus,
  type ApiTosspaymentsConfig,
} from "@/lib/ticketground-api";
import type { TicketShow } from "@/types";

const paymentMethods = [
  { id: "credit", label: "신용카드", note: "카드사 할인 적용", paymentMethod: "CREDIT_CARD" },
  { id: "simple", label: "간편결제", note: "카카오페이·네이버페이", paymentMethod: "SIMPLE_PAY" },
  { id: "bank", label: "계좌이체", note: "실시간 출금", paymentMethod: "BANK_TRANSFER" },
  { id: "mobile", label: "휴대폰 결제", note: "통신사 한도 확인", paymentMethod: "MOBILE" },
  { id: "deposit", label: "무통장입금", note: "입금대기 후 확정", paymentMethod: "BANK_DEPOSIT" },
] as const;

const serviceFeePerSeat = 2000;

type TossPaymentsWidgets = {
  readonly setAmount: (amount: { value: number; currency: "KRW" }) => Promise<void>;
  readonly renderPaymentMethods: (options: { selector: string }) => Promise<unknown>;
  readonly renderAgreement: (options: { selector: string }) => Promise<unknown>;
  readonly requestPayment: (options: {
    orderId: string;
    orderName: string;
    successUrl: string;
    failUrl: string;
  }) => Promise<void>;
};

type TossPaymentsSdk = {
  readonly widgets: (options: { customerKey: string }) => TossPaymentsWidgets;
};

declare global {
  interface Window {
    readonly TossPayments?: (clientKey: string) => TossPaymentsSdk;
  }
}

// TossPayments requires an unpredictable customerKey (never the raw account
// userId) - a random id, generated once per browser and reused after that.
function tossCustomerKey(): string {
  if (typeof window === "undefined") return "ANONYMOUS";
  const storageKey = "ticketground:tosspayments-customer-key";
  const existing = window.localStorage.getItem(storageKey);
  if (existing) return existing;
  const generated = window.crypto.randomUUID();
  window.localStorage.setItem(storageKey, generated);
  return generated;
}

type PaymentMethodId = (typeof paymentMethods)[number]["id"];

type CheckoutSelection = {
  readonly date: string;
  readonly time: string;
  readonly seats: string;
  readonly count: number;
  readonly baseAmount: number;
  readonly discountAmount: number;
  readonly feeAmount: number;
  readonly totalAmount: number;
  // Every seat the customer actually selected, in selection order. This is
  // what gets purchased and charged for - never just the first one (see
  // booking-panel.tsx's checkoutHref, which used to drop everything after
  // index 0).
  readonly ticketIds: readonly string[];
};

export function CheckoutPanel({
  show,
  selection,
}: {
  show: TicketShow;
  selection: CheckoutSelection;
}) {
  const router = useRouter();
  const [method, setMethod] = useState<PaymentMethodId>("credit");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState(selection.ticketIds.length > 0 ? "좌석 금액 확인 중" : "좌석 자동 선택 대기");
  // Sum of every selected ticket's server-trusted faceValue - null while
  // unresolved/pending, exactly like the single-ticket trustedTicketAmount
  // this replaces.
  const [trustedTicketsAmount, setTrustedTicketsAmount] = useState<number | null>(null);
  const [sessionUserId, setSessionUserId] = useState("");
  const [identityStatus, setIdentityStatus] = useState<ApiIdentityStatus | null>(null);
  const [identityPhone, setIdentityPhone] = useState("");
  const [identityBusy, setIdentityBusy] = useState(false);
  const [identityMessage, setIdentityMessage] = useState("간편 로그인 후 본인인증 상태를 확인합니다.");
  const [tosspaymentsConfig, setTosspaymentsConfig] = useState<ApiTosspaymentsConfig | null>(null);
  const [tossSdkLoaded, setTossSdkLoaded] = useState(false);
  const [tossWidgetReady, setTossWidgetReady] = useState(false);
  const tossWidgetsRef = useRef<TossPaymentsWidgets | null>(null);
  const backendEventId = getTicketShowBackendEventId(show);
  const performanceDateId = getTicketShowPerformanceDateId(show, selection.date, selection.time);
  const selectedMethod = paymentMethods.find((item) => item.id === method) ?? paymentMethods[0];
  const hasSelectedTicket = selection.ticketIds.length > 0;
  const amountPending = hasSelectedTicket && trustedTicketsAmount === null;
  const trustedBaseAmount = hasSelectedTicket ? trustedTicketsAmount ?? 0 : selection.baseAmount;
  const trustedFeeAmount = amountPending ? 0 : selection.ticketIds.length * serviceFeePerSeat;
  const trustedTotalAmount = trustedBaseAmount + trustedFeeAmount;
  const amountLabel = (amount: number) => (amountPending ? "확인 중" : currency(amount));
  const summaryRows = [
    ["좌석 금액", amountLabel(trustedBaseAmount)],
    ["할인", amountPending ? "확인 중" : `-${currency(selection.discountAmount)}`],
    ["예매 수수료", amountLabel(trustedFeeAmount)],
  ] as const;
  const identityVerified = identityStatus?.verified === true;
  const ticketIdsKey = selection.ticketIds.join(",");

  useEffect(() => {
    let mounted = true;
    if (selection.ticketIds.length === 0) {
      setTrustedTicketsAmount(null);
      return () => {
        mounted = false;
      };
    }

    getState()
      .then((state) => {
        if (!mounted) return;
        const tickets = selection.ticketIds.map((ticketId) => state.tickets.find(
          (item) => item.id === ticketId
            && item.eventId === backendEventId
            && item.performanceDateId === performanceDateId,
        ));
        const allResolved = tickets.every((ticket) => ticket !== undefined);
        setTrustedTicketsAmount(allResolved ? tickets.reduce((sum, ticket) => sum + (ticket?.faceValue ?? 0), 0) : null);
        setStatus(allResolved ? "좌석 선택 완료" : "선택한 좌석을 확인할 수 없습니다.");
      })
      .catch(() => {
        if (!mounted) return;
        setTrustedTicketsAmount(null);
        setStatus("좌석 금액을 확인하지 못했습니다.");
      });

    return () => {
      mounted = false;
    };
    // ticketIdsKey (not selection.ticketIds) is the dependency on purpose - a
    // new array reference per render would otherwise re-run this every time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendEventId, performanceDateId, ticketIdsKey]);

  useEffect(() => {
    let mounted = true;
    getTosspaymentsConfig()
      .then((config) => {
        if (mounted) setTosspaymentsConfig(config);
      })
      .catch(() => {
        if (mounted) setTosspaymentsConfig({ configured: false, clientKey: "" });
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Mounts the TossPayments widget once the SDK script has loaded and the
  // server-trusted amount is known - never before, since setAmount() needs a
  // real value and the widget shouldn't be able to request a payment for an
  // amount the client made up.
  useEffect(() => {
    if (!tosspaymentsConfig?.configured || !tossSdkLoaded || amountPending || tossWidgetsRef.current) return;
    const createTossPayments = window.TossPayments;
    if (!createTossPayments) return;
    let cancelled = false;
    let widgets: TossPaymentsWidgets;
    try {
      widgets = createTossPayments(tosspaymentsConfig.clientKey).widgets({ customerKey: tossCustomerKey() });
    } catch {
      setStatus("토스페이먼츠 결제 위젯을 초기화하지 못했습니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    tossWidgetsRef.current = widgets;
    widgets
      .setAmount({ value: trustedTotalAmount, currency: "KRW" })
      .then(() => Promise.all([
        widgets.renderPaymentMethods({ selector: "#toss-payment-method" }),
        widgets.renderAgreement({ selector: "#toss-agreement" }),
      ]))
      .then(() => {
        if (!cancelled) setTossWidgetReady(true);
      })
      .catch(() => {
        if (!cancelled) setStatus("토스페이먼츠 결제 위젯을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
      });
    return () => {
      cancelled = true;
    };
  }, [tosspaymentsConfig, tossSdkLoaded, amountPending, trustedTotalAmount]);

  useEffect(() => {
    let mounted = true;
    const userId = storedSessionUserId();
    setSessionUserId(userId ?? "");
    setIdentityStatus(null);
    if (!userId) {
      setIdentityMessage("간편 로그인 후 티켓 예매 전 본인인증을 진행해 주세요.");
      return () => {
        mounted = false;
      };
    }

    setIdentityMessage("본인인증 상태 확인 중");
    getIdentityStatus(userId)
      .then((nextStatus) => {
        if (!mounted) return;
        setIdentityStatus(nextStatus);
        setIdentityMessage(nextStatus.verified ? "본인인증 완료 · 결제를 진행할 수 있습니다." : "결제 전 NICE 휴대폰 본인인증이 필요합니다.");
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setIdentityStatus(null);
        setIdentityMessage(error instanceof Error ? error.message : "본인인증 상태를 확인하지 못했습니다.");
      });

    return () => {
      mounted = false;
    };
  }, []);

  // NICE 표준창은 서버 push가 아니라 사용자의 브라우저를 콜백 URL로 돌려보내는 방식이라,
  // 팝업을 띄운 뒤 그 창이 닫히기를 기다렸다가 본인인증 상태를 다시 조회해서 반영한다.
  // (niceConfigured가 false인 로컬/QA 환경은 팝업 없이 입력한 번호로 바로 확정한다.)
  async function requestIdentityVerification() {
    if (!sessionUserId || identityBusy) return;
    setIdentityBusy(true);
    setIdentityMessage("NICE 본인인증 요청 중");
    try {
      const started = await startNiceIdentityVerification({ userId: sessionUserId });
      if (started.authUrl) {
        setIdentityMessage("NICE 본인인증 창을 여는 중입니다.");
        const popup = window.open(started.authUrl, "nice-identity-verify", "width=430,height=640");
        if (!popup) {
          setIdentityMessage("팝업이 차단되었습니다. 브라우저의 팝업 차단을 해제한 뒤 다시 시도해주세요.");
          return;
        }
        await new Promise<void>((resolve) => {
          const timer = window.setInterval(() => {
            if (popup.closed) {
              window.clearInterval(timer);
              resolve();
            }
          }, 500);
        });
        setIdentityMessage("본인인증 결과 확인 중");
        const refreshed = await getIdentityStatus(sessionUserId);
        setIdentityStatus(refreshed);
        setIdentityMessage(
          refreshed.verified
            ? `${refreshed.phoneMasked ?? "휴대폰"} 인증 완료 · 결제를 진행할 수 있습니다.`
            : "본인인증이 완료되지 않았습니다. 다시 시도해주세요.",
        );
        return;
      }
      if (!started.mockAvailable) {
        setIdentityMessage("NICE 본인인증이 아직 설정되지 않았습니다.");
        return;
      }
      const phone = identityPhone.trim();
      if (!phone) {
        setIdentityMessage("로컬 QA 모드입니다. 휴대폰 번호를 입력한 뒤 다시 시도해주세요.");
        return;
      }
      setIdentityMessage("로컬 QA 모드에서 인증 완료를 진행합니다.");
      const confirmed = await mockCompleteNiceIdentityVerification({
        userId: sessionUserId,
        phone,
        identityVerificationId: started.identityVerificationId,
      });
      setIdentityStatus(confirmed);
      setIdentityMessage(`${confirmed.phoneMasked ?? "휴대폰"} 인증 완료 · 결제를 진행할 수 있습니다.`);
    } catch (error: unknown) {
      const message = error instanceof TicketgroundApiError && error.code === "PHONE_ALREADY_VERIFIED"
        ? "이미 다른 계정에서 인증된 휴대폰 번호입니다."
        : error instanceof Error
          ? error.message
          : "NICE 본인인증 요청에 실패했습니다.";
      setIdentityMessage(message);
    } finally {
      setIdentityBusy(false);
    }
  }

  async function completeTosspaymentsPayment(ticketIds: readonly string[]) {
    if (!tossWidgetsRef.current) {
      setStatus("결제 위젯이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    setSubmitting(true);
    setStatus("토스페이먼츠 결제창을 여는 중입니다.");
    try {
      // TossPayments only ever takes one orderId for the whole charge - for
      // a single seat that's conventionally the ticketId itself (unchanged
      // from before); for a multi-seat order it's a value that covers the
      // whole set, generated here and handed to the backend on confirm
      // (see confirmTosspaymentsPurchase) so the two sides agree on it.
      const orderId = ticketIds.length > 1 ? `order_${[...ticketIds].sort().join("_")}` : ticketIds[0];
      const resultParams = new URLSearchParams({
        paymentMethod: selectedMethod.paymentMethod,
        date: selection.date,
        time: selection.time,
        // Toss's redirect only echoes back orderId/paymentKey - the full
        // ticket set has to ride along in our own result URL so the result
        // panel knows every ticket this order covers, not just one.
        ticketIds: ticketIds.join(","),
      });
      const resultUrl = `${window.location.origin}/checkout/${show.slug}/result?${resultParams.toString()}`;
      // On success this navigates the whole page away to resultUrl (via Toss's
      // redirect flow) - it never resolves back into this component. Only a
      // rejection (popup blocked, SDK error, etc.) returns control here.
      await tossWidgetsRef.current.requestPayment({
        orderId,
        orderName: ticketIds.length > 1 ? `${show.title} 외 ${ticketIds.length - 1}매` : show.title,
        successUrl: resultUrl,
        failUrl: resultUrl,
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "토스페이먼츠 결제 요청에 실패했습니다.");
      setSubmitting(false);
    }
  }

  async function completePayment() {
    if (!agreed || submitting || !identityVerified || !sessionUserId) {
      setStatus("결제 전 간편 로그인과 본인인증이 필요합니다.");
      return;
    }
    const ticketIds = selection.ticketIds;
    if (ticketIds.length === 0) {
      // 사용자가 실제로 고른 좌석이 없으면 임의 좌석으로 대체 구매하지 않는다 —
      // URL 파라미터 손상이나 좌석맵 로딩 실패로 여기 도달했을 수 있다.
      setStatus("선택된 좌석 정보를 확인할 수 없습니다. 좌석을 다시 선택해주세요.");
      return;
    }

    if (tosspaymentsConfig?.configured) {
      await completeTosspaymentsPayment(ticketIds);
      return;
    }

    setSubmitting(true);
    setStatus("결제 처리 중");
    try {
      const purchase = ticketIds.length > 1
        ? await buyTickets(ticketIds, sessionUserId)
        : await buyTicket(ticketIds[0], sessionUserId);
      const purchasedTotal = purchase.tickets.reduce((sum, ticket) => sum + ticket.faceValue, 0)
        + purchase.tickets.length * serviceFeePerSeat;
      const params = new URLSearchParams({
        date: selection.date,
        time: selection.time,
        seats: purchase.tickets.map((ticket) => ticket.seatLabel).join(" / "),
        count: String(purchase.tickets.length),
        ticketIds: purchase.tickets.map((ticket) => ticket.id).join(","),
        ticketId: purchase.ticket.id,
        total: String(purchasedTotal),
      });
      setStatus(`${purchase.payment.label} ${purchase.payment.status} · ${purchase.tickets.length}매`);
      router.push(`/reservation/${purchase.ticket.id}?${params.toString()}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "결제 처리에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="ticketground-container grid gap-8 py-10 lg:grid-cols-[1fr_360px]">
      <Script src="https://js.tosspayments.com/v2/standard" strategy="afterInteractive" onLoad={() => setTossSdkLoaded(true)} />
      <section className="rounded-md border border-line p-6">
        <p className="text-sm font-bold text-ticketground">STEP 3</p>
        <h1 className="mt-1 text-4xl font-black text-ink-2">결제 정보 확인</h1>
        <p className="mt-2 text-base text-ink-3">좌석과 금액을 확인한 뒤 결제수단과 약관을 선택해 예매를 확정합니다.</p>

        <div className="mt-7 rounded-md bg-surface p-5">
          <h2 className="text-[19px] font-black">예매 정보</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            {[
              ["공연", show.title],
              ["관람일", `${selection.date} ${selection.time}`],
              ["좌석", selection.seats],
              ["매수", `${selection.count}매`],
            ].map(([label, value]) => (
              <div key={label} className="grid grid-cols-[52px_minmax(0,1fr)] gap-3">
                <dt className="whitespace-nowrap text-ink-3">{label}</dt>
                <dd className="min-w-0 break-words text-right font-bold">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-7 rounded-md border border-line p-5">
          <h2 className="text-[19px] font-black">결제수단</h2>
          {tosspaymentsConfig?.configured ? (
            <div className="mt-4">
              <div id="toss-payment-method" />
              <div id="toss-agreement" className="mt-4" />
              {!tossWidgetReady ? (
                <p className="mt-3 text-sm font-bold text-ink-3">결제 위젯을 불러오는 중입니다.</p>
              ) : null}
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {paymentMethods.map((item) => (
                <label key={item.id} className="flex min-h-14 items-start gap-3 rounded-sm border border-line px-4 py-3 text-sm font-bold">
                  <input
                    suppressHydrationWarning
                    type="radio"
                    name="payment-method"
                    checked={method === item.id}
                    onChange={() => setMethod(item.id)}
                    className="accent-link"
                  />
                  <span>
                    {item.label}
                    <small className="block pt-1 text-sm font-medium text-ink-3">{item.note}</small>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div data-testid="identity-gate" className="mt-7 rounded-md border border-line bg-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[19px] font-black text-ink">본인인증</h2>
              <p className="mt-2 break-keep text-sm font-bold text-ink-3">
                티켓 예매 및 결제 전 NICE 휴대폰 본인인증이 필요합니다. 한 번 인증된 휴대폰 번호는 다른 계정에서 다시 인증할 수 없습니다.
              </p>
            </div>
            <span className={identityVerified ? "rounded-sm bg-ok px-3 py-1 text-xs font-black text-white" : "rounded-sm bg-ticketground px-3 py-1 text-xs font-black text-white"}>
              {identityVerified ? "인증 완료" : "결제 전 필수"}
            </span>
          </div>

          {!sessionUserId ? (
            <Link href="/login" className="mt-4 flex h-11 w-full items-center justify-center rounded-sm bg-ticketground text-sm font-black text-white">
              간편 로그인으로 이동
            </Link>
          ) : identityVerified ? (
            <div className="mt-4 rounded-sm border border-line bg-card p-4 text-sm font-bold text-ink-2">
              인증 계정: {sessionUserId} · {identityStatus.phoneMasked ?? "휴대폰 인증 완료"}
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              {identityStatus?.niceConfigured !== true ? (
                <input
                  value={identityPhone}
                  onChange={(event) => setIdentityPhone(event.target.value)}
                  inputMode="tel"
                  placeholder="휴대폰 번호 (로컬 QA 모드)"
                  className="h-11 rounded-sm border border-line-strong bg-card px-3 text-sm font-bold text-ink outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                />
              ) : null}
              <button
                type="button"
                disabled={identityBusy}
                onClick={requestIdentityVerification}
                className="h-11 rounded-sm bg-ink px-4 text-sm font-black text-on-ink disabled:bg-surface-3 disabled:text-ink-4"
              >
                {identityBusy ? "요청 중" : "NICE 본인인증 시작"}
              </button>
            </div>
          )}
          <p className="mt-3 text-sm font-bold text-ink-3" aria-live="polite">{identityMessage}</p>
        </div>

        <label className="mt-5 flex items-start gap-3 rounded-md border border-line p-4 text-sm font-bold">
          <input
            suppressHydrationWarning
            type="checkbox"
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
            className="mt-1 accent-link"
          />
          결제 조건, Tig 티켓 QR 정책, 취소/환불 규정에 동의합니다
        </label>
        <div className="mt-5 rounded-md border border-line bg-surface p-4" aria-live="polite">
          <p className="text-sm font-black text-ink">결제 상태</p>
          <p className="mt-1 text-sm font-bold text-ink-3">{status}</p>
        </div>
      </section>

      <aside className="h-fit rounded-md border border-line p-6 lg:sticky lg:top-6">
        <h2 className="clamp-2 text-2xl font-black text-ink-2">{show.title}</h2>
        <dl className="mt-5 space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-3">관람일</dt>
            <dd className="font-bold">{selection.date}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-3">회차</dt>
            <dd className="font-bold">{selection.time}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-3">좌석</dt>
            <dd className="text-right font-bold">{selection.seats}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-3">결제수단</dt>
            <dd className="font-bold">{selectedMethod.label}</dd>
          </div>
          {summaryRows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4">
              <dt className="text-ink-3">{label}</dt>
              <dd className="font-bold">{value}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-4 border-t border-line pt-4">
            <dt className="text-ink-3">총 결제금액</dt>
            <dd className="text-2xl font-bold text-ticketground">{amountLabel(trustedTotalAmount)}</dd>
          </div>
        </dl>
        <button
          type="button"
          disabled={!hasSelectedTicket || !agreed || submitting || amountPending || !identityVerified || !sessionUserId || (tosspaymentsConfig?.configured === true && !tossWidgetReady)}
          onClick={completePayment}
          className="mt-5 h-12 w-full rounded-sm bg-ticketground text-lg font-bold text-white disabled:bg-surface-3"
        >
          {submitting ? "결제 처리 중" : "결제 완료"}
        </button>
        {!hasSelectedTicket ? (
          <p className="mt-3 text-sm font-bold text-ticketground">
            선택된 좌석 정보를 확인할 수 없습니다. 좌석 선택 화면으로 돌아가 다시 선택해주세요.
          </p>
        ) : null}
      </aside>
    </div>
  );
}
