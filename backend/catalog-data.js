import { createAdminEventContentBackend } from "./admin-event-content.js";
import { legacyCategoryToAdminCategory, legacyShows, legacyVenueIdByName } from "./legacy-show-seed-data.js";
import { createRuntime } from "./runtime.js";

const JAMSIL_OLYMPIC_STADIUM_IMAGE = "/assets/jamsil-olympic-main-stadium.svg";

const seedRuntime = createRuntime({});
const { normalizeAdminEventInput, normalizeCreateEventContent } = createAdminEventContentBackend({
  httpError: seedRuntime.httpError,
  money: seedRuntime.money,
  stableId: seedRuntime.stableId
});

function publicPosterPath(relativePath) {
  return relativePath.replace(/^public/, "");
}

function legacyShowBlueprints(venues) {
  const events = [];
  for (const show of legacyShows) {
    const venue = venues.find((item) => item.id === legacyVenueIdByName[show.venue]);
    if (!venue) throw new Error(`legacy-show-seed-data: no venue blueprint for ${show.venue}`);
    const input = normalizeAdminEventInput({
      title: show.title,
      category: legacyCategoryToAdminCategory[show.category],
      venueId: venue.id,
      startsAt: show.startsAt,
      saleState: "ON_SALE",
      saleNote: "레거시 카탈로그 이관"
    });
    const eventId = seedRuntime.stableId("event", input.title, input.startsAt, venue.id);
    const content = normalizeCreateEventContent(
      {
        shortTitle: show.shortTitle,
        period: show.period,
        runtime: show.runtime,
        ageLimit: show.ageLimit,
        badge: show.badge,
        artistSlug: show.artistSlug,
        slug: show.slug,
        summary: show.summary,
        prices: show.prices,
        schedules: show.schedules,
        casts: show.casts,
        notices: show.notices
      },
      { eventId, events, startsAt: input.startsAt }
    );
    events.push({
      id: eventId,
      category: input.category,
      title: input.title,
      venueId: venue.id,
      venue: venue.name,
      date: input.startsAt,
      organizer: input.organizer,
      image: publicPosterPath(show.poster),
      saleState: input.saleState,
      saleNote: input.saleNote,
      discountRate: input.discountRate,
      rating: "0.0",
      ...content
    });
  }
  return events;
}

function zoneBlueprints(overrides = {}) {
  return [
    { id: "zone_vip", name: "VIP", faceValue: overrides.vip ?? 154000, resaleFeeRate: 0.08, maxTransferCount: 1 },
    { id: "zone_r", name: "R석", faceValue: overrides.r ?? 121000, resaleFeeRate: 0.07, maxTransferCount: 1 },
    { id: "zone_s", name: "S석", faceValue: overrides.s ?? 99000, resaleFeeRate: 0.06, maxTransferCount: 1 }
  ];
}

function arenaVenueBlueprint(id, name, address) {
  return {
    id,
    name,
    address,
    map: {
      type: "arena",
      imageUrl: "",
      imageSource: "Ticketground 기본 아레나 도면",
      stage: "MAIN STAGE",
      helper: `${name} 기본 좌석 배치도`,
      labels: [
        { text: "VIP", x: 50, y: 38 },
        { text: "R", x: 30, y: 60 },
        { text: "S", x: 70, y: 72 }
      ]
    }
  };
}

