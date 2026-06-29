import type { DealItem, OpenItem, PlayItem, ProductItem, RankingItem, ReviewItem } from "@/types";

const P = "/images/posters";

export const categoryNav = [
  "홈",
  "콘서트",
  "뮤지컬",
  "연극",
  "클래식",
  "전시",
  "아동",
  "스포츠",
];
export const categoryNavHighlight = ["티켓오픈 캘린더"];

// Top promo row — baked mini banners (rotating)
export const promoBanners = [
  "/images/mini/260626045828_26006325.gif",
  "/images/mini/260626045850_26008174.gif",
  "/images/mini/260626045915_26002729.gif",
];

export const genreTabs = [
  "뮤지컬",
  "콘서트",
  "스포츠",
  "전시/행사",
  "클래식/무용",
  "아동/가족",
  "연극",
  "레저/캠핑",
];

export const ranking: RankingItem[] = [
  { rank: 1, title: "뮤지컬 드라큘라 (Dracula：The Musical)", venue: "LG아트센터 서울 LG SIGNATURE 홀", date: "2026.7.10 ~ 10.18", poster: `${P}/L0000142_p.gif`, badge: "좌석우위" },
  { rank: 2, title: "뮤지컬 〈베토벤〉", venue: "세종문화회관 대극장", date: "2026.6.9 ~ 8.11", poster: `${P}/P0004669_p.gif` },
  { rank: 3, title: "뮤지컬 〈빌리 엘리어트〉", venue: "블루스퀘어 우리은행홀", date: "2026.4.12 ~ 7.26", poster: `${P}/26001001_p.gif`, badge: "단독판매" },
  { rank: 4, title: "뮤지컬 〈소년의 초상〉", venue: "대학로 TOM(티오엠) 2관", date: "2026.7.28 ~ 10.18", poster: `${P}/26008698_p.gif`, badge: "단독판매" },
  { rank: 5, title: "뮤지컬 서편제", venue: "광림아트센터 BBCH홀", date: "2026.4.30 ~ 7.19", poster: `${P}/26003126_p.gif`, badge: "좌석우위" },
  { rank: 6, title: "뮤지컬 〈그날들〉", venue: "디큐브 링크아트센터", date: "2026.6.9 ~ 8.23", poster: `${P}/26005310_p.gif`, badge: "좌석우위" },
  { rank: 7, title: "뮤지컬 〈브라더스 까라마조프〉", venue: "Ticketground 씨어터 대학로 우리투자증권홀", date: "2026.5.12 ~ 9.6", poster: `${P}/26004473_p.gif`, badge: "단독판매" },
  { rank: 8, title: "뮤지컬 〈유미의 세포들〉", venue: "예술의전당 CJ 토월극장", date: "2026.6.30 ~ 8.23", poster: `${P}/26006325_p.gif`, badge: "좌석우위" },
  { rank: 9, title: "뮤지컬 〈스윙 데이즈_암호명 A〉", venue: "충무아트센터 대극장", date: "2026.4.16 ~ 7.5", poster: `${P}/26001111_p.gif`, badge: "단독판매" },
  { rank: 10, title: "최현우 FaTe - 서울", venue: "소월아트홀", date: "2026.8.1 ~ 8.23", poster: `${P}/26007823_p.gif`, badge: "단독판매" },
];

export const openingSoon: OpenItem[] = [
  { time: "내일 19:00", title: "TAKUYA KIMURA Live Tour 2026 Checkpoint in Seoul", type: "일반예매", poster: `${P}/26008115_p.gif`, hot: true, tag: "단독판매" },
  { time: "내일 19:00", title: "BOYNEXTDOOR TOUR ‘KNOCK ON Vol.2’ IN BUSAN", type: "국내 선예매", poster: `${P}/26008566_p.gif`, hot: true, tag: "단독판매" },
  { time: "07.02(목) 14:00", title: "뮤지컬 〈겨울왕국〉 한국 초연 (FROZEN The Musical)", type: "2차티켓오픈", poster: `${P}/26007416_p.gif`, hot: true },
  { time: "내일 19:00", title: "B1A4 15주년 단독 콘서트 〈D-day〉", type: "팬클럽 선예매", poster: `${P}/26008757_p.gif`, hot: true },
  { time: "06.30(화) 11:00", title: "뮤지컬 〈엘리자벳〉", type: "일반예매", poster: `${P}/26009314_p.gif`, hot: true, tag: "좌석우위" },
  { time: "07.03(금) 12:00", title: "더못 케네디 첫 단독 내한공연", type: "일반예매", poster: `${P}/26009306_p.gif`, tag: "단독판매" },
];

