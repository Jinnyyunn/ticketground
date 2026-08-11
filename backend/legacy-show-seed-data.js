// Shared source data for the 17 legacy catalog shows migrated onto the admin event schema.
// Consumed by both the one-off admin-API migration script (scripts/migrate-legacy-shows.mjs)
// and the durable backend seed (catalog-data.js), so every environment (dev, test, fresh deploy)
// ends up with the same events, addressed by the same deterministic stableId.
export const legacyVenueIdByName = {
  "잠실종합운동장 주경기장": "venue_jamsil_sports_complex_main_stadium",
  "LG아트센터 서울 LG SIGNATURE 홀": "venue_lg_arts_center_seoul_lg_signature_hall",
  "세종문화회관 대극장": "venue_sejong_grand_theater",
  "KINTEX HALL 9": "venue_kintex_hall_9",
  "명동예술극장": "venue_myeongdong_theater",
  "예술의전당 콘서트홀": "venue_seoul_arts_center_concert_hall",
  "더현대서울 6층 ALT.1": "venue_thehyundai_seoul_alt1",
  "한남동 블루스퀘어 NEMO": "venue_bluesquare_nemo",
  "고척스카이돔": "venue_gocheok_sky_dome",
  "샤롯데씨어터": "venue_charlotte_theater",
  "KSPO DOME": "venue_kspo_dome_catalog",
  "롯데콘서트홀": "venue_lotte_concert_hall",
  "세종문화회관": "venue_sejong_center",
  "인스파이어 아레나": "venue_inspire_arena",
  "통영국제음악당": "venue_tongyeong_concert_hall",
  "대학로예술극장": "venue_daehakro_arts_theater",
  "블루스퀘어 신한카드홀": "venue_bluesquare_shinhan_card_hall"
};

export const legacyCategoryToAdminCategory = {
  "콘서트": "concert",
  "뮤지컬": "musical",
  "연극": "theater",
  "클래식": "classic",
  "전시/행사": "exhibition",
  "아동/가족": "children",
  "스포츠": "sports"
};

