import type { PosterGradient } from "@/components/poster-card";

const R = "/images/real-posters";
const P = "/images/posters";

const posterImages = {
  iu: `${R}/iu-world-tour.jpg`,
  lesMiserables: `${R}/les-miserables-40.jpg`,
  berlinPhil: `${R}/berlin-phil.jpg`,
  seventeen: `${R}/seventeen-tour.png`,
  hadestown: `${R}/hadestown-window-card.png`,
  nctWish: `${R}/nct-wish.jpg`,
  choSeongJin: `${R}/cho-seong-jin.png`,
  phantom: `${R}/phantom-of-the-opera.png`,
  day6: `${R}/day6.jpg`,
  kingLear: `${R}/king-lear.jpg`,
  kunWooPaik: `${R}/kun-woo-paik.jpg`,
  cherryOrchard: `${R}/cherry-orchard.jpg`,
  paletteFestival: `${R}/palette-festival.gif`,
  beethoven: `${P}/P0004669_p.gif`,
  dracula: `${P}/L0000142_p.gif`,
} as const;

export type PosterFit = "cover" | "contain";

export type FeaturedShow = {
  readonly title: string;
  readonly eyebrow: string;
  readonly venue: string;
  readonly date: string;
  readonly href: string;
  readonly gradient: PosterGradient;
  readonly poster: string;
  readonly cta: string;
};

export type RankingShow = {
  readonly rank: number;
  readonly title: string;
  readonly venue: string;
  readonly date: string;
  readonly href: string;
  readonly movement: "up" | "down" | "same";
  readonly delta: string;
  readonly gradient: PosterGradient;
  readonly poster: string;
  readonly posterFit?: PosterFit;
};

export type TicketOpen = {
  readonly day: string;
  readonly month: string;
  readonly time: string;
  readonly title: string;
  readonly round: string;
  readonly dday: string;
};

export type EventCard = {
  readonly title: string;
  readonly description: string;
  readonly href: string;
  readonly tone: "dark" | "red" | "cream";
};

export type Recommendation = {
  readonly title: string;
  readonly venue: string;
  readonly date: string;
  readonly href: string;
  readonly gradient: PosterGradient;
  readonly poster: string;
  readonly posterFit?: PosterFit;
};

export type RecommendationGroup = {
  readonly title: string;
  readonly items: readonly Recommendation[];
};

export const featuredShow: FeaturedShow = {
  title: "IU 2026 WORLD TOUR",
  eyebrow: "FEATURED",
  venue: "잠실종합운동장 주경기장",
  date: "2026.09.12 ~ 2026.09.13",
  href: "/queue/iu-world-tour",
  gradient: "g1",
  poster: posterImages.iu,
  cta: "예매하기",
};

export const miniShows: readonly FeaturedShow[] = [
  {
    title: "레미제라블 40주년",
    eyebrow: "MUSICAL",
    venue: "블루스퀘어 신한카드홀",
    date: "2026.05.13 ~ 2026.08.30",
    href: "/goods/les-miserables",
    gradient: "g2",
    poster: posterImages.lesMiserables,
    cta: "상세보기",
  },
  {
    title: "베를린필 내한공연",
    eyebrow: "CLASSIC",
    venue: "예술의전당 콘서트홀",
    date: "2026.10.21",
    href: "/goods/berlin-phil",
    gradient: "g4",
    poster: posterImages.berlinPhil,
    cta: "알림받기",
  },
];