export function venueBlueprints() {
  return [
    {
      id: "venue_jamsil_olympic",
      name: "잠실 올림픽 주 경기장",
      address: "서울특별시 송파구 올림픽로 25",
      map: {
        type: "olympic-stadium",
        imageUrl: JAMSIL_OLYMPIC_STADIUM_IMAGE,
        imageSource: "서울종합운동장 좌석 도면",
        stage: "MAIN STAGE / FIELD",
        helper: "잠실 올림픽 주 경기장 도면 기반 좌석 선택",
        labels: [
          { text: "VIP FLOOR", x: 50, y: 63 },
          { text: "R 1층 좌측", x: 24, y: 48 },
          { text: "R 1층 우측", x: 76, y: 48 },
          { text: "S 상단 관람석", x: 50, y: 24 }
        ]
      }
    },
    {
      id: "venue_kspo_dome",
      name: "KSPO Dome",
      address: "서울특별시 송파구 올림픽로 424",
      map: {
        type: "arena",
        imageUrl: "",
        imageSource: "Ticketground 기본 아레나 도면",
        stage: "CENTER STAGE",
        helper: "콘서트형 아레나 좌석 배치도",
        labels: [
          { text: "VIP FLOOR", x: 50, y: 37 },
          { text: "R SIDE", x: 25, y: 58 },
          { text: "S UPPER", x: 75, y: 70 }
        ]
      }
    },
    {
      id: "venue_bluesquare",
      name: "블루스퀘어",
      address: "서울특별시 용산구 이태원로 294",
      map: {
        type: "theater",
        imageUrl: "",
        imageSource: "Ticketground 기본 극장 도면",
        stage: "PROSCENIUM STAGE",
        helper: "뮤지컬형 극장 좌석 배치도",
        labels: [
          { text: "VIP ORCHESTRA", x: 50, y: 40 },
          { text: "R MEZZANINE", x: 50, y: 58 },
          { text: "S BALCONY", x: 50, y: 75 }
        ]
      }
    },
    {
      id: "venue_nanjipark",
      name: "난지한강공원",
      address: "서울특별시 마포구 한강난지로 162",
      map: {
        type: "festival",
        imageUrl: "",
        imageSource: "Ticketground 기본 페스티벌 도면",
        stage: "MAIN STAGE",
        helper: "페스티벌형 스탠딩/지정석 혼합 배치도",
        labels: [
          { text: "FRONT PASS", x: 50, y: 36 },
          { text: "PICNIC R", x: 32, y: 61 },
          { text: "LAWN S", x: 68, y: 72 }
        ]
      }
    },
    arenaVenueBlueprint("venue_jamsil_sports_complex_main_stadium", "잠실종합운동장 주경기장", "서울특별시 송파구 올림픽로 25"),
    arenaVenueBlueprint("venue_lg_arts_center_seoul_lg_signature_hall", "LG아트센터 서울 LG SIGNATURE 홀", "서울특별시 강서구 마곡중앙로 136"),
    arenaVenueBlueprint("venue_sejong_grand_theater", "세종문화회관 대극장", "서울특별시 종로구 세종대로 175"),
    arenaVenueBlueprint("venue_kintex_hall_9", "KINTEX HALL 9", "경기도 고양시 일산서구 킨텍스로 217-60"),
    arenaVenueBlueprint("venue_myeongdong_theater", "명동예술극장", "서울특별시 중구 명동길 35"),
    arenaVenueBlueprint("venue_seoul_arts_center_concert_hall", "예술의전당 콘서트홀", "서울특별시 서초구 남부순환로 2406"),
    arenaVenueBlueprint("venue_thehyundai_seoul_alt1", "더현대서울 6층 ALT.1", "서울특별시 영등포구 여의대로 108"),
    arenaVenueBlueprint("venue_bluesquare_nemo", "한남동 블루스퀘어 NEMO", "서울특별시 용산구 이태원로 294"),
    arenaVenueBlueprint("venue_gocheok_sky_dome", "고척스카이돔", "서울특별시 구로구 경인로 430"),
    arenaVenueBlueprint("venue_charlotte_theater", "샤롯데씨어터", "서울특별시 송파구 올림픽로 240"),
    arenaVenueBlueprint("venue_kspo_dome_catalog", "KSPO DOME", "서울특별시 송파구 올림픽로 424"),
    arenaVenueBlueprint("venue_lotte_concert_hall", "롯데콘서트홀", "서울특별시 송파구 올림픽로 300"),
    arenaVenueBlueprint("venue_sejong_center", "세종문화회관", "서울특별시 종로구 세종대로 175"),
    arenaVenueBlueprint("venue_inspire_arena", "인스파이어 아레나", "인천광역시 중구 공항문화로 127"),
    arenaVenueBlueprint("venue_tongyeong_concert_hall", "통영국제음악당", "경상남도 통영시 큰발개1길 38"),
    arenaVenueBlueprint("venue_daehakro_arts_theater", "대학로예술극장", "서울특별시 종로구 대학로10길 17"),
    arenaVenueBlueprint("venue_bluesquare_shinhan_card_hall", "블루스퀘어 신한카드홀", "서울특별시 용산구 이태원로 294")
  ];
}