export const playTabs = ["추천영상", "뮤지컬", "콘서트", "전시/행사", "클래식/무용", "연극"];
export const ticketgroundPlay: PlayItem[] = [
  { title: "뮤지컬<드라큘라>", thumb: `${P}/L0000142_p.gif`, poster: `${P}/L0000142_p.gif`, duration: "" },
  { title: "뮤지컬<겨울왕국>", thumb: `${P}/26007416_p.gif`, poster: `${P}/26007416_p.gif`, duration: "00:31" },
  { title: "뮤지컬<헬스키친>", thumb: `${P}/26008537_p.gif`, poster: `${P}/26008537_p.gif`, duration: "00:59" },
  { title: "뮤지컬<베토벤>", thumb: `${P}/P0004669_p.gif`, poster: `${P}/P0004669_p.gif`, duration: "00:45" },
];

export const timeDeals: DealItem[] = [
  { badge: "타임딜", countdown: "10:11:48", title: "［Ticketground 단독］ 뮤지컬 〈베토벤〉", venue: "세종문화회관 대극장", date: "2026.6.18 ~ 7.3", discountLabel: "S,A,B석 할인", percent: "30%", price: "56,000원", poster: `${P}/26006232_p.gif` },
  { badge: "타임딜", countdown: "D-1 10:11:48", title: "뮤지컬 〈오즈〉", venue: "대학로 TOM(티오엠) 2관", date: "2026.5.5 ~ 7.19", discountLabel: "S,A 할인", percent: "50%", price: "22,000원", poster: `${P}/26004937_p.gif` },
  { badge: "타임딜", countdown: "10:11:48", title: "뮤지컬 〈어서 오세요, 휴남동 서점입니다〉 - 서울", venue: "루미나아트홀", date: "2025.3.1 ~ 2026.8.31", discountLabel: "전석 할인", percent: "50%", price: "33,000원", poster: `${P}/26002729_p.gif` },
  { badge: "타임딜", countdown: "D-1 10:11:48", title: "연극 〈오이디푸스〉", venue: "세종문화회관 M씨어터", date: "2026.7.4 ~ 8.23", discountLabel: "전석 할인", percent: "40%", price: "42,000원", poster: `${P}/P0004710_p.gif` },
  { badge: "파이널콜", countdown: "LAST DAY", title: "연극 〈꽃, 별이 지나〉", venue: "Ticketground 서경스퀘어 스콘 1관", date: "2026.6.23 ~ 6.28", discountLabel: "임박공연특가", percent: "50%", price: "27,500원", poster: `${P}/26008990_p.gif` },
  { badge: "파이널콜", countdown: "LAST DAY", title: "연극〈늘근도둑이야기〉", venue: "대학로 아트포레스트 1관", date: "2025.7.1 ~ 2026.7.5", discountLabel: "임박공연특가", percent: "76%", price: "12,000원", poster: `${P}/25009291_p.gif` },
];

export const mdPickTabs = ["오직 Ticketground에서만", "핫이슈 클래식&무용", "화제의 전시"];
export const mdPick: ProductItem[] = [
  { title: "뮤직드라마 〈불편한 편의점〉 - 올웨이즈씨어터", venue: "올웨이즈씨어터", date: "2023.4.8 ~ 2026.8.30", poster: `${P}/26002626_p.gif` },
  { title: "뮤지컬 〈어서 오세요, 휴남동 서점입니다〉 - 서울", venue: "루미나아트홀", date: "2025.3.1 ~ 2026.8.31", poster: `${P}/26002729_p.gif` },
  { title: "2026 XLOV ASIA TOUR 〈Serving-X〉 IN SEOUL", venue: "블루스퀘어 우리WON뱅킹홀", date: "2026.7.18 ~ 7.19", poster: `${P}/26008678_p.gif` },
  { title: "쏜애플 콘서트 ‘나의 세기’ - 서울", venue: "올림픽공원 올림픽홀", date: "2026.8.15 ~ 8.16", poster: `${P}/26008537_p.gif` },
  { title: "뮤지컬 〈피리 부는 사나이〉", venue: "국립정동극장", date: "2026.6.12 ~ 8.2", poster: `${P}/26006201_p.gif` },
  { title: "뮤지컬 〈비더슈탄트〉", venue: "링크아트센터드림 드림1관", date: "2026.7.23 ~ 10.11", poster: `${P}/26008861_p.gif` },
];

