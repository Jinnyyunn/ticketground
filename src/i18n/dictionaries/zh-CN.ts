import type { Dictionary } from "./ko";

export const dictionary = {
  metadata: {
    title: "Ticketground",
    description: "演唱会、音乐剧、体育票务预订就选Ticketground",
  },
  common: {
    themeToggleLight: "切换到浅色模式",
    themeToggleDark: "切换到深色模式",
    languageComingSoon: "翻译准备中",
    searchPlaceholder: "搜索演出、艺人、场馆",
    searchButtonLabel: "搜索",
    carouselPrev: "上一个",
    carouselNext: "下一个",
  },
  languageSwitcher: {
    label: "选择语言",
    names: {
      ko: "한국어",
      en: "English",
      ja: "日本語",
      "zh-CN": "简体中文",
    },
  },
  header: {
    ariaQuickMenu: "快捷菜单",
    ariaCategoryNav: "分类",
    ariaTicketOpenNav: "开票",
    utilityHelp: "客服中心",
    utilityMy: "我的",
    login: "登录",
    signup: "注册",
    logout: "退出登录",
    watchlist: "关注演出",
    reservations: "预订记录",
    categories: {
      home: "首页",
      concert: "演唱会",
      musical: "音乐剧",
      theater: "话剧",
      classical: "古典乐",
      exhibition: "展览",
      kids: "亲子",
      sports: "体育",
    },
    highlightCategories: {
      resale: "官方转让",
      calendar: "开票日历",
    },
    calendarMobileLabel: "日历",
    resaleDesktopLabel: "CLEAN票官方转让",
  },
  mobileNav: {
    openMenu: "打开完整菜单",
    closeMenu: "关闭完整菜单",
    title: "完整菜单",
    ariaUtility: "移动端功能栏",
    ariaCategory: "移动端分类",
    themeMode: "显示模式",
  },
  home: {
    hero: {
      ariaSlides: "推荐演出轮播",
      ariaPrev: "上一个推荐演出",
      ariaNext: "下一个推荐演出",
      ctaBook: "立即预订",
      ctaNotify: "接收提醒",
    },
    sectionMore: "查看更多",
    realtimeTop10: {
      title: "实时预订排行榜TOP10",
      subtitle: "当前热度上升最快的演出。",
    },
    ticketOpen: {
      title: "即将开票",
      subtitle: "查看开票时间和场次，提前设置提醒。",
      alertButton: "设置提醒",
    },
    officialResale: {
      title: "CLEAN票官方转让",
      subtitle: "无需担心私下交易诈骗，安全转让您的门票。",
      badge: "CLEAN TICKET",
      poolLabel: "CLEAN TICKET POOL",
      cardTitle: "CLEAN票官方转让",
      cardDescription: "只有通过原价范围与购票记录验证的门票才能进入转让池。无需私下交易，预订与支付记录将完整保留。",
      viewPoolCta: "查看官方转让池",
      safetyStepsTitle: "三重安全保障",
      steps: {
        verifyTicket: { title: "确认持有门票", description: "直接从预订记录中登记" },
        autoPolicyCheck: { title: "自动政策核验", description: "自动核验原价90%~110%区间" },
        qrProtection: { title: "二维码保护", description: "入场前发放动态二维码" },
      },
    },
    editorialEvents: {
      title: "专题策划",
      subtitle: "编辑精选，现在最值得看的演出。",
      eyebrow: "EDITORIAL",
      cta: "查看专题",
      items: {
        cleanTicketPicks: {
          title: "CLEAN票精选馆",
          description: "只收录支持CLEAN官方转让与动态二维码入场的演出。",
        },
        summerConcerts: {
          title: "夏季大型演唱会",
          description: "一屏查看高尺岩、蚕室、KSPO等主要场馆的开票日程。",
        },
        firstMusical: {
          title: "音乐剧入门指南",
          description: "轻松比较时长、座位等级与折扣政策的入门策划。",
        },
      },
    },
    genreRecommendations: {
      title: "分类推荐",
      subtitle: "比较演唱会、音乐剧、话剧和古典乐演出。",
      ariaTabs: "分类推荐标签页",
      emptySuffix: "演出即将上线。",
    },
    shortcuts: {
      title: "快捷入口",
      items: {
        regional: { label: "地方演出", helper: "釜山·大邱·光州" },
        daehakro: { label: "大学路", helper: "小剧场新作" },
        resale: { label: "转让", helper: "官方转让池交易" },
        vip: { label: "VIP座位", helper: "按等级查看" },
        calendar: { label: "开票日历", helper: "提前3天提醒" },
        sameDay: { label: "今日演出", helper: "今日可入场" },
      },
    },
    groupBooking: {
      title: "团体/机构预订",
      description: "学校、培训机构、企业、政府机关等团体预订可通过申请表受理",
      cta: "立即申请",
    },
  },
  footer: {
    description: "官方预订、Tig票、客户咨询一站式演出票务服务。",
    links: {
      company: "公司介绍",
      terms: "服务条款",
      privacy: "隐私政策",
      sellerGuide: "票务销售指南",
    },
    columns: {
      booking: {
        title: "预订",
        calendar: "开票日历",
        ranking: "排行榜",
        venues: "演出场馆",
      },
      my: {
        title: "我的",
        reservations: "预订记录",
        resale: "CLEAN票转让",
        watchlist: "关注演出",
        cancel: "取消/退款",
      },
      support: {
        title: "客服中心",
        home: "客服中心首页",
        inquiry: "1:1咨询",
        notice: "公告",
      },
      business: {
        title: "企业/机构",
        groupBooking: "团体/机构预订",
      },
    },
    copyright: "© Ticketground Inc. 作为通信销售中介，提供演出预订与官方咨询对接服务。",
  },
  errors: {
    notFoundTitle: "页面未找到",
  },
} satisfies Dictionary;
