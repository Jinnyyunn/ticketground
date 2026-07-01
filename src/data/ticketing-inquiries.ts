import type { InquiryThread } from "@/types";

export const inquiryThreads: readonly InquiryThread[] = [
  {
    id: "inq-cti-260513-a4f2k9-transfer",
    reservationId: "CTI-260513-A4F2K9",
    showSlug: "les-miserables",
    status: "answered",
    subject: "동반자 티켓 양도 가능 시간 문의",
    messages: [
      {
        author: "member",
        at: "2026-05-14T09:12:00+09:00",
        body: "VIP H-15 좌석을 동반자에게 따로 전달하고 싶습니다.",
      },
      {
        author: "agent",
        at: "2026-05-14T09:25:00+09:00",
        body: "공식 양도에서 받는 사람 카카오톡, 이메일, 휴대폰을 등록하면 QR 직접 전달 없이 입장할 수 있습니다.",
      },
    ],
  },
  {
    id: "inq-cti-260710-entry",
    reservationId: "CTI-260710-001",
    showSlug: "dracula",
    status: "open",
    subject: "공연 당일 입장 QR 활성화 문의",
    messages: [
      {
        author: "member",
        at: "2026-07-10T16:20:00+09:00",
        body: "오늘 19:30 공연인데 앱에서 QR 준비 상태로만 보입니다.",
      },
      {
        author: "system",
        at: "2026-07-10T16:20:01+09:00",
        body: "공연 당일 입장 문의로 우선 분류되었습니다. 예매정보가 상담원에게 함께 전달됩니다.",
      },
    ],
  },
  {
    id: "inq-cti-26007850-refund",
    reservationId: "CTI-26007850-001",
    showSlug: "palette-festival",
    status: "closed",
    subject: "우천 시 취소 수수료 확인",
    messages: [
      {
        author: "member",
        at: "2026-08-09T11:05:00+09:00",
        body: "야외 공연인데 우천 예보가 있을 때 취소 수수료가 어떻게 적용되나요?",
      },
      {
        author: "agent",
        at: "2026-08-09T11:42:00+09:00",
        body: "주최 측 취소가 아닌 일반 취소는 취소/환불 화면의 관람일 기준 수수료 정책이 적용됩니다.",
      },
    ],
  },
];