export function eventBlueprints() {
  return [
    ...legacyShowBlueprints(venueBlueprints()),
    {
      id: "event_kpop_001",
      category: "concert",
      title: "TIG Live: Neon Stage",
      venueId: "venue_jamsil_olympic",
      venue: "잠실 올림픽 주 경기장",
      date: "2026-09-19T19:00:00+09:00",
      dates: [
        { id: "perf_kpop_20260919_1900", startsAt: "2026-09-19T19:00:00+09:00", label: "1회차" },
        { id: "perf_kpop_20260920_1800", startsAt: "2026-09-20T18:00:00+09:00", label: "2회차" }
      ],
      organizer: "TIG Entertainment",
      image: "/assets/neon-stage-hero.png",
      badge: "K-POP · 단독 판매",
      saleState: "ON_SALE",
      saleNote: "공식 판매 진행 중",
      discountRate: 0,
      durationMinutes: 120,
      ageLimit: "8세 이상",
      rating: "4.8",
      zones: zoneBlueprints()
    },
    {
      id: "event_musical_001",
      category: "musical",
      title: "Midnight Sonata",
      venueId: "venue_bluesquare",
      venue: "블루스퀘어",
      date: "2026-11-02T19:30:00+09:00",
      dates: [
        { id: "perf_musical_20261102_1930", startsAt: "2026-11-02T19:30:00+09:00", label: "월요일" },
        { id: "perf_musical_20261103_1930", startsAt: "2026-11-03T19:30:00+09:00", label: "화요일" },
        { id: "perf_musical_20261107_1500", startsAt: "2026-11-07T15:00:00+09:00", label: "토요일 낮" }
      ],
      organizer: "Blue Stage Company",
      image: "/assets/neon-stage-hero.png",
      badge: "뮤지컬 · VIP/R/S",
      saleState: "DISCOUNT_SOON",
      saleNote: "프리뷰 할인 예정",
      discountRate: 15,
      durationMinutes: 145,
      ageLimit: "12세 이상",
      rating: "4.7",
      zones: zoneBlueprints({ vip: 132000, r: 110000, s: 88000 })
    },
    {
      id: "event_sports_001",
      category: "sports",
      title: "Seoul Tigers vs Busan Waves",
      venueId: "venue_jamsil_olympic",
      venue: "잠실 올림픽 주 경기장",
      date: "2026-08-14T18:30:00+09:00",
      dates: [
        { id: "perf_sports_20260814_1830", startsAt: "2026-08-14T18:30:00+09:00", label: "금요일 경기" },
        { id: "perf_sports_20260815_1700", startsAt: "2026-08-15T17:00:00+09:00", label: "토요일 경기" }
      ],
      organizer: "Seoul Tigers",
      image: "/assets/neon-stage-hero.png",
      badge: "스포츠 · 공식 판매",
      saleState: "ON_SALE",
      saleNote: "홈 응원석 판매 중",
      discountRate: 0,
      durationMinutes: 180,
      ageLimit: "전체 관람",
      rating: "4.6",
      zones: zoneBlueprints({ vip: 88000, r: 66000, s: 44000 })
    },
    {
      id: "event_festival_001",
      category: "concert",
      title: "Tig Summer Beat Festival",
      venueId: "venue_nanjipark",
      venue: "난지한강공원",
      date: "2026-07-25T14:00:00+09:00",
      dates: [
        { id: "perf_festival_20260725_1400", startsAt: "2026-07-25T14:00:00+09:00", label: "1일권" },
        { id: "perf_festival_20260726_1400", startsAt: "2026-07-26T14:00:00+09:00", label: "2일차" }
      ],
      organizer: "TIG Festival",
      image: "/assets/neon-stage-hero.png",
      badge: "페스티벌 · 1일권/양일권",
      saleState: "OPEN_SOON",
      saleNote: "얼리버드 오픈 예정",
      discountRate: 20,
      durationMinutes: 420,
      ageLimit: "전체 관람",
      rating: "4.5",
      zones: zoneBlueprints({ vip: 119000, r: 89000, s: 69000 })
    }
  ];
}