export const rankings: readonly RankingShow[] = [
  { rank: 1, title: "IU 2026 WORLD TOUR", venue: "잠실종합운동장", date: "2026.09.12", href: "/goods/iu-world-tour", movement: "up", delta: "2", gradient: "g1", poster: posterImages.iu },
  { rank: 2, title: "레미제라블 40주년", venue: "블루스퀘어", date: "2026.05.13", href: "/goods/les-miserables", movement: "same", delta: "-", gradient: "g2", poster: posterImages.lesMiserables },
  { rank: 3, title: "SEVENTEEN TOUR", venue: "고척스카이돔", date: "2026.08.08", href: "/contents/search?q=SEVENTEEN%20TOUR", movement: "up", delta: "1", gradient: "g6", poster: posterImages.seventeen },
  { rank: 4, title: "하데스타운", venue: "샤롯데씨어터", date: "2026.07.04", href: "/contents/search?q=%ED%95%98%EB%8D%B0%EC%8A%A4%ED%83%80%EC%9A%B4", movement: "down", delta: "1", gradient: "g10", poster: posterImages.hadestown },
  { rank: 5, title: "베를린필 내한공연", venue: "예술의전당", date: "2026.10.21", href: "/goods/berlin-phil", movement: "up", delta: "4", gradient: "g4", poster: posterImages.berlinPhil },
  { rank: 6, title: "NCT WISH FANMEETING", venue: "KSPO DOME", date: "2026.07.25", href: "/contents/search?q=NCT%20WISH%20FANMEETING", movement: "same", delta: "-", gradient: "g8", poster: posterImages.nctWish, posterFit: "contain" },
  { rank: 7, title: "조성진 피아노 리사이틀", venue: "롯데콘서트홀", date: "2026.11.02", href: "/contents/search?q=%EC%A1%B0%EC%84%B1%EC%A7%84%20%ED%94%BC%EC%95%84%EB%85%B8%20%EB%A6%AC%EC%82%AC%EC%9D%B4%ED%8B%80", movement: "up", delta: "3", gradient: "g9", poster: posterImages.choSeongJin },
  { rank: 8, title: "오페라의 유령", venue: "세종문화회관", date: "2026.06.30", href: "/contents/search?q=%EC%98%A4%ED%8E%98%EB%9D%BC%EC%9D%98%20%EC%9C%A0%EB%A0%B9", movement: "down", delta: "2", gradient: "g5", poster: posterImages.phantom },
  { rank: 9, title: "DAY6 Special Live", venue: "인스파이어 아레나", date: "2026.08.29", href: "/contents/search?q=DAY6%20Special%20Live", movement: "same", delta: "-", gradient: "g7", poster: posterImages.day6 },
  { rank: 10, title: "국립극단 리어왕", venue: "명동예술극장", date: "2026.07.18", href: "/goods/king-lear", movement: "up", delta: "5", gradient: "g12", poster: posterImages.kingLear, posterFit: "contain" },
];

export const ticketOpens: readonly TicketOpen[] = [
  { month: "07", day: "01", time: "20:00", title: "SEVENTEEN TOUR 고척", round: "팬클럽 선예매", dday: "D-3" },
  { month: "07", day: "03", time: "14:00", title: "레미제라블 40주년", round: "2차 티켓오픈", dday: "D-5" },
  { month: "07", day: "05", time: "12:00", title: "베를린필 내한공연", round: "일반예매", dday: "D-7" },
  { month: "07", day: "09", time: "19:00", title: "조성진 피아노 리사이틀", round: "클린티켓 오픈", dday: "D-11" },
];

export const events: readonly EventCard[] = [
  {
    title: "클린티켓 추천관",
    description: "공식 재판매와 동적 QR 입장이 적용된 공연만 모았습니다.",
    href: "/event/ticketground-day",
    tone: "dark",
  },
  {
    title: "여름 대형 콘서트",
    description: "고척, 잠실, KSPO 주요 좌석 오픈 일정을 한 화면에서 확인하세요.",
    href: "/event/ticketground-day",
    tone: "red",
  },
  {
    title: "첫 관람 뮤지컬",
    description: "러닝타임, 좌석 등급, 할인 정책을 비교하기 쉬운 입문 큐레이션입니다.",
    href: "/event/ticketground-day",
    tone: "cream",
  },
];

