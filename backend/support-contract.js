const categories = [
  { id: "GENERAL", label: "일반" },
  { id: "PAYMENT", label: "예매/결제" },
  { id: "TICKET_QR", label: "티켓/입장" },
  { id: "URGENT", label: "공연 당일" }
];

const faqs = [
  {
    id: "reservation-history",
    category: "GENERAL",
    question: "예매내역은 어디에서 확인하나요?",
    answer: "마이페이지의 예매내역에서 공연일, 좌석, 결제 금액, 클린티켓 QR 상태를 확인할 수 있습니다."
  },
  {
    id: "admission-help",
    category: "URGENT",
    question: "공연 당일 입장 문의는 어떻게 하나요?",
    answer: "공연 당일 입장 문의는 1:1 문의에서 예매번호를 포함해 남기면 우선 응대합니다."
  },
  {
    id: "virtual-ticket",
    category: "TICKET_QR",
    question: "가상 티켓과 입장 QR은 무엇이 다른가요?",
    answer: "구매 직후 티켓은 소유 확인용 가상 티켓이며 입장 QR은 공연 전 지정된 시간에 활성화됩니다."
  },
  {
    id: "watchlist-alert",
    category: "GENERAL",
    question: "관심공연 알림은 언제 발송되나요?",
    answer: "관심공연으로 등록하면 예매 오픈 D-3과 당일에 선택한 채널로 알림을 받을 수 있습니다."
  }
];

const notices = [
  {
    id: "support-hours",
    title: "고객센터 운영시간 안내",
    body: "전화 상담은 평일 09:00~18:00이며 공연 당일 입장 문의를 우선 응대합니다."
  }
];

export function createSupportContract({
  addSupportMessage,
  createSupportThread,
  executeIdempotent,
  httpError,
  supportThreadForUser
}) {
  function publicSupport() {
    return { version: "1", categories, faqs, notices };
  }

  function supportThreads(db, principal) {
    return supportThreadForUser(db, principal.userId);
  }

  function supportThreadDetail(db, principal, threadId) {
    const thread = supportThreads(db, principal).find((item) => item.id === threadId);
    if (!thread) {
      throw httpError(404, "SUPPORT_THREAD_NOT_FOUND", "문의 내역을 찾을 수 없습니다.");
    }
    return thread;
  }

  function createPrincipalSupportThread(db, principal, key, body) {
    return executeIdempotent(db, {
      actorId: principal.userId,
      operation: "SUPPORT_THREAD_CREATE",
      key,
      payload: {
        category: body.category,
        message: body.message,
        subject: body.subject
      }
    }, () => createSupportThread(db, {
      userId: principal.userId,
      category: body.category,
      message: body.message,
      subject: body.subject
    }));
  }

  function addPrincipalSupportMessage(db, principal, threadId, key, body) {
    supportThreadDetail(db, principal, threadId);
    return executeIdempotent(db, {
      actorId: principal.userId,
      operation: `SUPPORT_MESSAGE_CREATE:${threadId}`,
      key,
      payload: { message: body.message }
    }, () => addSupportMessage(db, {
      threadId,
      actorId: principal.userId,
      role: "CUSTOMER",
      message: body.message
    }));
  }

  return {
    addPrincipalSupportMessage,
    createPrincipalSupportThread,
    publicSupport,
    supportThreadDetail,
    supportThreads
  };
}
