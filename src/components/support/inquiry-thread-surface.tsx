"use client";

import { useEffect, useMemo, useState } from "react";
import type { InquiryMessage, InquiryThread, Reservation, TicketShow } from "@/types";
import { addSupportMessage, createSupportThread, getSupportThreads, type ApiSupportThread } from "@/lib/ticketground-api";
import { cn } from "@/lib/utils";

type InquiryThreadSurfaceProps = {
  readonly threads: readonly InquiryThread[];
  readonly reservations: readonly Reservation[];
  readonly shows: readonly TicketShow[];
};

type DraftMessage = InquiryMessage & {
  readonly id: string;
};

type ChatThread = Omit<InquiryThread, "messages"> & {
  readonly messages: readonly DraftMessage[];
};

const statusMeta: Record<InquiryThread["status"], { readonly label: string; readonly className: string }> = {
  open: { label: "대기", className: "border-ticketground bg-tint-red text-ticketground" },
  answered: { label: "완료", className: "border-ok bg-white text-ok" },
  closed: { label: "종료", className: "border-line bg-surface-2 text-ink-3" },
};

const authorMeta: Record<InquiryMessage["author"], { readonly label: string; readonly className: string }> = {
  member: { label: "me", className: "ml-auto bg-ink text-white" },
  agent: { label: "agent", className: "bg-white text-ink" },
  system: { label: "system", className: "mx-auto bg-tint-yellow text-ink" },
};

function toChatThreads(threads: readonly InquiryThread[]): readonly ChatThread[] {
  return threads.map((thread) => ({
    ...thread,
    messages: thread.messages.map((message, index) => ({
      ...message,
      id: `${thread.id}-${index}`,
    })),
  }));
}

function fromBackendThread(thread: ApiSupportThread): ChatThread {
  const statusMap = {
    OPEN: "open",
    ANSWERED: "answered",
    CLOSED: "closed",
  } as const;
  return {
    id: thread.id,
    subject: thread.subject,
    status: statusMap[thread.status],
    reservationId: "문의 접수",
    showSlug: "les-miserables-40",
    messages: thread.messages.map((message) => ({
      id: message.id,
      author: message.role === "ADMIN" ? "agent" : "member",
      at: message.at,
      body: message.body,
    })),
  };
}

function shortTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function InquiryThreadSurface({ threads: initialThreads, reservations, shows }: InquiryThreadSurfaceProps) {
  const [threads, setThreads] = useState<readonly ChatThread[]>(() => toChatThreads(initialThreads));
  const [selectedId, setSelectedId] = useState(initialThreads[0]?.id ?? "");
  const [draft, setDraft] = useState("");
  const [backendStatus, setBackendStatus] = useState("문의 내역 동기화 중");
  const [sending, setSending] = useState(false);
  const selectedThread = useMemo(() => threads.find((thread) => thread.id === selectedId) ?? threads[0], [selectedId, threads]);
  const reservation = reservations.find((item) => item.id === selectedThread?.reservationId);
  const show = shows.find((item) => item.slug === selectedThread?.showSlug);
  const canSend = draft.trim().length > 0;

  async function refreshBackendThreads() {
    try {
      const backendThreads = await getSupportThreads();
      if (backendThreads.length > 0) {
        const mapped = backendThreads.map(fromBackendThread);
        setThreads(mapped);
        setSelectedId(mapped[0]?.id ?? "");
      }
      setBackendStatus(backendThreads.length ? `${backendThreads.length}건의 문의 동기화` : "저장된 문의가 없어 새 문의 작성 대기");
    } catch (error) {
      setBackendStatus(error instanceof Error ? error.message : "문의를 불러오지 못했습니다.");
    }
  }

  useEffect(() => {
    void refreshBackendThreads();
  }, []);

  async function sendMessage() {
    const body = draft.trim();
    if (!body || !selectedThread) return;
    setSending(true);
    setBackendStatus("문의 전송 중");
    const at = new Date().toISOString();
    const userMessage: DraftMessage = { id: `${selectedThread.id}-member-${at}`, author: "member", at, body };
    const systemMessage: DraftMessage = {
      id: `${selectedThread.id}-system-${at}`,
      author: "system",
      at,
      body: "문의가 접수되었습니다. 예매 정보와 함께 담당 상담원에게 전달됩니다.",
    };
    setThreads((current) =>
      current.map((thread) =>
        thread.id === selectedThread.id ? { ...thread, status: "open", messages: [...thread.messages, userMessage, systemMessage] } : thread,
      ),
    );
    setDraft("");
    try {
      const backendThread = selectedThread.id.startsWith("support_")
        ? await addSupportMessage(selectedThread.id, body)
        : await createSupportThread(body, selectedThread.subject);
      const mapped = fromBackendThread(backendThread);
      setThreads((current) => [mapped, ...current.filter((thread) => thread.id !== mapped.id && thread.id !== selectedThread.id)]);
      setSelectedId(mapped.id);
      setBackendStatus("문의 전송 완료");
    } catch (error) {
      setBackendStatus(error instanceof Error ? error.message : "문의 전송에 실패했습니다.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[340px_minmax(0,1fr)]" data-testid="inquiry-surface">
      <aside className="min-w-0 rounded-lg border border-line bg-surface p-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-black text-ink">문의 스레드</h2>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-ink-3">{threads.length}건</span>
        </div>
        <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-bold text-ink-3" aria-live="polite">{backendStatus}</p>
        <div className="mt-4 grid gap-3">
          {threads.map((thread) => {
            const meta = statusMeta[thread.status];
            return (
              <button
                key={thread.id}
                type="button"
                onClick={() => setSelectedId(thread.id)}
                className={cn(
                  "min-w-0 rounded-lg border bg-white p-4 text-left transition hover:border-line-strong focus-visible:outline-2 focus-visible:outline-link",
                  selectedThread?.id === thread.id ? "border-ink shadow-ticket-1" : "border-line",
                )}
                data-testid={`thread-${thread.id}`}
              >
                <span className={cn("inline-flex rounded-full border px-2 py-1 text-xs font-black", meta.className)}>{meta.label}</span>
                <strong className="balanced-title mt-3 block text-sm font-black text-ink">{thread.subject}</strong>
                <span className="mt-2 block break-words text-xs font-bold text-ink-3">{thread.reservationId}</span>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="min-w-0 overflow-hidden rounded-lg border border-line bg-white">
        <div className="border-b border-line p-5">
          <div className="flex flex-wrap items-center gap-2">
            {selectedThread && (
              <span className={cn("rounded-full border px-3 py-1 text-xs font-black", statusMeta[selectedThread.status].className)}>
                {statusMeta[selectedThread.status].label}
              </span>
            )}
            <h2 className="balanced-title min-w-0 text-xl font-black text-ink">{selectedThread?.subject ?? "문의 내역"}</h2>
          </div>
          <div className="mt-4 grid gap-2 text-sm text-ink-3 md:grid-cols-3" data-testid="reservation-context">
            <span className="min-w-0 break-words rounded-lg bg-surface px-3 py-2 font-bold">예매 {reservation?.id ?? selectedThread?.reservationId}</span>
            <span className="min-w-0 break-words rounded-lg bg-surface px-3 py-2 font-bold">공연 {show?.shortTitle ?? reservation?.showTitle}</span>
            <span className="min-w-0 break-words rounded-lg bg-surface px-3 py-2 font-bold">티켓 {reservation?.seat ?? "연결 대기"}</span>
          </div>
        </div>

        <div className="grid min-h-[420px] content-end gap-3 bg-surface p-5" aria-live="polite">
          {selectedThread?.messages.map((message) => {
            const meta = authorMeta[message.author];
            return (
              <article key={message.id} className={cn("max-w-[92%] rounded-lg border border-line p-4 shadow-ticket-1 sm:max-w-[78%]", meta.className)}>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-black opacity-75">
                  <span>{meta.label}</span>
                  <time dateTime={message.at}>{shortTime(message.at)}</time>
                </div>
                <p className="mt-2 whitespace-pre-line break-words text-sm leading-loose">{message.body}</p>
              </article>
            );
          })}
        </div>

        <div className="border-t border-line p-5">
          <label className="grid gap-2 text-sm font-black text-ink">
            답변 작성
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
              className="min-h-[108px] rounded-lg border border-line bg-white p-3 font-normal text-ink focus-visible:outline-2 focus-visible:outline-link"
              placeholder="문의 내용을 입력하세요. Shift+Enter로 줄바꿈"
              data-testid="inquiry-compose"
            />
          </label>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-bold text-ink-3">공연 당일 입장 문의는 예매 정보와 함께 우선 분류됩니다.</p>
            <button
              type="button"
              onClick={() => void sendMessage()}
              disabled={!canSend || sending}
              className="h-10 min-w-16 self-end whitespace-nowrap rounded-lg bg-ticketground px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-ink-4"
              data-testid="inquiry-send"
            >
              {sending ? "전송 중" : "전송"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
