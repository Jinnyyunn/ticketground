import type { Dictionary } from "./ko";

export const dictionary = {
  metadata: {
    title: "Ticketground",
    description: "Book tickets for concerts, musicals, and sports with Ticketground",
  },
  common: {
    themeToggleLight: "Turn on light mode",
    themeToggleDark: "Turn on dark mode",
    languageComingSoon: "Translation coming soon",
    searchPlaceholder: "Search shows, artists, venues",
    searchButtonLabel: "Search",
    carouselPrev: "Previous",
    carouselNext: "Next",
  },
  languageSwitcher: {
    label: "Select language",
    names: {
      ko: "한국어",
      en: "English",
      ja: "日本語",
      "zh-CN": "简体中文",
    },
  },
  header: {
    ariaQuickMenu: "Quick menu",
    ariaCategoryNav: "Categories",
    ariaTicketOpenNav: "Ticket open",
    utilityHelp: "Help center",
    utilityMy: "MY",
    login: "Log in",
    signup: "Sign up",
    logout: "Log out",
    watchlist: "Watchlist",
    reservations: "My bookings",
    categories: {
      home: "Home",
      concert: "Concert",
      musical: "Musical",
      theater: "Theater",
      classical: "Classical",
      exhibition: "Exhibition",
      kids: "Kids",
      sports: "Sports",
    },
    highlightCategories: {
      resale: "Official Resale",
      calendar: "Ticket Open Calendar",
    },
    calendarMobileLabel: "Calendar",
    resaleDesktopLabel: "CLEAN Official Resale",
  },
  mobileNav: {
    openMenu: "Open full menu",
    closeMenu: "Close full menu",
    title: "Full menu",
    ariaUtility: "Mobile utility",
    ariaCategory: "Mobile categories",
    themeMode: "Display mode",
  },
  home: {
    hero: {
      ariaSlides: "Featured show slides",
      ariaPrev: "Previous featured show",
      ariaNext: "Next featured show",
      ctaBook: "Book now",
      ctaNotify: "Get notified",
    },
    sectionMore: "More",
    realtimeTop10: {
      title: "Real-time Booking Ranking TOP10",
      subtitle: "The shows moving fastest right now.",
    },
    ticketOpen: {
      title: "Upcoming Ticket Opens",
      subtitle: "Check open times and rounds, and set reminders.",
      alertButton: "Set alert",
    },
    officialResale: {
      title: "CLEAN Official Resale",
      subtitle: "Resell your ticket safely, with no risk of a private-trade scam.",
      badge: "CLEAN TICKET",
      poolLabel: "CLEAN TICKET POOL",
      cardTitle: "CLEAN Official Resale",
      cardDescription: "Only tickets that pass price-range and purchase-history verification enter the pool. Booking and payment records stay attached, with no outside private trading.",
      viewPoolCta: "View official pool",
      safetyStepsTitle: "3-step safeguard",
      steps: {
        verifyTicket: { title: "Verify your ticket", description: "Register straight from your bookings" },
        autoPolicyCheck: { title: "Automatic policy check", description: "Auto-verified at 90-110% of face value" },
        qrProtection: { title: "QR protection", description: "A dynamic QR is issued right before entry" },
      },
    },
    editorialEvents: {
      title: "Editorial Picks",
      subtitle: "Shows our editors are curating right now.",
      eyebrow: "EDITORIAL",
      cta: "View picks",
      items: {
        cleanTicketPicks: {
          title: "CLEAN Ticket Picks",
          description: "Only shows with CLEAN official resale tickets and dynamic QR entry.",
        },
        summerConcerts: {
          title: "Big Summer Concerts",
          description: "Check the key seat-opening schedule for Gocheok, Jamsil, and KSPO in one place.",
        },
        firstMusical: {
          title: "First Musical Guide",
          description: "An easy starter curation for comparing running time, seat grades, and discounts.",
        },
      },
    },
    genreRecommendations: {
      title: "Recommended by Genre",
      subtitle: "Compare concerts, musicals, theater, and classical.",
      ariaTabs: "Genre recommendation tabs",
      emptySuffix: "shows are coming soon.",
    },
    shortcuts: {
      title: "Shortcuts",
      items: {
        regional: { label: "Regional shows", helper: "Busan · Daegu · Gwangju" },
        daehakro: { label: "Daehak-ro", helper: "New small-theater shows" },
        resale: { label: "Resale", helper: "Official pool trading" },
        vip: { label: "VIP seats", helper: "Browse by grade" },
        calendar: { label: "Open calendar", helper: "D-3 reminders" },
        sameDay: { label: "Today's shows", helper: "Enter today" },
      },
    },
    groupBooking: {
      title: "Group & Institutional Booking",
      description: "Group bookings for schools, academies, companies, and local governments are handled by request form",
      cta: "Apply now",
    },
  },
  footer: {
    description: "Official booking, Tig tickets, and customer support - all in one performance ticketing service.",
    links: {
      company: "About us",
      terms: "Terms of service",
      privacy: "Privacy policy",
      sellerGuide: "Sell tickets with us",
    },
    columns: {
      booking: {
        title: "Booking",
        calendar: "Ticket open calendar",
        ranking: "Ranking",
        venues: "Venues",
      },
      my: {
        title: "MY",
        reservations: "My bookings",
        resale: "CLEAN official resale",
        watchlist: "Watchlist",
        cancel: "Cancel / refund",
      },
      support: {
        title: "Help center",
        home: "Help center home",
        inquiry: "1:1 inquiry",
        notice: "Notices",
      },
      business: {
        title: "Business",
        groupBooking: "Group & institutional booking",
      },
    },
    copyright: "© Ticketground Inc. Acting as an intermediary telecommunications retailer connecting show bookings and official inquiries.",
  },
  errors: {
    notFoundTitle: "Page not found",
  },
} satisfies Dictionary;
