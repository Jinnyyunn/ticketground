import { InformationPage } from "@/components/ticketing/information-page";

const sections = [
  {
    title: "개인정보 수집",
    body: "Ticketground는 회원 가입, 예매, 결제, 고객 문의 처리에 필요한 이름, 연락처, 예매 정보 등 최소한의 개인정보를 수집합니다.",
  },
  {
    title: "개인정보 이용",
    body: "수집한 개인정보는 예매 확인, 티켓 발급, 취소와 환불, 공식 재판매, 고객 상담과 서비스 알림 제공에 이용합니다.",
  },
  {
    title: "보관과 보호",
    body: "개인정보는 관련 법령과 내부 보관 기준에 따라 관리하며, 보관 기간이 끝난 정보는 안전한 방식으로 파기합니다.",
  },
] as const;

export default function PrivacyPage() {
  return (
    <InformationPage
      eyebrow="개인정보"
      title="개인정보처리방침"
      description="Ticketground 서비스 이용 중 처리되는 개인정보의 수집, 이용, 보관 기준을 안내합니다."
      sections={sections}
    />
  );
}