export const legacyShows = [
  // --- ticketing-catalog.ts (supporting) ---
  {
    slug: "iu-world-tour", category: "콘서트", title: "IU 2026 WORLD TOUR", shortTitle: "IU 2026 WORLD TOUR",
    venue: "잠실종합운동장 주경기장", startsAt: "2026-09-12T19:00:00+09:00", period: "2026.09.12 ~ 2026.09.13",
    runtime: "150분", ageLimit: "8세 이상 관람가", poster: "public/images/real-posters/iu-world-tour.jpg", badge: "단독판매",
    prices: [{ grade: "VIP", seat: "VIP석", price: 198000 }, { grade: "R", seat: "R석", price: 165000 }, { grade: "S", seat: "S석", price: 132000 }, { grade: "A", seat: "A석", price: 99000 }],
    schedules: [{ label: "9월 12일", date: "2026.09.12", times: ["19:00"] }, { label: "9월 13일", date: "2026.09.13", times: ["18:00"] }],
    casts: ["IU", "밴드", "스트링 세션"],
    notices: ["회차별 1인 2매까지 예매할 수 있습니다.", "모바일 티켓과 현장 본인 확인이 함께 진행됩니다.", "CLEAN 티켓 공식 양도 정책은 공연별 공지에 따라 제한될 수 있습니다."],
    summary: "잠실종합운동장에서 열리는 IU 월드투어 서울 공연입니다. 홈 대표 카드와 대기열 예매 흐름의 기준 상품입니다."
  },
  {
    slug: "dracula", category: "뮤지컬", title: "뮤지컬 드라큘라 (Dracula：The Musical)", shortTitle: "뮤지컬 드라큘라",
    venue: "LG아트센터 서울 LG SIGNATURE 홀", startsAt: "2026-07-10T19:30:00+09:00", period: "2026.07.10 ~ 2026.10.18",
    runtime: "165분(인터미션 20분 포함)", ageLimit: "14세 이상 관람가", poster: "public/images/posters/L0000142_p.gif", badge: "좌석우위", artistSlug: "dracula-cast",
    prices: [{ grade: "OP", seat: "OP석", price: 180000 }, { grade: "VIP", seat: "VIP석", price: 180000 }, { grade: "R", seat: "R석", price: 150000 }, { grade: "S", seat: "S석", price: 110000 }, { grade: "A", seat: "A석", price: 80000 }],
    schedules: [{ label: "7월 10일", date: "2026.07.10", times: ["19:30"] }, { label: "7월 11일", date: "2026.07.11", times: ["14:00", "19:00"] }, { label: "7월 12일", date: "2026.07.12", times: ["13:00", "18:00"] }],
    casts: ["신성록", "김준수", "전동석", "조정은", "강태을", "진태화", "이예은", "조성린"],
    notices: ["예매가능시간: 관람 3시간 전까지", "회차별 1인 4매까지 예매할 수 있습니다.", "본 공연은 예매대기 및 취소 후 재예매 서비스가 제공되지 않습니다."],
    summary: "강렬한 로맨스와 고딕 무대가 결합된 대표 뮤지컬. 좌석 등급과 회차를 선택해 예매 흐름을 확인할 수 있습니다."
  },
  {
    slug: "beethoven", category: "뮤지컬", title: "［Ticketground 단독］ 뮤지컬 〈베토벤〉", shortTitle: "뮤지컬 베토벤",
    venue: "세종문화회관 대극장", startsAt: "2026-06-30T19:30:00+09:00", period: "2026.06.18 ~ 2026.07.03",
    runtime: "160분", ageLimit: "8세 이상 관람가", poster: "public/images/posters/26006232_p.gif", badge: "타임딜",
    prices: [{ grade: "VIP", seat: "VIP석", price: 160000 }, { grade: "R", seat: "R석", price: 130000 }, { grade: "S", seat: "S석", price: 90000 }, { grade: "A", seat: "A석", price: 60000 }],
    schedules: [{ label: "6월 30일", date: "2026.06.30", times: ["19:30"] }, { label: "7월 2일", date: "2026.07.02", times: ["14:30", "19:30"] }],
    casts: ["박은태", "카이", "조정은", "옥주현"],
    notices: ["Ticketground 단독 타임딜 회차입니다.", "일부 좌석은 할인 적용에서 제외됩니다."],
    summary: "베토벤의 음악과 삶을 무대 위 드라마로 풀어낸 대표 라이선스 뮤지컬입니다."
  },
  {
    slug: "palette-festival", category: "콘서트", title: "2026 Palette Festival", shortTitle: "Palette Festival",
    venue: "KINTEX HALL 9", startsAt: "2026-07-04T12:00:00+09:00", period: "2026.07.04 ~ 2026.07.05",
    runtime: "480분", ageLimit: "전체 관람가", poster: "public/images/real-posters/palette-festival.gif", badge: "단독판매",
    prices: [{ grade: "PASS", seat: "1일권", price: 121000 }, { grade: "PASS2", seat: "양일권", price: 198000 }],
    schedules: [{ label: "7월 4일", date: "2026.07.04", times: ["12:00"] }, { label: "7월 5일", date: "2026.07.05", times: ["12:00"] }],
    casts: ["데이브레이크", "하츠웨이브", "더못 케네디"],
    notices: ["야외 공연으로 우천 시에도 진행됩니다.", "예매 전 관람 안내를 확인해 주세요."],
    summary: "여름 야외 페스티벌형 콘서트 예매를 대표하는 레퍼런스 상품입니다."
  },
  {
    slug: "king-lear", category: "연극", title: "국립극단 리어왕", shortTitle: "국립극단 리어왕",
    venue: "명동예술극장", startsAt: "2026-07-18T19:30:00+09:00", period: "2026.07.18 ~ 2026.08.10",
    runtime: "160분", ageLimit: "14세 이상 관람가", poster: "public/images/real-posters/king-lear.jpg", badge: "클린티켓",
    prices: [{ grade: "R", seat: "R석", price: 70000 }, { grade: "S", seat: "S석", price: 50000 }, { grade: "A", seat: "A석", price: 30000 }],
    schedules: [{ label: "7월 18일", date: "2026.07.18", times: ["19:30"] }, { label: "7월 19일", date: "2026.07.19", times: ["15:00"] }, { label: "7월 20일", date: "2026.07.20", times: ["15:00"] }],
    casts: ["국립극단", "리어", "코델리아"],
    notices: ["연극 장르 대표 예매 흐름입니다.", "공식 양도와 취소 정책은 CLEAN 티켓 기준을 따릅니다."],
    summary: "셰익스피어 비극을 국립극단 무대로 만나는 연극 예매 대표 상품입니다."
  },
  {
    slug: "berlin-phil", category: "클래식", title: "베를린필 내한공연", shortTitle: "베를린필 내한공연",
    venue: "예술의전당 콘서트홀", startsAt: "2026-10-21T20:00:00+09:00", period: "2026.10.21",
    runtime: "120분", ageLimit: "8세 이상 관람가", poster: "public/images/real-posters/berlin-phil.jpg", badge: "좌석우위",
    prices: [{ grade: "VIP", seat: "VIP석", price: 280000 }, { grade: "R", seat: "R석", price: 220000 }, { grade: "S", seat: "S석", price: 160000 }, { grade: "A", seat: "A석", price: 90000 }],
    schedules: [{ label: "10월 21일", date: "2026.10.21", times: ["20:00"] }, { label: "10월 22일", date: "2026.10.22", times: ["20:00"] }],
    casts: ["베를린 필하모닉", "상임지휘자"],
    notices: ["클래식 장르 대표 예매 흐름입니다.", "회차별 1인 2매까지 예매할 수 있습니다."],
    summary: "예술의전당에서 열리는 베를린 필하모닉 내한공연 예매 대표 상품입니다."
  },
  {
    slug: "banksy", category: "전시/행사", title: "［얼리버드］ 뱅크시 : Still Here", shortTitle: "뱅크시 : Still Here",
    venue: "더현대서울 6층 ALT.1", startsAt: "2026-07-22T10:30:00+09:00", period: "2026.07.22 ~ 2026.11.03",
    runtime: "60분", ageLimit: "전체 관람가", poster: "public/images/posters/26008579_p.gif", badge: "얼리버드",
    prices: [{ grade: "ADULT", seat: "성인", price: 13800 }, { grade: "YOUTH", seat: "청소년", price: 9900 }],
    schedules: [{ label: "7월 22일", date: "2026.07.22", times: ["10:30", "14:00", "18:00"] }, { label: "7월 23일", date: "2026.07.23", times: ["10:30", "14:00", "18:00"] }],
    casts: ["전시"],
    notices: ["회차별 입장 시간이 지정됩니다.", "재입장은 불가합니다."],
    summary: "전시/행사 장르의 시간대 선택형 예매 흐름을 보여주는 대표 상품입니다."
  },
  {
    slug: "breadbarbershop", category: "아동/가족", title: "브레드이발소 여름방학 특별전", shortTitle: "브레드이발소",
    venue: "한남동 블루스퀘어 NEMO", startsAt: "2026-07-16T10:30:00+09:00", period: "2026.07.16 ~ 2026.09.06",
    runtime: "60분", ageLimit: "전체 관람가", poster: "public/images/posters/26008899_p.gif", badge: "가족추천",
    prices: [{ grade: "ADULT", seat: "성인", price: 18000 }, { grade: "YOUTH", seat: "어린이", price: 15000 }],
    schedules: [{ label: "7월 16일", date: "2026.07.16", times: ["10:30", "14:00", "16:30"] }, { label: "7월 17일", date: "2026.07.17", times: ["10:30", "14:00", "16:30"] }, { label: "7월 18일", date: "2026.07.18", times: ["10:30", "14:00", "16:30"] }],
    casts: ["브레드", "윌크", "초코", "마카롱"],
    notices: ["아동/가족 장르 대표 예매 흐름입니다.", "보호자 동반 입장과 회차별 입장 시간이 지정됩니다."],
    summary: "브레드이발소 캐릭터를 체험형 전시와 공연으로 만나는 아동/가족 대표 상품입니다."
  },
  // --- home-ticketing-catalog.ts (iu-world-tour skipped as duplicate slug of the more complete entry above) ---
  {
    slug: "seventeen-tour", category: "콘서트", title: "SEVENTEEN TOUR", shortTitle: "SEVENTEEN TOUR",
    venue: "고척스카이돔", startsAt: "2026-08-08T18:00:00+09:00", period: "2026.08.08 ~ 2026.08.09",
    runtime: "160분", ageLimit: "8세 이상 관람가", poster: "public/images/real-posters/seventeen-tour.png", badge: "팬클럽 선예매",
    prices: [{ grade: "VIP", seat: "VIP석", price: 198000 }, { grade: "R", seat: "R석", price: 176000 }, { grade: "S", seat: "S석", price: 154000 }],
    schedules: [{ label: "8월 8일", date: "2026.08.08", times: ["18:00"] }, { label: "8월 9일", date: "2026.08.09", times: ["17:00"] }],
    casts: ["SEVENTEEN"],
    notices: ["팬클럽 선예매 이후 잔여석 일반 예매가 진행됩니다.", "무통장 입금 제한 회차입니다."],
    summary: "고척스카이돔에서 열리는 SEVENTEEN 투어 대표 공연입니다."
  },
  {
    slug: "hadestown", category: "뮤지컬", title: "하데스타운", shortTitle: "하데스타운",
    venue: "샤롯데씨어터", startsAt: "2026-07-04T19:30:00+09:00", period: "2026.07.04 ~ 2026.09.27",
    runtime: "155분(인터미션 20분 포함)", ageLimit: "8세 이상 관람가", poster: "public/images/real-posters/hadestown-window-card.png", badge: "클린티켓",
    prices: [{ grade: "VIP", seat: "VIP석", price: 170000 }, { grade: "R", seat: "R석", price: 140000 }, { grade: "S", seat: "S석", price: 100000 }, { grade: "A", seat: "A석", price: 70000 }],
    schedules: [{ label: "7월 4일", date: "2026.07.04", times: ["19:30"] }, { label: "7월 5일", date: "2026.07.05", times: ["14:00", "19:00"] }],
    casts: ["오르페우스", "에우리디케", "하데스", "페르세포네"],
    notices: ["CLEAN 티켓 공식 양도는 정가 범위 안에서만 등록할 수 있습니다.", "캐스팅은 회차별로 달라질 수 있습니다."],
    summary: "샤롯데씨어터에서 만나는 뮤지컬 하데스타운 대표 회차입니다."
  },
  {
    slug: "nct-wish-fanmeeting", category: "콘서트", title: "NCT WISH FANMEETING", shortTitle: "NCT WISH FANMEETING",
    venue: "KSPO DOME", startsAt: "2026-07-25T18:00:00+09:00", period: "2026.07.25",
    runtime: "140분", ageLimit: "8세 이상 관람가", poster: "public/images/real-posters/nct-wish.jpg", badge: "팬미팅",
    prices: [{ grade: "R", seat: "R석", price: 143000 }, { grade: "S", seat: "S석", price: 121000 }],
    schedules: [{ label: "7월 25일", date: "2026.07.25", times: ["18:00"] }],
    casts: ["NCT WISH"],
    notices: ["팬클럽 인증 구간이 포함됩니다.", "공연 당일 현장 수령 좌석이 있을 수 있습니다."],
    summary: "KSPO DOME에서 열리는 NCT WISH 팬미팅 대표 공연입니다."
  },
  {
    slug: "cho-seong-jin", category: "클래식", title: "조성진 피아노 리사이틀", shortTitle: "조성진 피아노 리사이틀",
    venue: "롯데콘서트홀", startsAt: "2026-11-02T20:00:00+09:00", period: "2026.11.02",
    runtime: "120분", ageLimit: "8세 이상 관람가", poster: "public/images/real-posters/cho-seong-jin.png", badge: "클린티켓",
    prices: [{ grade: "VIP", seat: "VIP석", price: 220000 }, { grade: "R", seat: "R석", price: 180000 }, { grade: "S", seat: "S석", price: 120000 }],
    schedules: [{ label: "11월 2일", date: "2026.11.02", times: ["20:00"] }],
    casts: ["조성진"],
    notices: ["회차별 1인 2매까지 예매할 수 있습니다.", "공연 시작 후 입장이 제한될 수 있습니다."],
    summary: "롯데콘서트홀에서 열리는 조성진 피아노 리사이틀 대표 공연입니다."
  },
  {
    slug: "phantom-of-the-opera", category: "뮤지컬", title: "오페라의 유령", shortTitle: "오페라의 유령",
    venue: "세종문화회관", startsAt: "2026-06-30T19:30:00+09:00", period: "2026.06.30 ~ 2026.09.06",
    runtime: "150분(인터미션 20분 포함)", ageLimit: "8세 이상 관람가", poster: "public/images/real-posters/phantom-of-the-opera.png",
    prices: [{ grade: "VIP", seat: "VIP석", price: 180000 }, { grade: "R", seat: "R석", price: 150000 }, { grade: "S", seat: "S석", price: 110000 }],
    schedules: [{ label: "6월 30일", date: "2026.06.30", times: ["19:30"] }, { label: "7월 1일", date: "2026.07.01", times: ["14:30", "19:30"] }],
    casts: ["팬텀", "크리스틴", "라울"],
    notices: ["일부 장면은 어두운 조명과 큰 음향 효과가 포함됩니다.", "캐스팅은 회차별로 달라질 수 있습니다."],
    summary: "세종문화회관에서 만나는 뮤지컬 오페라의 유령 대표 회차입니다."
  },
  {
    slug: "day6-special-live", category: "콘서트", title: "DAY6 Special Live", shortTitle: "DAY6 Special Live",
    venue: "인스파이어 아레나", startsAt: "2026-08-29T18:00:00+09:00", period: "2026.08.29",
    runtime: "150분", ageLimit: "8세 이상 관람가", poster: "public/images/real-posters/day6.jpg",
    prices: [{ grade: "R", seat: "R석", price: 154000 }, { grade: "S", seat: "S석", price: 132000 }],
    schedules: [{ label: "8월 29일", date: "2026.08.29", times: ["18:00"] }],
    casts: ["DAY6"],
    notices: ["스탠딩 구역은 입장 번호순으로 입장합니다.", "공연장 주변 교통 혼잡이 예상됩니다."],
    summary: "인스파이어 아레나에서 열리는 DAY6 스페셜 라이브 대표 공연입니다."
  },
  {
    slug: "kun-woo-paik-ravel", category: "클래식", title: "백건우와 라벨", shortTitle: "백건우와 라벨",
    venue: "통영국제음악당", startsAt: "2026-09-04T19:30:00+09:00", period: "2026.09.04",
    runtime: "110분", ageLimit: "8세 이상 관람가", poster: "public/images/real-posters/kun-woo-paik.jpg",
    prices: [{ grade: "R", seat: "R석", price: 120000 }, { grade: "S", seat: "S석", price: 90000 }, { grade: "A", seat: "A석", price: 60000 }],
    schedules: [{ label: "9월 4일", date: "2026.09.04", times: ["19:30"] }],
    casts: ["백건우"],
    notices: ["공연 시작 후 지정된 악장 사이에만 입장할 수 있습니다.", "초등학생 이상 관람가입니다."],
    summary: "통영국제음악당에서 열리는 백건우 라벨 프로그램 대표 공연입니다."
  },
  {
    slug: "cherry-orchard", category: "연극", title: "연극 벚꽃동산", shortTitle: "연극 벚꽃동산",
    venue: "대학로예술극장", startsAt: "2026-08-06T19:30:00+09:00", period: "2026.08.06 ~ 2026.08.30",
    runtime: "130분", ageLimit: "14세 이상 관람가", poster: "public/images/real-posters/cherry-orchard.jpg",
    prices: [{ grade: "R", seat: "R석", price: 66000 }, { grade: "S", seat: "S석", price: 44000 }, { grade: "A", seat: "A석", price: 30000 }],
    schedules: [{ label: "8월 6일", date: "2026.08.06", times: ["19:30"] }, { label: "8월 8일", date: "2026.08.08", times: ["15:00"] }],
    casts: ["라네프스카야", "로파힌", "아냐"],
    notices: ["공연 중 사진과 영상 촬영은 제한됩니다.", "대학로예술극장 현장 수령 창구를 운영합니다."],
    summary: "대학로예술극장에서 만나는 체호프 연극 벚꽃동산 대표 공연입니다."
  },
  // --- ticketing.ts ---
  {
    slug: "les-miserables", category: "뮤지컬", title: "레미제라블 40주년 (Les Miserables 40th Anniversary)", shortTitle: "레미제라블",
    venue: "블루스퀘어 신한카드홀", startsAt: "2026-05-13T19:30:00+09:00", period: "2026.05.13 ~ 2026.08.30",
    runtime: "170분(인터미션 20분 포함)", ageLimit: "8세 이상 관람가", poster: "public/images/real-posters/les-miserables-40.png", badge: "클린티켓", artistSlug: "les-miserables-cast",
    prices: [{ grade: "VIP", seat: "VIP석", price: 190000 }, { grade: "R", seat: "R석", price: 160000 }, { grade: "S", seat: "S석", price: 120000 }, { grade: "A", seat: "A석", price: 80000 }],
    schedules: [{ label: "5월 13일", date: "2026.05.13", times: ["19:30"] }, { label: "5월 14일", date: "2026.05.14", times: ["14:30", "19:30"] }, { label: "5월 16일", date: "2026.05.16", times: ["14:00", "19:00"] }],
    casts: ["민우혁", "최재림", "김소현", "조정은", "박강현", "카이"],
    notices: ["회차별 1인 4매까지 예매할 수 있습니다."],
    summary: "블루스퀘어 신한카드홀에서 만나는 레미제라블 40주년 내한공연 대표 회차입니다."
  }
];
