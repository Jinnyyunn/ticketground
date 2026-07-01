import type { Reservation, TicketShow } from "@/types";
import { homeTicketShows } from "./home-ticketing-catalog";

function reservationFromShow(show: TicketShow): Reservation {
  const schedule = show.schedules[0];
  const price = show.prices[0];
  const seat = price ? `${price.seat} A열 12번` : "일반석 A열 12번";
  const amount = price?.price ?? 0;

  return {
    id: `CTI-${show.code}-001`,
    showSlug: show.slug,
    showTitle: show.title,
    venue: show.venue,
    date: schedule?.date ?? show.period,
    time: schedule?.times[0] ?? "",
    seat,
    price: `${amount.toLocaleString("ko-KR")}원`,
    status: "예매완료",
  };
}

const homeTicketReservations = homeTicketShows.map(reservationFromShow);

export const supportingReservations: Reservation[] = [
  {
    id: "CTI-260710-001",
    showSlug: "dracula",
    showTitle: "뮤지컬 드라큘라 (Dracula：The Musical)",
    venue: "LG아트센터 서울 LG SIGNATURE 홀",
    date: "2026.07.10",
    time: "19:30",
    seat: "VIP A열 12번",
    price: "180,000원",
    status: "예매완료",
  },
  {
    id: "CTI-26006232-001",
    showSlug: "beethoven",
    showTitle: "［Ticketground 단독］ 뮤지컬 〈베토벤〉",
    venue: "세종문화회관 대극장",
    date: "2026.06.30",
    time: "19:30",
    seat: "VIP A열 12번",
    price: "160,000원",
    status: "예매완료",
  },
  {
    id: "CTI-26007850-001",
    showSlug: "palette-festival",
    showTitle: "2026 Palette Festival",
    venue: "올림픽공원 88잔디마당",
    date: "2026.08.15",
    time: "12:00",
    seat: "1일권 A열 12번",
    price: "121,000원",
    status: "예매완료",
  },
  {
    id: "CTI-26008115-001",
    showSlug: "king-lear",
    showTitle: "국립극단 리어왕",
    venue: "명동예술극장",
    date: "2026.07.18",
    time: "19:30",
    seat: "R석 A열 12번",
    price: "70,000원",
    status: "예매완료",
  },
  {
    id: "CTI-26007169-001",
    showSlug: "berlin-phil",
    showTitle: "베를린필 내한공연",
    venue: "예술의전당 콘서트홀",
    date: "2026.10.21",
    time: "20:00",
    seat: "VIP석 A열 12번",
    price: "280,000원",
    status: "예매완료",
  },
  {
    id: "CTI-26008579-001",
    showSlug: "banksy",
    showTitle: "［얼리버드］ 뱅크시 : Still Here",
    venue: "더현대서울 6층 ALT.1",
    date: "2026.07.22",
    time: "10:30",
    seat: "성인 A열 12번",
    price: "13,800원",
    status: "예매완료",
  },
  {
    id: "CTI-26008899-001",
    showSlug: "breadbarbershop",
    showTitle: "브레드이발소 여름방학 특별전",
    venue: "한남동 블루스퀘어 NEMO",
    date: "2026.07.16",
    time: "10:30",
    seat: "성인 A열 12번",
    price: "18,000원",
    status: "예매완료",
  },
  ...homeTicketReservations,
];
