import type { TicketShow } from "@/types";

export type TicketVenue = {
  readonly slug: string;
  readonly name: string;
  readonly displayName: string;
  readonly cardTitle: string;
  readonly description: string;
  readonly address: string;
  readonly seats: string;
  readonly inquiry: string;
  readonly transport: readonly string[];
  readonly zones: readonly string[];
  readonly aliases?: readonly string[];
  readonly searchQuery: string;
};

export const ticketVenues: readonly TicketVenue[] = [
  {
    slug: "blue-square",
    name: "블루스퀘어 신한카드홀",
    displayName: "블루스퀘어 신한카드홀",
    cardTitle: "BLUE SQUARE",
    description: "뮤지컬 중심의 대형 프로시니엄 공연장입니다. 좌석 등급과 교통 동선을 예매 전에 확인할 수 있습니다.",
    address: "서울 용산구 이태원로 294",
    seats: "1,766석",
    inquiry: "1577-0000",
    transport: ["지하철 6호선 한강진역 2번 출구 도보 5분", "공연 당일 주차 혼잡으로 대중교통 이용을 권장합니다.", "입장 QR 활성화는 공연 2~3시간 전 앱에서 진행됩니다."],
    zones: ["VIP 1층 중앙", "R 1층 사이드", "S 2층 전방", "A 2층 후방"],
    aliases: ["블루스퀘어", "한남동 블루스퀘어 NEMO"],
    searchQuery: "레미제라블",
  },
  {
    slug: "lg-arts-center",
    name: "LG아트센터 서울 LG SIGNATURE 홀",
    displayName: "LG아트센터 서울 LG SIGNATURE 홀",
    cardTitle: "LG ARTS CENTER",
    description: "마곡지구에 위치한 대형 뮤지컬 공연장입니다. 장시간 공연 관람에 맞춘 객석 동선과 모바일 티켓 확인 안내를 제공합니다.",
    address: "서울 강서구 마곡중앙로 136",
    seats: "1,335석",
    inquiry: "1661-0017",
    transport: ["9호선·공항철도 마곡나루역 도보 10분", "공연 전후 주변 도로 혼잡으로 대중교통 이용을 권장합니다.", "모바일 티켓과 예매자 신분증을 함께 준비해 주세요."],
    zones: ["VIP 1층 중앙", "R 1층 후방", "S 2층 전방", "A 2층 후방"],
    aliases: ["LG아트센터"],
    searchQuery: "드라큘라",
  },
  {
    slug: "sac-concert-hall",
    name: "예술의전당 콘서트홀",
    displayName: "예술의전당 콘서트홀",
    cardTitle: "SEOUL ARTS CENTER",
    description: "오케스트라와 클래식 내한공연 중심의 콘서트 전용 홀입니다. 회차별 입장 시간과 좌석 등급을 예매 전에 확인할 수 있습니다.",
    address: "서울 서초구 남부순환로 2406",
    seats: "2,505석",
    inquiry: "1668-1352",
    transport: ["3호선 남부터미널역 5번 출구 셔틀 또는 도보 이동", "클래식 공연 특성상 공연 시작 후 입장이 제한될 수 있습니다.", "공연장 로비 혼잡을 줄이기 위해 티켓을 미리 확인해 주세요."],
    zones: ["VIP 1층 중앙", "R 1층 사이드", "S 2층", "A 3층"],
    aliases: ["예술의전당"],
    searchQuery: "베를린필",
  },
  {
    slug: "jamsil-olympic-main-stadium",
    name: "잠실종합운동장 주경기장",
    displayName: "잠실종합운동장 주경기장",
    cardTitle: "JAMSIL OLYMPIC MAIN STADIUM",
    description: "대형 콘서트와 월드투어에 맞춘 야외 스타디움입니다. 게이트별 입장 동선과 좌석 권역을 예매 전에 확인할 수 있습니다.",
    address: "서울 송파구 올림픽로 25",
    seats: "6만석 이상",
    inquiry: "1661-5000",
    transport: ["2호선·9호선 종합운동장역 도보 이동", "공연 당일 주변 도로와 주차장이 매우 혼잡해 대중교통 이용을 권장합니다.", "지정 게이트와 입장 시간을 예매 내역에서 미리 확인해 주세요."],
    zones: ["VIP 플로어", "R 1층 지정석", "S 2층 지정석", "A 3층 지정석"],
    aliases: ["잠실종합운동장", "잠실 올림픽 주경기장"],
    searchQuery: "IU",
  },
] as const;

export function getVenue(slug: string) {
  return ticketVenues.find((venue) => venue.slug === slug);
}

export function getVenueForShow(show: TicketShow) {
  return ticketVenues.find((venue) => venue.name === show.venue || venue.aliases?.includes(show.venue));
}
