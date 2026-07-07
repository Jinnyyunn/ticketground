import { InformationPage } from "@/components/ticketing/information-page";

const sections = [
  {
    title: "서비스 소개",
    body: "Ticketground는 공연 예매, 클린티켓 확인, Tig 공식 양도 티켓과 고객 문의를 한 화면에서 연결하는 티켓 서비스입니다.",
  },
  {
    title: "운영 원칙",
    body: "예매 정보와 좌석 상태를 명확하게 보여주고, 공식 경로 안에서 취소와 Tig 공식 양도 티켓을 처리할 수 있도록 설계합니다.",
  },
  {
    title: "고객 지원",
    body: "공연 관람 전후에 필요한 문의는 고객센터와 1:1 문의를 통해 접수하며 예매번호와 공연 정보를 함께 확인합니다.",
  },
] as const;

export default function CompanyPage() {
  return (
    <InformationPage
      eyebrow="Ticketground"
      title="회사소개"
      description="Ticketground가 제공하는 서비스와 운영 기준을 안내합니다."
      sections={sections}
    />
  );
}
