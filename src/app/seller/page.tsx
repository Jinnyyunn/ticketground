import { InformationPage } from "@/components/ticketing/information-page";

const sections = [
  {
    title: "티켓 판매 등록",
    body: "공연 주최자와 판매자는 공연명, 일정, 공연장, 좌석 등급, 가격 정보를 확인한 뒤 Ticketground 판매 검수를 요청할 수 있습니다.",
  },
  {
    title: "판매 운영",
    body: "판매 중인 공연은 예매 오픈 시간, 잔여 좌석, 취소 정책과 클린티켓 적용 여부를 기준으로 운영 상태를 관리합니다.",
  },
  {
    title: "정산 안내",
    body: "판매 정산은 공연 종료와 취소 기한을 확인한 뒤 등록된 판매자 정보와 정산 기준에 따라 순차적으로 진행합니다.",
  },
] as const;

export default function SellerPage() {
  return (
    <InformationPage
      eyebrow="판매자 안내"
      title="티켓판매안내"
      description="Ticketground에서 공연 티켓을 판매하려는 주최자와 판매자를 위한 기본 절차를 안내합니다."
      sections={sections}
    />
  );
}
