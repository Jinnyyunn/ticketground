// Canonical dictionary schema. Every other locale file must satisfy this
// exact key structure (enforced via `satisfies Dictionary` + a contract
// test) so a missing translation fails CI instead of silently falling
// back to a raw key name in production.
export const dictionary = {
  metadata: {
    title: "Ticketground",
    description: "공연, 콘서트, 뮤지컬, 스포츠 티켓 예매는 Ticketground",
  },
  common: {
    themeToggleLight: "라이트 모드 켜기",
    themeToggleDark: "다크 모드 켜기",
    languageComingSoon: "번역 준비 중",
    searchPlaceholder: "공연명, 아티스트, 공연장 검색",
    searchButtonLabel: "검색",
    carouselPrev: "이전",
    carouselNext: "다음",
  },
  languageSwitcher: {
    label: "언어 선택",
    names: {
      ko: "한국어",
      en: "English",
      ja: "日本語",
      "zh-CN": "简体中文",
    },
  },
  header: {
    ariaQuickMenu: "빠른 메뉴",
    ariaCategoryNav: "카테고리",
    ariaTicketOpenNav: "티켓오픈",
    utilityHelp: "고객센터",
    utilityMy: "MY",
    login: "로그인",
    signup: "회원가입",
    logout: "로그아웃",
    watchlist: "관심공연",
    reservations: "예매내역",
    categories: {
      home: "홈",
      concert: "콘서트",
      musical: "뮤지컬",
      theater: "연극",
      classical: "클래식",
      exhibition: "전시",
      kids: "아동",
      sports: "스포츠",
    },
    highlightCategories: {
      resale: "티켓 양도",
      calendar: "티켓오픈 캘린더",
    },
    calendarMobileLabel: "캘린더",
    resaleDesktopLabel: "CLEAN 티켓 공식 양도",
  },
  mobileNav: {
    openMenu: "전체 메뉴 열기",
    closeMenu: "전체 메뉴 닫기",
    title: "전체 메뉴",
    ariaUtility: "모바일 유틸리티",
    ariaCategory: "모바일 카테고리",
    themeMode: "화면 모드",
  },
  home: {
    hero: {
      ariaSlides: "추천 공연 슬라이드",
      ariaPrev: "이전 추천 공연",
      ariaNext: "다음 추천 공연",
      ctaBook: "예매하기",
      ctaNotify: "알림받기",
    },
    sectionMore: "더보기",
    realtimeTop10: {
      title: "실시간 예매 랭킹 TOP10",
      subtitle: "지금 가장 빠르게 움직이는 공연입니다.",
    },
    ticketOpen: {
      title: "티켓오픈 예정",
      subtitle: "오픈 시간과 회차를 확인하고 알림을 준비하세요.",
      alertButton: "알림 설정",
    },
    officialResale: {
      title: "CLEAN 티켓 공식 양도",
      subtitle: "직거래 사기 걱정 없이, 내 티켓을 안전하게 양도하세요.",
      badge: "CLEAN TICKET",
      poolLabel: "CLEAN TICKET POOL",
      cardTitle: "CLEAN 티켓 공식 양도",
      cardDescription: "정가 범위와 구매 이력 검증을 통과한 티켓만 풀에 등록됩니다. 외부 직거래 없이 예매 내역과 결제 기록이 함께 보존됩니다.",
      viewPoolCta: "공식 풀 보기",
      safetyStepsTitle: "3단계 안전 장치",
      steps: {
        verifyTicket: { title: "보유 티켓 확인", description: "예매 내역에서 바로 등록" },
        autoPolicyCheck: { title: "정책 자동 판별", description: "정가 90~110% 자동 검증" },
        qrProtection: { title: "QR 보호", description: "입장 직전 동적 QR 전달" },
      },
    },
    editorialEvents: {
      title: "기획전",
      subtitle: "지금 봐야 할 공연을 에디터가 엄선해 소개합니다.",
      eyebrow: "EDITORIAL",
      cta: "기획전 보기",
      items: {
        cleanTicketPicks: {
          title: "클린티켓 추천관",
          description: "Tig 공식 양도 티켓과 동적 QR 입장이 적용된 공연만 모았습니다.",
        },
        summerConcerts: {
          title: "여름 대형 콘서트",
          description: "고척, 잠실, KSPO 주요 좌석 오픈 일정을 한 화면에서 확인하세요.",
        },
        firstMusical: {
          title: "첫 관람 뮤지컬",
          description: "러닝타임, 좌석 등급, 할인 정책을 비교하기 쉬운 입문 큐레이션입니다.",
        },
      },
    },
    genreRecommendations: {
      title: "장르별 추천",
      subtitle: "콘서트·뮤지컬·연극·클래식을 비교하세요.",
      ariaTabs: "장르별 추천 탭",
      emptySuffix: "공연을 준비 중입니다.",
    },
    shortcuts: {
      title: "바로가기",
      items: {
        regional: { label: "지방 공연", helper: "부산·대구·광주" },
        daehakro: { label: "대학로", helper: "소극장 신작" },
        resale: { label: "양도", helper: "공식 풀 거래" },
        vip: { label: "VIP석", helper: "등급별 보기" },
        calendar: { label: "오픈캘린더", helper: "D-3 알림" },
        sameDay: { label: "당일 공연", helper: "오늘 입장 가능" },
      },
    },
    groupBooking: {
      title: "단체/기관 예매",
      description: "학교·학원·기업·지자체 등 단체 예매는 신청서로 접수해드립니다",
      cta: "신청하기",
    },
  },
  footer: {
    description: "공식 예매, 클린티켓, 고객 문의를 한 곳에서 다루는 공연 티켓 서비스입니다.",
    links: {
      company: "회사소개",
      terms: "이용약관",
      privacy: "개인정보처리방침",
      sellerGuide: "티켓판매안내",
    },
    columns: {
      booking: {
        title: "예매",
        calendar: "티켓오픈 캘린더",
        ranking: "랭킹",
        venues: "공연장",
      },
      my: {
        title: "MY",
        reservations: "예매내역",
        resale: "CLEAN 티켓 양도",
        watchlist: "관심공연",
        cancel: "취소/환불",
      },
      support: {
        title: "고객센터",
        home: "고객센터 홈",
        inquiry: "1:1 문의",
        notice: "공지사항",
      },
      business: {
        title: "기업/기관",
        groupBooking: "단체/기관 예매",
      },
    },
    copyright: "© Ticketground Inc. 통신판매중개자로서 공연 예매와 공식 문의 연결을 제공합니다.",
  },
  errors: {
    notFoundTitle: "페이지를 찾을 수 없습니다",
  },
} as const;

// Every other locale dictionary must have this exact key shape, but with
// translated (necessarily different) string values - so leaves are
// widened to `string` rather than kept as Korean string literals.
type DeepStringify<T> = T extends string ? string : { [K in keyof T]: DeepStringify<T[K]> };

export type Dictionary = DeepStringify<typeof dictionary>;