export const keywordTabs = ["👍 재관람률 높은", "🧸 아이와 함께", "🤡 대학로 연극 추천"];
export const recommendKeyword: ProductItem[] = [
  { title: "용인어린이상상의숲 요리조리스튜디오 〈상상파티시엘1〉", venue: "용인어린이상상의숲 요리조리스튜디오", date: "2026.3.13 ~ 7.19", poster: `${P}/26002657_p.gif` },
  { title: "뮤지컬 〈브라더스 까라마조프〉", venue: "Ticketground 씨어터 대학로 우리투자증권홀", date: "2026.5.12 ~ 9.6", poster: `${P}/26004473_p.gif` },
  { title: "뮤지컬 〈어둑시니〉", venue: "Ticketground 서경스퀘어 스콘 2관", date: "2026.6.9 ~ 8.30", poster: `${P}/26006560_p.gif` },
  { title: "뮤지컬 〈6시퇴근〉", venue: "예그린씨어터", date: "2026.5.1 ~ 7.26", poster: `${P}/26004768_p.gif` },
  { title: "2026 뮤지컬 〈Mad Hatter〉", venue: "대학로 TOM(티오엠) 1관", date: "2026.6.9 ~ 8.30", poster: `${P}/26006189_p.gif` },
  { title: "뮤지컬 〈오즈〉", venue: "대학로 TOM(티오엠) 2관", date: "2026.5.5 ~ 7.19", poster: `${P}/26004937_p.gif` },
];

const A = "/images/profiles";
export const reviews: ReviewItem[] = [
  {
    show: "연극 〈내가 하면 로맨스〉",
    headline: "섹시 코믹ㅎㅎ 재밌어요ㅎㅎ",
    body: "유쾌하고 너무 재밌습니다 시간가는줄 모르겠어요ㅎ",
    user: "kje****",
    score: "9.6",
    avatar: `${A}/m_3.svg`,
    poster: `${P}/26006201_p.gif`,
  },
  {
    show: "연극 〈댄포스가 옳았다〉",
    headline: "두 배우가 만들어낸 밀도 높은 심리전, 댄포스가 옳았다",
    body: "오랜만에 심리극을 관람했는데, 시작부터 끝까지 긴장감을 놓을 수 없어 정말 재미있게 봤습니다. 2인극이라는 점 때문에 처음에는 무대가 다소 단조롭지 않을까 생각했지만, 두 배우의 탄탄한 연기 덕분에 공연 내내 무대가 빈틈없이 꽉 차 있는 느낌을 받았습니다. 인물 간의 팽팽한 심리전과 대...",
    user: "som*******",
    score: "9.5",
    avatar: `${A}/m_4.svg`,
    poster: `${P}/26008678_p.gif`,
  },
  {
    show: "위험한 사람들",
    headline: "바람피지맙시다 ㅋㅋ",
    body: "머리나쁘면 바람피기도 쉽지않네요 ㅋㅋ",
    user: "aes*****",
    score: "9.7",
    avatar: `${A}/m_2.svg`,
    poster: `${P}/26002626_p.gif`,
  },
  {
    show: "뮤지컬 서편제",
    headline: "떠도는거 같지만 내가 나의 소리가 중심이 되어 세상을…",
    body: "한국의 소리 판소리에는 한이 서려있는 듯 서편제를 보는 내내 그리고 끝난 뒤에도 그 여운은 쉽게 사라지지 않고 아직도 마음속에서 울리고 있는 듯 하다. 진정한 소리를 내기 위해 자신과 딸 그리고 부인과 의붓 아들의 삶과 모든 걸 걸고 또 모든 걸 포기하고 소리만을 쫓아 나아가는 아버지 그리고…",
    user: "cal*****",
    score: "9.6",
    avatar: `${A}/w_1.svg`,
    poster: `${P}/26003126_p.gif`,
  },
];

export const footerLinks = [
  { label: "회사소개", href: "/event/ticketground-day" },
  { label: "이용약관", href: "/help" },
  { label: "개인정보처리방침", href: "/help" },
  { label: "티켓판매안내", href: "/open" },
] as const;

export const footerColumnLinks = [
  {
    title: "예매",
    links: [
      { label: "티켓오픈 캘린더", href: "/open" },
      { label: "랭킹", href: "/contents/ranking" },
      { label: "공연장", href: "/place" },
    ],
  },
  {
    title: "마이",
    links: [
      { label: "예매내역", href: "/mypage#reservations" },
      { label: "관심공연", href: "/watchlist" },
      { label: "취소/환불", href: "/cancel" },
    ],
  },
  {
    title: "고객센터",
    links: [
      { label: "고객센터 홈", href: "/help" },
      { label: "1:1 문의", href: "/inquiry" },
      { label: "공지사항", href: "/contents/notice" },
    ],
  },
] as const;
