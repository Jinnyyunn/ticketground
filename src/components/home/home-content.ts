import type { PosterGradient } from "@/components/poster-card";
import type { CategoryId } from "@/components/header-links";

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

export type EditorialEventId = "cleanTicketPicks" | "summerConcerts" | "firstMusical";

export type EventCard = {
  readonly id: EditorialEventId;
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
  readonly categoryId: CategoryId;
  readonly items: readonly Recommendation[];
};

export const featuredShow: FeaturedShow = {
  title: "IU 2026 WORLD TOUR",
  eyebrow: "FEATURED",
  venue: "잠실종합운동장 주경기장",
  date: "2026.09.12 ~ 2026.09.13",
  href: "/goods/iu-world-tour",
  gradient: "g1",
  poster: posterImages.iu,
};

export const miniShows: readonly FeaturedShow[] = [
  {
    title: "베를린필 내한공연",
    eyebrow: "CLASSIC",
    venue: "예술의전당 콘서트홀",
    date: "2026.10.21",
    href: "/goods/berlin-phil",
    gradient: "g4",
    poster: posterImages.berlinPhil,
  },
];

// Poster lookup for the ticket-open thumbnail, matched by fuzzy title -
// decoupled from the (now live-data-driven) ranking list.
export const ticketOpenPosters: Record<string, string> = {
  "SEVENTEEN TOUR": posterImages.seventeen,
  "베를린필 내한공연": posterImages.berlinPhil,
};

export const ticketOpens: readonly TicketOpen[] = [
  { month: "07", day: "01", time: "20:00", title: "SEVENTEEN TOUR 고척", round: "팬클럽 선예매", dday: "D-3" },
  { month: "07", day: "05", time: "12:00", title: "베를린필 내한공연", round: "일반예매", dday: "D-7" },
];

export const events: readonly EventCard[] = [
  { id: "cleanTicketPicks", href: "/event/ticketground-day", tone: "dark" },
  { id: "summerConcerts", href: "/event/ticketground-day", tone: "red" },
  { id: "firstMusical", href: "/event/ticketground-day", tone: "cream" },
];

export const genreRecommendations: readonly RecommendationGroup[] = [
  {
    categoryId: "concert",
    items: [
      { title: "IU 2026 WORLD TOUR", venue: "잠실종합운동장", date: "2026.09.12", href: "/goods/iu-world-tour", gradient: "g1", poster: posterImages.iu },
      { title: "SEVENTEEN TOUR", venue: "고척스카이돔", date: "2026.08.08", href: "/goods/seventeen-tour", gradient: "g6", poster: posterImages.seventeen },
      { title: "DAY6 Special Live", venue: "인스파이어 아레나", date: "2026.08.29", href: "/goods/day6-special-live", gradient: "g7", poster: posterImages.day6 },
      { title: "NCT WISH FANMEETING", venue: "KSPO DOME", date: "2026.07.25", href: "/goods/nct-wish-fanmeeting", gradient: "g8", poster: posterImages.nctWish, posterFit: "contain" },
      { title: "Palette Festival", venue: "KINTEX HALL 9", date: "2026.07.04", href: "/goods/palette-festival", gradient: "g11", poster: posterImages.paletteFestival, posterFit: "contain" },
    ],
  },
  {
    categoryId: "musical",
    items: [
      { title: "오페라의 유령", venue: "세종문화회관", date: "2026.06.30", href: "/goods/phantom-of-the-opera", gradient: "g5", poster: posterImages.phantom },
      { title: "뮤지컬 베토벤", venue: "세종문화회관", date: "2026.06.18", href: "/goods/beethoven", gradient: "g9", poster: posterImages.beethoven, posterFit: "contain" },
      { title: "드라큘라", venue: "LG아트센터", date: "2026.07.10", href: "/goods/dracula", gradient: "g3", poster: posterImages.dracula, posterFit: "contain" },
    ],
  },
  {
    categoryId: "theater",
    items: [
      { title: "연극 벚꽃동산", venue: "대학로예술극장", date: "2026.08.06", href: "/goods/cherry-orchard", gradient: "g11", poster: posterImages.cherryOrchard },
    ],
  },
  {
    categoryId: "classical",
    items: [
      { title: "베를린필 내한공연", venue: "예술의전당", date: "2026.10.21", href: "/goods/berlin-phil", gradient: "g4", poster: posterImages.berlinPhil },
      { title: "백건우와 라벨", venue: "통영국제음악당", date: "2026.09.04", href: "/goods/kun-woo-paik-ravel", gradient: "g8", poster: posterImages.kunWooPaik },
    ],
  },
  {
    categoryId: "exhibition",
    items: [],
  },
  {
    categoryId: "kids",
    items: [],
  },
  {
    categoryId: "sports",
    items: [],
  },
];

export type ShortcutId = "regional" | "daehakro" | "resale" | "vip" | "calendar" | "sameDay";

export const shortcuts: readonly { readonly id: ShortcutId; readonly href: string }[] = [
  { id: "regional", href: "/contents/region" },
  { id: "daehakro", href: "/contents/genre/musical" },
  { id: "resale", href: "/resale" },
  { id: "vip", href: "/contents/ranking" },
  { id: "calendar", href: "/open" },
  { id: "sameDay", href: "/contents/search" },
];