export const genreRecommendations: readonly RecommendationGroup[] = [
  {
    title: "콘서트 추천",
    items: [
      { title: "IU 2026 WORLD TOUR", venue: "잠실종합운동장", date: "2026.09.12", href: "/goods/iu-world-tour", gradient: "g1", poster: posterImages.iu },
      { title: "SEVENTEEN TOUR", venue: "고척스카이돔", date: "2026.08.08", href: "/contents/search?q=SEVENTEEN%20TOUR", gradient: "g6", poster: posterImages.seventeen },
      { title: "DAY6 Special Live", venue: "인스파이어 아레나", date: "2026.08.29", href: "/contents/search?q=DAY6%20Special%20Live", gradient: "g7", poster: posterImages.day6 },
      { title: "NCT WISH FANMEETING", venue: "KSPO DOME", date: "2026.07.25", href: "/contents/search?q=NCT%20WISH%20FANMEETING", gradient: "g8", poster: posterImages.nctWish, posterFit: "contain" },
      { title: "Palette Festival", venue: "KINTEX HALL 9", date: "2026.07.04", href: "/goods/palette-festival", gradient: "g11", poster: posterImages.paletteFestival, posterFit: "contain" },
    ],
  },
  {
    title: "뮤지컬 추천",
    items: [
      { title: "레미제라블 40주년", venue: "블루스퀘어", date: "2026.05.13", href: "/goods/les-miserables", gradient: "g2", poster: posterImages.lesMiserables },
      { title: "하데스타운", venue: "샤롯데씨어터", date: "2026.07.04", href: "/contents/search?q=%ED%95%98%EB%8D%B0%EC%8A%A4%ED%83%80%EC%9A%B4", gradient: "g10", poster: posterImages.hadestown },
      { title: "오페라의 유령", venue: "세종문화회관", date: "2026.06.30", href: "/contents/search?q=%EC%98%A4%ED%8E%98%EB%9D%BC%EC%9D%98%20%EC%9C%A0%EB%A0%B9", gradient: "g5", poster: posterImages.phantom },
      { title: "뮤지컬 베토벤", venue: "세종문화회관", date: "2026.06.18", href: "/goods/beethoven", gradient: "g9", poster: posterImages.beethoven, posterFit: "contain" },
      { title: "드라큘라", venue: "LG아트센터", date: "2026.07.10", href: "/goods/dracula", gradient: "g3", poster: posterImages.dracula, posterFit: "contain" },
    ],
  },
  {
    title: "연극·클래식 추천",
    items: [
      { title: "베를린필 내한공연", venue: "예술의전당", date: "2026.10.21", href: "/goods/berlin-phil", gradient: "g4", poster: posterImages.berlinPhil },
      { title: "조성진 피아노 리사이틀", venue: "롯데콘서트홀", date: "2026.11.02", href: "/contents/search?q=%EC%A1%B0%EC%84%B1%EC%A7%84%20%ED%94%BC%EC%95%84%EB%85%B8%20%EB%A6%AC%EC%82%AC%EC%9D%B4%ED%8B%80", gradient: "g9", poster: posterImages.choSeongJin },
      { title: "국립극단 리어왕", venue: "명동예술극장", date: "2026.07.18", href: "/goods/king-lear", gradient: "g12", poster: posterImages.kingLear, posterFit: "contain" },
      { title: "백건우와 라벨", venue: "통영국제음악당", date: "2026.09.04", href: "/contents/search?q=%EB%B0%B1%EA%B1%B4%EC%9A%B0%EC%99%80%20%EB%9D%BC%EB%B2%A8", gradient: "g8", poster: posterImages.kunWooPaik },
      { title: "연극 벚꽃동산", venue: "대학로예술극장", date: "2026.08.06", href: "/contents/search?q=%EC%97%B0%EA%B7%B9%20%EB%B2%9A%EA%BD%83%EB%8F%99%EC%82%B0", gradient: "g11", poster: posterImages.cherryOrchard },
    ],
  },
];

export const shortcuts = [
  { label: "지방 공연", href: "/contents/region", helper: "부산·대구·광주" },
  { label: "대학로", href: "/contents/genre/musical", helper: "소극장 신작" },
  { label: "재판매", href: "/resale", helper: "공식 풀 거래" },
  { label: "VIP석", href: "/contents/ranking", helper: "등급별 보기" },
  { label: "오픈캘린더", href: "/open", helper: "D-3 알림" },
  { label: "당일 공연", href: "/contents/search", helper: "오늘 입장 가능" },
] as const;
