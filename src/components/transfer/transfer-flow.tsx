"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CleanTicketPolicyBanner,
  SummaryRow,
  TicketgroundChip,
  TicketgroundSurface,
  TicketgroundToast,
} from "@/components/ticketground/primitives";
import { currency } from "@/data/ticketing";
import { buyTicket, DEMO_EVENT_ID, directTransferAttempt, getState, getUserTickets, type ApiTicket } from "@/lib/ticketground-api";
import type { CleanTicketReservation, TransferRecipientField } from "@/types";

type TransferErrors = {
  readonly seat?: string;
  readonly recipient?: string;
  readonly amount?: string;
};

const recipientFeeAmount = 2000;

function parseAmount(value: string) {
  const normalized = value.replaceAll(",", "").trim();
  if (normalized === "") return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function buildErrors({
  amount,
  maxAmount,
  recipient,
  seatId,
}: {
  readonly amount: number;
  readonly maxAmount: number;
  readonly recipient: string;
  readonly seatId: string;
}) {
  return {
    ...(!seatId ? { seat: "양도할 좌석을 선택해 주세요." } : {}),
    ...(!recipient.trim() ? { recipient: "받는 사람 정보를 입력해 주세요." } : {}),
    ...(!Number.isFinite(amount) || amount < 0 || amount > maxAmount
      ? { amount: `양도 금액은 0원부터 ${currency(maxAmount)}까지 입력할 수 있습니다.` }
      : {}),
  } satisfies TransferErrors;
}

export function TransferFlow({ reservation }: { readonly reservation: CleanTicketReservation }) {
  const fields = reservation.transfer.recipientFields;
  const [selectedSeatId, setSelectedSeatId] = useState(reservation.seats[0]?.id ?? "");
  const [recipientMethod, setRecipientMethod] = useState<TransferRecipientField["id"]>("kakao");
  const [recipientValue, setRecipientValue] = useState("");
  const [amountValue, setAmountValue] = useState("0");
  const [errors, setErrors] = useState<TransferErrors>({});
  const [toastVisible, setToastVisible] = useState(false);
  const [backendTickets, setBackendTickets] = useState<readonly ApiTicket[]>([]);
  const [backendStatus, setBackendStatus] = useState("백엔드 양도 가능 티켓 확인 중");
  const [backendBusy, setBackendBusy] = useState(false);

  const selectedSeat = reservation.seats.find((seat) => seat.id === selectedSeatId);
  const selectedBackendTicket = backendTickets.find((ticket) => ticket.id === selectedSeatId);
  const selectedField = fields.find((field) => field.id === recipientMethod);
  const amount = useMemo(() => parseAmount(amountValue), [amountValue]);
  const maxAmount = Math.round(((selectedBackendTicket?.faceValue ?? selectedSeat?.faceValue ?? 0) * reservation.transfer.maxAmountPercent) / 100);
  const totalRecipientPay = (Number.isFinite(amount) ? amount : 0) + recipientFeeAmount;

  async function refreshBackendTickets() {
    try {
      const tickets = await getUserTickets();
      setBackendTickets(tickets);
      if (tickets[0]) {
        setSelectedSeatId(tickets[0].id);
        setBackendStatus(`${tickets.length}건의 백엔드 티켓 확인`);
      } else {
        setBackendStatus("백엔드 보유 티켓이 없어 테스트 티켓 확보가 필요합니다.");
      }
    } catch (error) {
      setBackendStatus(error instanceof Error ? error.message : "백엔드 티켓을 불러오지 못했습니다.");
    }
  }

  useEffect(() => {
    void refreshBackendTickets();
  }, []);

  async function ensureTicket() {
    if (selectedBackendTicket) return selectedBackendTicket;
    setBackendBusy(true);
    setBackendStatus("양도 정책 테스트 티켓 확보 중");
    try {
      const state = await getState();
      const ticket = state.tickets.find((item) => item.eventId === DEMO_EVENT_ID && item.status === "ON_SALE");
      if (!ticket) throw new Error("판매 가능한 백엔드 티켓이 없습니다.");
      const purchase = await buyTicket(ticket.id);
      const tickets = await getUserTickets();
      setBackendTickets(tickets);
      setSelectedSeatId(purchase.ticket.id);
      setBackendStatus(`${purchase.ticket.seatLabel} 테스트 티켓 확보`);
      return purchase.ticket;
    } finally {
      setBackendBusy(false);
    }
  }

  const handleSubmit = async () => {
    const nextErrors = buildErrors({
      amount,
      maxAmount,
      recipient: recipientValue,
      seatId: selectedSeatId,
    });
    setErrors(nextErrors);
    setToastVisible(false);
    if (Object.keys(nextErrors).length > 0) return;
    setBackendBusy(true);
    setBackendStatus("백엔드 지정 양도 차단 확인 중");
    try {
      const ticket = await ensureTicket();
      const result = await directTransferAttempt(ticket.id);
      setBackendStatus(result.blocked ? `${ticket.seatLabel} 지정 양도 차단 · 신뢰 정책 적용` : "양도 요청이 허용되었습니다.");
      setToastVisible(true);
    } catch (error) {
      setBackendStatus(error instanceof Error ? error.message : "백엔드 양도 검증에 실패했습니다.");
    } finally {
      setBackendBusy(false);
    }
  };

  return (
    <section className="ticketground-container py-10">
      <p className="text-sm font-black text-ticketground">CLEAN TRANSFER</p>
      <h1 className="mt-2 text-4xl font-black text-ink">공식 양도</h1>
      <p className="mt-3 max-w-[760px] text-base leading-loose text-ink-3">
        동반자가 따로 입장해야 할 때 좌석 소유권을 Ticketground 안에서 요청합니다. QR 직접 전달 및 화면 캡처 방식은 지원하지 않습니다.
      </p>

      <CleanTicketPolicyBanner className="mt-6">
        받는 사람 정보가 등록되면 양수자가 본인 기기에서 티켓을 확인합니다. 양도 금액은 좌석 정가의 0~10% 범위이며 양수자 수수료는 건당 2,000원입니다.
      </CleanTicketPolicyBanner>

      <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_1fr_360px]">
        <TicketgroundSurface className="grid content-start gap-4">
          <div>
            <p className="text-sm font-black text-ink-3">1. 양도할 티켓</p>
            <h2 className="mt-1 text-2xl font-black text-ink">{reservation.showTitle}</h2>
            <p className="mt-2 text-sm text-ink-3">
              {reservation.date} {reservation.time} · {reservation.venue}
            </p>
          </div>
          <div className="flex flex-wrap gap-2" aria-label="양도 가능 좌석">
            {(backendTickets.length ? backendTickets : reservation.seats).map((seat) => (
              <TicketgroundChip key={seat.id} active={seat.id === selectedSeatId} onClick={() => setSelectedSeatId(seat.id)}>
                {"seatLabel" in seat ? seat.seatLabel : seat.label}
              </TicketgroundChip>
            ))}
          </div>
          {errors.seat && <p className="text-sm font-bold text-destructive">{errors.seat}</p>}
          <p className="rounded-lg bg-surface p-3 text-sm leading-relaxed text-ink-3">동반자 좌석만 선택하세요. 대표자 티켓의 입장 QR은 공연 2~3시간 전 앱에서만 활성화됩니다.</p>
        </TicketgroundSurface>

        <TicketgroundSurface className="grid content-start gap-4">
          <div>
            <p className="text-sm font-black text-ink-3">2. 받는 사람</p>
            <h2 className="mt-1 text-2xl font-black text-ink">수신 방법 선택</h2>
          </div>
          <div className="flex flex-wrap gap-2" aria-label="받는 사람 수신 방법">
            {fields.map((field) => (
              <TicketgroundChip key={field.id} active={field.id === recipientMethod} onClick={() => setRecipientMethod(field.id)}>
                {field.label}
              </TicketgroundChip>
            ))}
          </div>
          <label className="grid gap-2 text-sm font-bold text-ink-2">
            받는 사람 정보
            <input
              className="h-12 rounded-lg border border-line px-4 text-base outline-none transition focus-visible:ring-3 focus-visible:ring-ring/50"
              placeholder={selectedField?.placeholder ?? "받는 사람 정보"}
              value={recipientValue}
              onChange={(event) => setRecipientValue(event.target.value)}
              aria-invalid={Boolean(errors.recipient)}
            />
          </label>
          {errors.recipient && <p className="text-sm font-bold text-destructive">{errors.recipient}</p>}
          <p className="text-sm leading-relaxed text-ink-3">비회원도 수신 링크에서 본인 확인 후 Ticketground 계정으로 받을 수 있습니다.</p>
        </TicketgroundSurface>

        <TicketgroundSurface className="grid content-start gap-4">
          <div>
            <p className="text-sm font-black text-ink-3">3. 금액과 요약</p>
            <h2 className="mt-1 text-2xl font-black text-ink">양도 요청</h2>
          </div>
          <label className="grid gap-2 text-sm font-bold text-ink-2">
            양도 금액
            <input
              className="h-12 rounded-lg border border-line px-4 text-base outline-none transition focus-visible:ring-3 focus-visible:ring-ring/50"
              inputMode="numeric"
              value={amountValue}
              onChange={(event) => setAmountValue(event.target.value)}
              aria-invalid={Boolean(errors.amount)}
            />
          </label>
          <p className="text-sm text-ink-3">정책 범위: 0원 ~ {currency(maxAmount)}</p>
          {errors.amount && <p className="text-sm font-bold text-destructive">{errors.amount}</p>}
          <dl className="rounded-lg bg-surface px-4">
            <SummaryRow label="선택 좌석" value={selectedSeat?.label ?? "미선택"} />
            <SummaryRow label="양도 금액" value={Number.isFinite(amount) ? currency(amount) : "입력 오류"} />
            <SummaryRow label="양수자 수수료" value={currency(recipientFeeAmount)} />
            <SummaryRow label="양수자 결제 예정" value={currency(totalRecipientPay)} strong />
          </dl>
          <button
            type="button"
            className="h-12 rounded-lg bg-ink px-5 text-base font-black text-white transition hover:bg-ink-2 focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px"
            onClick={() => void handleSubmit()}
            disabled={backendBusy}
          >
            {backendBusy ? "검증 중" : "양도 요청"}
          </button>
          <p className="text-sm font-bold text-ink-3" aria-live="polite">{backendStatus}</p>
        </TicketgroundSurface>
      </div>

      {toastVisible && (
        <div className="fixed bottom-6 right-6 z-40 w-[340px]">
          <TicketgroundToast
            title="양도 요청이 접수되었습니다"
            description={`${selectedSeat?.label ?? "선택 좌석"} · ${selectedField?.label ?? "수신 방법"}으로 받는 사람 확인을 기다립니다.`}
            tone="success"
          />
        </div>
      )}
    </section>
  );
}
