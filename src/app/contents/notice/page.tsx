import { InformationPage } from "@/components/ticketing/information-page";

const sections = [
  {
    title: "예매 공지",
    body: "공연별 예매 오픈, 좌석 추가, 회차 변경과 같은 주요 공지를 순차적으로 안내합니다.",
  },
  {
    title: "서비스 공지",
    body: "Ticketground 서비스 점검, 고객센터 운영 시간, 결제와 취소 정책 변경 사항을 이곳에서 확인할 수 있습니다.",
  },
  {
    title: "클린티켓 공지",
    body: "공식 재판매, 동적 QR, 양도 제한과 관련된 클린티켓 운영 안내를 공지사항으로 제공합니다.",
  },
] as const;

export default function NoticePage() {
  return (
    <InformationPage
      eyebrow="고객센터"
      title="공지사항"
      description="Ticketground 이용에 필요한 예매, 서비스, 클린티켓 공지를 모아 안내합니다."
      sections={sections}
    />
  );
}
