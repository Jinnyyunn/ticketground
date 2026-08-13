import type { Dictionary } from "./ko";

export const dictionary = {
  metadata: {
    title: "Ticketground",
    description: "コンサート、ミュージカル、スポーツのチケット予約はTicketgroundで",
  },
  common: {
    themeToggleLight: "ライトモードにする",
    themeToggleDark: "ダークモードにする",
    languageComingSoon: "翻訳準備中",
    searchPlaceholder: "公演名、アーティスト、会場を検索",
    searchButtonLabel: "検索",
    carouselPrev: "前へ",
    carouselNext: "次へ",
  },
  languageSwitcher: {
    label: "言語を選択",
    names: {
      ko: "한국어",
      en: "English",
      ja: "日本語",
      "zh-CN": "简体中文",
    },
  },
  header: {
    ariaQuickMenu: "クイックメニュー",
    ariaCategoryNav: "カテゴリー",
    ariaTicketOpenNav: "チケットオープン",
    utilityHelp: "ヘルプセンター",
    utilityMy: "MY",
    login: "ログイン",
    signup: "会員登録",
    logout: "ログアウト",
    watchlist: "気になる公演",
    reservations: "予約履歴",
    categories: {
      home: "ホーム",
      concert: "コンサート",
      musical: "ミュージカル",
      theater: "演劇",
      classical: "クラシック",
      exhibition: "展示",
      kids: "キッズ",
      sports: "スポーツ",
    },
    highlightCategories: {
      resale: "公式チケット譲渡",
      calendar: "チケットオープンカレンダー",
    },
    calendarMobileLabel: "カレンダー",
    resaleDesktopLabel: "CLEANチケット公式譲渡",
  },
  mobileNav: {
    openMenu: "全体メニューを開く",
    closeMenu: "全体メニューを閉じる",
    title: "全体メニュー",
    ariaUtility: "モバイルユーティリティ",
    ariaCategory: "モバイルカテゴリー",
    themeMode: "画面モード",
  },
  home: {
    hero: {
      ariaSlides: "おすすめ公演スライド",
      ariaPrev: "前のおすすめ公演",
      ariaNext: "次のおすすめ公演",
      ctaBook: "予約する",
      ctaNotify: "通知を受け取る",
    },
    sectionMore: "もっと見る",
    realtimeTop10: {
      title: "リアルタイム予約ランキングTOP10",
      subtitle: "今いちばん動いている公演です。",
    },
    ticketOpen: {
      title: "チケットオープン予定",
      subtitle: "オープン時間と回次を確認して通知を設定しましょう。",
      alertButton: "通知設定",
    },
    officialResale: {
      title: "CLEANチケット公式譲渡",
      subtitle: "個人間取引の詐欺を心配せず、チケットを安全に譲渡できます。",
      badge: "CLEAN TICKET",
      poolLabel: "CLEAN TICKET POOL",
      cardTitle: "CLEANチケット公式譲渡",
      cardDescription: "定価範囲と購入履歴の検証を通過したチケットのみプールに登録されます。外部の個人間取引なしに、予約履歴と決済記録がそのまま保存されます。",
      viewPoolCta: "公式プールを見る",
      safetyStepsTitle: "3段階の安全対策",
      steps: {
        verifyTicket: { title: "保有チケット確認", description: "予約履歴からそのまま登録" },
        autoPolicyCheck: { title: "ポリシー自動判定", description: "定価90〜110%を自動検証" },
        qrProtection: { title: "QR保護", description: "入場直前に動的QRを発行" },
      },
    },
    editorialEvents: {
      title: "特集",
      subtitle: "編集部が厳選した今見るべき公演を紹介します。",
      eyebrow: "EDITORIAL",
      cta: "特集を見る",
      items: {
        cleanTicketPicks: {
          title: "クリーンチケット特集",
          description: "CLEAN公式譲渡チケットと動的QR入場に対応した公演のみを集めました。",
        },
        summerConcerts: {
          title: "夏の大型コンサート",
          description: "コチョク、チャムシル、KSPOの主要座席オープン日程を一画面で確認できます。",
        },
        firstMusical: {
          title: "はじめてのミュージカル",
          description: "上演時間、座席等級、割引ポリシーを比較しやすい入門キュレーションです。",
        },
      },
    },
    genreRecommendations: {
      title: "ジャンル別おすすめ",
      subtitle: "コンサート・ミュージカル・演劇・クラシックを比較できます。",
      ariaTabs: "ジャンル別おすすめタブ",
      emptySuffix: "の公演を準備中です。",
    },
    shortcuts: {
      title: "ショートカット",
      items: {
        regional: { label: "地方公演", helper: "釜山・大邱・光州" },
        daehakro: { label: "大学路", helper: "小劇場の新作" },
        resale: { label: "譲渡", helper: "公式プール取引" },
        vip: { label: "VIP席", helper: "等級別に見る" },
        calendar: { label: "オープンカレンダー", helper: "D-3通知" },
        sameDay: { label: "当日公演", helper: "本日入場可能" },
      },
    },
    groupBooking: {
      title: "団体・機関予約",
      description: "学校・学院・企業・自治体などの団体予約は申請フォームで受け付けます",
      cta: "申請する",
    },
  },
  footer: {
    description: "公式予約、Tigチケット、カスタマーサポートを一か所で提供する公演チケットサービスです。",
    links: {
      company: "会社紹介",
      terms: "利用規約",
      privacy: "プライバシーポリシー",
      sellerGuide: "チケット販売案内",
    },
    columns: {
      booking: {
        title: "予約",
        calendar: "チケットオープンカレンダー",
        ranking: "ランキング",
        venues: "公演会場",
      },
      my: {
        title: "MY",
        reservations: "予約履歴",
        resale: "CLEANチケット譲渡",
        watchlist: "気になる公演",
        cancel: "キャンセル・払い戻し",
      },
      support: {
        title: "ヘルプセンター",
        home: "ヘルプセンターホーム",
        inquiry: "1:1お問い合わせ",
        notice: "お知らせ",
      },
      business: {
        title: "法人・団体",
        groupBooking: "団体・機関予約",
      },
    },
    copyright: "© Ticketground Inc. 通信販売仲介者として公演予約と公式お問い合わせの橋渡しを提供します。",
  },
  errors: {
    notFoundTitle: "ページが見つかりません",
  },
} satisfies Dictionary;
