const appState = {
  data: null,
  activeZone: "all",
  activeCategory: "concert",
  query: "",
  searchActive: false,
  qr: null,
  route: "concerts",
  bookingCategory: "concert",
  nicknameOverride: "",
  heroIndex: 0,
  heroTimer: null,
  selectedPerformanceDate: "",
  bookingStarted: false,
  selectedSeatId: "",
  paymentMethod: "BALANCE"
};

const paymentMethods = [
  { id: "BALANCE", label: "충전금", actionLabel: "충전금으로", note: "보유 충전금 즉시 차감" },
  { id: "CREDIT_CARD", label: "신용카드", actionLabel: "신용카드로", note: "카드 승인 후 예매" },
  { id: "BANK_TRANSFER", label: "계좌이체", actionLabel: "계좌이체로", note: "실시간 이체 승인" },
  { id: "BANK_DEPOSIT", label: "무통장 입금", actionLabel: "무통장 입금으로", note: "입금대기 예매" },
  { id: "MOBILE", label: "휴대폰 결제", actionLabel: "휴대폰 결제로", note: "통신사 결제 승인" }
];

const heroSlides = [
  {
    tone: "concert",
    category: "concert",
    eyebrow: "Tig 단독 오픈",
    title: "TIG Live: Neon Stage",
    copy: "공식 예매와 공식 재판매만 허용되는 팬 중심 클린 티켓 플랫폼",
    primary: "지금 예매하기",
    secondary: "내 예매내역 보기",
    secondaryRoute: "my",
    image: "/assets/neon-stage-hero.png",
    alt: "콘서트 무대와 관객"
  },
  {
    tone: "festival",
    category: "festival",
    eyebrow: "페스티벌 얼리버드",
    title: "Tig Summer Beat Festival",
    copy: "여름 야외 무대, 1일권과 양일권을 공식 판매 티켓으로 먼저 만나보세요.",
    primary: "페스티벌 예매",
    secondary: "판매 티켓 둘러보기",
    secondaryRoute: "concerts",
    image: "/assets/neon-stage-hero.png",
    alt: "페스티벌 조명이 비치는 야외 공연장"
  },
  {
    tone: "musical",
    category: "musical",
    eyebrow: "뮤지컬 프리뷰",
    title: "Midnight Sonata",
    copy: "캐스팅, 가격, 좌석 정보를 한 화면에서 확인하고 원하는 좌석을 직접 선택하세요.",
    primary: "뮤지컬 예매",
    secondary: "상세 정보 보기",
    secondaryRoute: "booking",
    image: "/assets/neon-stage-hero.png",
    alt: "뮤지컬 무대 조명"
  },
  {
    tone: "sports",
    category: "sports",
    eyebrow: "스포츠 공식 판매",
    title: "Seoul Tigers Match Day",
    copy: "인기 경기 티켓도 암표 걱정 없이 공식 구매와 제한된 공식 양도로 관리합니다.",
    primary: "스포츠 예매",
    secondary: "공식 재판매 보기",
    secondaryRoute: "resale",
    image: "/assets/neon-stage-hero.png",
    alt: "스포츠 경기장 조명"
  }
];

const categoryEvents = {
  concert: [
    {
      title: "TIG Live: Neon Stage",
      meta: "2026.09.19 토요일 오후 7시 · KSPO Dome",
      badge: "K-POP · 단독 판매",
      image: "/assets/neon-stage-hero.png",
      route: "booking",
      cta: "좌석 선택"
    },
    {
      title: "Indie Ground Festival",
      meta: "2026.10.03 토요일 오후 5시 · 올림픽공원 88잔디마당",
      badge: "콘서트 · 오픈 예정",
      image: "/assets/neon-stage-hero.png",
      route: "booking",
      cta: "티켓 보기"
    }
  ],
  festival: [
    {
      title: "Tig Summer Beat Festival",
      meta: "2026.07.25 토요일 오후 2시 · 난지한강공원",
      badge: "페스티벌 · 1일권/양일권",
      image: "/assets/neon-stage-hero.png",
      route: "booking",
      cta: "판매 티켓 보기"
    },
    {
      title: "City Lights Music Camp",
      meta: "2026.09.05 토요일 오후 1시 · 인천 파라다이스 시티",
      badge: "페스티벌 · 공식 판매",
      image: "/assets/neon-stage-hero.png",
      route: "booking",
      cta: "판매 티켓 보기"
    }
  ],
  sports: [
    {
      title: "Seoul Tigers vs Busan Waves",
      meta: "2026.08.14 금요일 오후 6시 30분 · 잠실야구장",
      badge: "프로야구 · 공식 재판매",
      image: "/assets/neon-stage-hero.png",
      route: "booking",
      cta: "판매 티켓 보기"
    },
    {
      title: "K-League Night Match",
      meta: "2026.08.22 토요일 오후 7시 · 서울월드컵경기장",
      badge: "축구 · 안심 예매",
      image: "/assets/neon-stage-hero.png",
      route: "booking",
      cta: "판매 티켓 보기"
    }
  ],
  musical: [
    {
      title: "Midnight Sonata",
      meta: "2026.11.02 월요일 오후 7시 30분 · 블루스퀘어",
      badge: "뮤지컬 · VIP/R/S",
      image: "/assets/neon-stage-hero.png",
      route: "booking",
      cta: "좌석 선택"
    },
    {
      title: "The Golden Door",
      meta: "2026.12.12 토요일 오후 3시 · 샤롯데씨어터",
      badge: "뮤지컬 · 공식 재판매",
      image: "/assets/neon-stage-hero.png",
      route: "booking",
      cta: "판매 티켓 보기"
    }
  ]
};

const discoverySections = [
  {
    title: "오픈 예정",
    more: "전체보기",
    items: [
      { title: "TIG Live: Neon Stage", meta: "오늘 20:00 티켓 오픈", tags: ["HOT", "단독판매"] },
      { title: "Tig Summer Beat Festival", meta: "06.20(토) 14:00 오픈", tags: ["페스티벌", "얼리버드"] },
      { title: "Midnight Sonata", meta: "06.24(수) 15:00 오픈", tags: ["뮤지컬", "좌석우위"] },
      { title: "Seoul Tigers vs Busan Waves", meta: "06.28(일) 11:00 오픈", tags: ["스포츠", "공식판매"] }
    ]
  },
  {
    title: "장르별 랭킹",
    more: "전체보기",
    items: [
      { title: "TIG Live: Neon Stage", meta: "콘서트 랭킹 1위", tags: ["콘서트"] },
      { title: "The Golden Door", meta: "뮤지컬 랭킹 2위", tags: ["뮤지컬"] },
      { title: "K-League Night Match", meta: "스포츠 랭킹 3위", tags: ["스포츠"] },
      { title: "City Lights Music Camp", meta: "페스티벌 랭킹 4위", tags: ["페스티벌"] }
    ]
  },
  {
    title: "할인 중인 티켓",
    more: "특가보기",
    items: [
      { title: "Indie Ground Festival", meta: "얼리버드 20% · 79,000원", tags: ["타임딜"] },
      { title: "Midnight Sonata", meta: "프리뷰 15% · 93,500원", tags: ["할인"] },
      { title: "The Golden Door", meta: "마감 임박 10% · 88,200원", tags: ["파이널콜"] },
      { title: "City Lights Music Camp", meta: "양일권 25% · 119,000원", tags: ["페스티벌"] }
    ]
  },
  {
    title: "공연 보러 가기 좋은 요즘",
    more: "추천 더보기",
    items: [
      { title: "감각적인 주말 페스티벌", meta: "야외에서 즐기는 음악 큐레이션", tags: ["추천"] },
      { title: "관계와 몰입의 무대", meta: "스토리 중심 뮤지컬 모음", tags: ["큐레이션"] },
      { title: "응원 열기 가득한 경기", meta: "주말 스포츠 티켓 모음", tags: ["스포츠"] },
      { title: "첫 공연 입문 추천", meta: "가볍게 시작하기 좋은 공연", tags: ["입문"] }
    ]
  }
];

const $ = (selector) => document.querySelector(selector);
const fmt = new Intl.NumberFormat("ko-KR");

function renderHero() {
  const hero = $(".hero");
  const slide = heroSlides[appState.heroIndex];
  if (!hero || !slide) return;

  hero.dataset.heroTone = slide.tone;
  hero.classList.add("is-switching");
  window.setTimeout(() => hero.classList.remove("is-switching"), 260);

  const image = hero.querySelector("img");
  image.src = slide.image;
  image.alt = slide.alt;
  hero.querySelector(".eyebrow").textContent = slide.eyebrow;
  hero.querySelector("h1").textContent = slide.title;
  hero.querySelector("p").textContent = slide.copy;
  hero.querySelector(".primary-link").textContent = slide.primary;
  const secondary = hero.querySelector(".ghost-link");
  secondary.textContent = slide.secondary;
  secondary.href = `#${slide.secondaryRoute}`;
  secondary.dataset.route = slide.secondaryRoute;

  const dots = $("#heroDots");
  if (!dots) return;
  dots.innerHTML = heroSlides.map((item, index) => `
    <button
      class="hero-dot ${index === appState.heroIndex ? "active" : ""}"
      type="button"
      data-hero-index="${index}"
      aria-label="${item.title} 보기"
      aria-current="${index === appState.heroIndex ? "true" : "false"}"
    ></button>
  `).join("");
}

function setHeroSlide(index, restart = true) {
  appState.heroIndex = (index + heroSlides.length) % heroSlides.length;
  renderHero();
  if (restart) startHeroTimer();
}

function startHeroTimer() {
  window.clearInterval(appState.heroTimer);
  appState.heroTimer = window.setInterval(() => {
    setHeroSlide(appState.heroIndex + 1, false);
  }, 5500);
}

function toast(message) {
  const node = $("#toast");
  node.textContent = message;
  node.classList.add("show");
  window.setTimeout(() => node.classList.remove("show"), 3000);
}

async function api(path, body) {
  const response = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await response.json();
  if (!json.ok) throw new Error(json.error?.message || "요청에 실패했습니다.");
  return json.data;
}

function currentUser() {
  return appState.data.users.find((user) => user.id === $("#userSelect").value) || appState.data.users[0];
}

function displayName() {
  return appState.nicknameOverride || currentUser().name;
}

function currentEvent() {
  return appState.data.events[0];
}

function eventDateKey() {
  return currentEvent().date.slice(0, 10);
}

function selectedBookingDate() {
  return appState.selectedPerformanceDate || eventDateKey();
}

function bookingMonthDates() {
  const eventDate = new Date(`${eventDateKey()}T00:00:00+09:00`);
  const year = eventDate.getFullYear();
  const month = eventDate.getMonth();
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function renderBookingCalendar() {
  const eventKey = eventDateKey();
  const selectedKey = selectedBookingDate();
  const eventDate = new Date(`${eventKey}T00:00:00+09:00`);
  const weekday = ["일", "월", "화", "수", "목", "금", "토"];
  const dates = bookingMonthDates();
  return `
    <section class="booking-date-panel">
      <div class="booking-date-head">
        <div>
          <strong>01 관람일 선택</strong>
          <span>${eventDate.getFullYear()}년 ${eventDate.getMonth() + 1}월</span>
        </div>
        <em>${currentEvent().venue}</em>
      </div>
      <div class="booking-weekdays" aria-hidden="true">
        ${weekday.map((day) => `<span>${day}</span>`).join("")}
      </div>
      <div class="booking-calendar" aria-label="예매 날짜 선택">
        ${dates.map((date) => {
          const key = dateKey(date);
          const isEventDate = key === eventKey;
          const isCurrentMonth = date.getMonth() === eventDate.getMonth();
          const classes = [
            "date-cell",
            isCurrentMonth ? "" : "outside",
            isEventDate ? "available" : "disabled",
            key === selectedKey ? "selected" : ""
          ].filter(Boolean).join(" ");
          return `
            <button
              class="${classes}"
              type="button"
              data-booking-date="${isEventDate ? key : ""}"
              ${isEventDate ? "" : "disabled"}
              aria-pressed="${key === selectedKey ? "true" : "false"}"
            >${date.getDate()}</button>
          `;
        }).join("")}
      </div>
      <div class="booking-date-footer">
        <div>
          <span>선택 관람일</span>
          <strong>${selectedKey} ${new Date(`${selectedKey}T00:00:00+09:00`).toLocaleDateString("ko-KR", { weekday: "short" })}</strong>
        </div>
        <button type="button" data-start-booking="true">${appState.bookingStarted ? "예매일 다시 선택" : "예매하기"}</button>
      </div>
    </section>
  `;
}

function zoneById(zoneId) {
  return currentEvent().zones.find((zone) => zone.id === zoneId);
}

function ownerName(ownerId) {
  return appState.data.users.find((user) => user.id === ownerId)?.name || "예매 가능";
}

function statusLabel(ticket) {
  if (ticket.status === "ON_SALE") return "예매 가능";
  if (ticket.status === "IN_RESALE_POOL") return "재판매 중";
  return "예매 완료";
}

function optionList(select, rows, label) {
  if (!rows.length) {
    select.innerHTML = `<option value="">선택 가능한 항목 없음</option>`;
    return;
  }
  select.innerHTML = rows.map((row) => `<option value="${row.id}">${label(row)}</option>`).join("");
}

function renderUsers() {
  const select = $("#userSelect");
  const previous = select.value;
  optionList(select, appState.data.users.filter((user) => user.status !== "BANNED"), (user) =>
    `${user.name} · ${fmt.format(user.balance)}원`
  );
  if (previous && [...select.options].some((option) => option.value === previous)) {
    select.value = previous;
  }
}

function renderAccount() {
  const user = currentUser();
  const name = displayName();
  $("#profileNickname").textContent = name;
  $("#dropdownName").textContent = `${name}님`;
  $("#dropdownBalance").textContent = `충전금 ${fmt.format(user.balance)}원`;
  $("#summaryUser").textContent = `${name}님 로그인`;
  $("#summaryBalance").textContent = `충전금 ${fmt.format(user.balance)}원`;
  $("#loginName").textContent = name;
  $("#loginStatus").textContent = user.status;
  $("#loginTrust").textContent = `${user.trustScore}점`;
  $("#nicknameInput").value = name;
  $("#ledgerStatus").textContent = appState.data.ledger.verified
    ? `거래 원장 정상 · ${appState.data.ledger.totalEntries}건`
    : "거래 원장 확인 필요";
}

function setRoute(route, updateHash = true) {
  const nextRoute = route;
  const validRoutes = ["concerts", "booking", "resale", "my", "guide"];
  appState.route = validRoutes.includes(nextRoute) ? nextRoute : "concerts";
  document.querySelectorAll("[data-page]").forEach((page) => {
    page.classList.toggle("active", page.dataset.page === appState.route);
  });
  document.querySelectorAll("[data-route]").forEach((link) => {
    link.classList.toggle("active", link.dataset.route === appState.route);
  });
  if (updateHash && window.location.hash !== `#${appState.route}`) {
    history.pushState(null, "", `#${appState.route}`);
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderStats() {
  const tickets = appState.data.tickets;
  const available = tickets.filter((ticket) => ticket.status === "ON_SALE").length;
  const resale = appState.data.resalePools.filter((pool) => pool.status === "OPEN").length;
  return [
    `예매 가능 ${available}석`,
    `공식 재판매 ${resale}건`,
    "정가 상한제",
    "동적 QR 입장"
  ].map((text) => `<span class="stat-pill">${text}</span>`).join("");
}

function renderProductDetails() {
  const event = currentEvent();
  const eventDate = new Date(event.date);
  $("#productVenue").textContent = event.venue;
  $("#productDate").textContent = eventDate.toLocaleDateString("ko-KR");
  $("#productPlaceCopy").textContent = `${event.venue} · 관리자 콘솔에서 연결된 공연장 좌석도 기준`;
  for (const zone of event.zones) {
    const target = zone.id === "zone_vip"
      ? $("#productVipPrice")
      : zone.id === "zone_r"
        ? $("#productRPrice")
        : zone.id === "zone_s"
          ? $("#productSPrice")
          : null;
    if (target) target.textContent = `${fmt.format(zone.faceValue)}원`;
  }
}

function renderEventCatalog() {
  const events = categoryEvents[appState.activeCategory] || categoryEvents.concert;
  $("#eventCatalog").innerHTML = events.map((item, index) => `
    <div class="event-card" data-route="${item.route}" tabindex="0" role="link" aria-label="${item.title} 예매하기">
      <img src="${item.image}" alt="${item.title} 포스터" />
      <div class="event-info">
        <span class="badge">${item.badge}</span>
        <h3>${item.title}</h3>
        <p>${item.meta}</p>
        <div class="event-stats">
          ${index === 0 && appState.activeCategory === "concert"
            ? renderStats()
            : ["공식 판매", "가격 상한", "동적 QR"].map((text) => `<span class="stat-pill">${text}</span>`).join("")
          }
        </div>
      </div>
      <a class="event-cta" href="#booking" data-route="booking">${item.cta}</a>
    </div>
  `).join("");
}

function renderDiscoverySections() {
  const image = "/assets/neon-stage-hero.png";
  $("#ticketDiscovery").innerHTML = discoverySections.map((section) => `
    <section class="discovery-section">
      <div class="discovery-head">
        <h3>${section.title}</h3>
        <a href="#booking" data-route="booking">${section.more}</a>
      </div>
      <div class="discovery-grid">
        ${section.items.map((item) => `
          <article class="discovery-card" data-route="booking" tabindex="0" role="link" aria-label="${item.title} 예매하기">
            <img src="${image}" alt="${item.title}" />
            <div class="card-tags">${item.tags.map((tag) => `<em>${tag}</em>`).join("")}</div>
            <strong>${item.title}</strong>
            <span>${item.meta}</span>
          </article>
        `).join("")}
      </div>
    </section>
  `).join("");
}

function renderZoneTabs() {
  const zoneTabs = $("#zoneTabs");
  if (!zoneTabs) return;
  const tabs = [{ id: "all", name: "전체" }, ...currentEvent().zones.map((zone) => ({ id: zone.id, name: zone.name }))];
  zoneTabs.innerHTML = tabs.map((zone) => `
    <button class="zone-tab ${appState.activeZone === zone.id ? "active" : ""}" data-zone="${zone.id}">
      ${zone.name}
    </button>
  `).join("");
}

function filteredTickets() {
  const query = appState.query.trim().toLowerCase();
  return appState.data.tickets.filter((ticket) => {
    const zone = zoneById(ticket.zoneId);
    const inZone = appState.activeZone === "all" || ticket.zoneId === appState.activeZone;
    const inQuery = !query || `${ticket.seatLabel} ${zone?.name || ""} ${currentEvent().title} ${currentEvent().venue}`
      .toLowerCase()
      .includes(query);
    return inZone && inQuery;
  });
}

function currentSelectedTicket(tickets = appState.data.tickets) {
  return tickets.find((ticket) => ticket.id === appState.selectedSeatId && ticket.status === "ON_SALE");
}

function ensureSelectedSeat(tickets) {
  if (!currentSelectedTicket(tickets)) {
    appState.selectedSeatId = "";
  }
}

function renderPaymentMethods() {
  return paymentMethods.map((method) => `
    <button
      class="payment-option ${appState.paymentMethod === method.id ? "active" : ""}"
      type="button"
      data-payment-method="${method.id}"
      aria-pressed="${appState.paymentMethod === method.id ? "true" : "false"}"
    >
      <strong>${method.label}</strong>
      <span>${method.note}</span>
    </button>
  `).join("");
}

function selectedPaymentLabel() {
  return paymentMethods.find((method) => method.id === appState.paymentMethod)?.label || "충전금";
}

function selectedPaymentActionLabel() {
  return paymentMethods.find((method) => method.id === appState.paymentMethod)?.actionLabel || "충전금으로";
}

function currentVenueMap() {
  const category = appState.route === "booking" ? appState.bookingCategory : appState.activeCategory;
  const type = category === "sports"
    ? "stadium"
    : category === "musical"
      ? "theater"
      : category === "festival"
        ? "festival"
        : "arena";
  const maps = {
    arena: {
      type,
      venue: "KSPO Dome",
      stage: "CENTER STAGE",
      helper: "콘서트형 아레나 좌석 배치도",
      labels: [
        { text: "VIP FLOOR", x: 50, y: 34 },
        { text: "R SIDE", x: 24, y: 55 },
        { text: "S UPPER", x: 76, y: 70 }
      ]
    },
    festival: {
      type,
      venue: "난지한강공원",
      stage: "MAIN STAGE",
      helper: "페스티벌형 스탠딩/지정석 혼합 배치도",
      labels: [
        { text: "FRONT PASS", x: 50, y: 34 },
        { text: "PICNIC R", x: 23, y: 58 },
        { text: "LAWN S", x: 76, y: 66 }
      ]
    },
    theater: {
      type,
      venue: "블루스퀘어",
      stage: "PROSCENIUM STAGE",
      helper: "뮤지컬형 극장 좌석 배치도",
      labels: [
        { text: "VIP ORCHESTRA", x: 50, y: 38 },
        { text: "R MEZZANINE", x: 50, y: 58 },
        { text: "S BALCONY", x: 50, y: 75 }
      ]
    },
    stadium: {
      type,
      venue: "잠실야구장",
      stage: "GROUND",
      helper: "스포츠 경기장형 관람석 배치도",
      labels: [
        { text: "HOME VIP", x: 50, y: 70 },
        { text: "R 1루/3루", x: 22, y: 48 },
        { text: "S 외야", x: 78, y: 28 }
      ]
    }
  };
  return maps[type];
}

function seatCoordinates(ticket, zoneTickets, index, mapType) {
  const zoneIndex = currentEvent().zones.findIndex((zone) => zone.id === ticket.zoneId);
  const count = Math.max(zoneTickets.length - 1, 1);
  const spread = count ? (index / count) - 0.5 : 0;
  const byType = {
    arena: [
      { x: 50 + spread * 28, y: 42 + Math.abs(spread) * 6 },
      { x: 28 + spread * 14, y: 60 + Math.abs(spread) * 7 },
      { x: 72 + spread * 14, y: 72 + Math.abs(spread) * 5 }
    ],
    festival: [
      { x: 50 + spread * 24, y: 40 },
      { x: 34 + spread * 24, y: 61 + Math.abs(spread) * 5 },
      { x: 66 + spread * 30, y: 72 + Math.abs(spread) * 4 }
    ],
    theater: [
      { x: 50 + spread * 34, y: 44 },
      { x: 50 + spread * 42, y: 61 },
      { x: 50 + spread * 52, y: 78 }
    ],
    stadium: [
      { x: 50 + spread * 20, y: 72 - Math.abs(spread) * 5 },
      { x: 28 + spread * 42, y: 52 - Math.abs(spread) * 15 },
      { x: 72 + spread * 36, y: 30 + Math.abs(spread) * 12 }
    ]
  };
  return byType[mapType][zoneIndex] || byType.arena[zoneIndex] || { x: 50, y: 50 };
}

function renderSeatMap(tickets) {
  const zones = currentEvent().zones;
  const selectedTicket = currentSelectedTicket(tickets);
  const venueMap = currentVenueMap();
  const zoneCards = zones.map((zone) => {
    const zoneTickets = tickets.filter((ticket) => ticket.zoneId === zone.id);
    const isActive = selectedTicket?.zoneId === zone.id || (!selectedTicket && appState.activeZone === zone.id);
    return `
      <button class="seat-grade ${isActive ? "active" : ""}" type="button" data-seat-zone="${zone.id}">
        <i class="seat-grade-swatch zone-${zone.id}" aria-hidden="true"></i>
        <span>${zone.name}</span>
        <em>${zoneTickets.length}석</em>
        <strong>${fmt.format(zone.faceValue)}원</strong>
      </button>
    `;
  }).join("");

  const mapSeats = zones.flatMap((zone) => {
    const zoneTickets = appState.data.tickets.filter((ticket) => ticket.zoneId === zone.id);
    return zoneTickets.map((ticket, index) => {
      const available = ticket.status === "ON_SALE";
      const selected = ticket.id === appState.selectedSeatId;
      const point = seatCoordinates(ticket, zoneTickets, index, venueMap.type);
      return `
        <button
          class="map-seat venue-seat zone-${ticket.zoneId} ${selected ? "selected" : ""}"
          type="button"
          data-seat-id="${ticket.id}"
          style="--seat-x:${point.x}%; --seat-y:${point.y}%"
          ${available ? "" : "disabled"}
          aria-pressed="${selected ? "true" : "false"}"
          aria-label="${ticket.seatLabel} ${available ? "즉시 예매 가능" : "예매 완료"}"
          title="${ticket.seatLabel} · ${fmt.format(ticket.faceValue)}원"
        >${ticket.seatLabel.replace(/[^0-9]/g, "")}</button>
      `;
    });
  }).join("");

  const mapLabels = venueMap.labels.map((label) => `
    <span class="venue-section-label" style="--label-x:${label.x}%; --label-y:${label.y}%">${label.text}</span>
  `).join("");

  const summary = selectedTicket
    ? `
      <span class="selected-count">총 1석 선택되었습니다.</span>
      <div class="selected-seat-table">
        <div><span>좌석등급</span><strong>${zoneById(selectedTicket.zoneId)?.name || ""}</strong></div>
        <div><span>좌석번호</span><strong>${selectedTicket.seatLabel}</strong></div>
      </div>
      <strong class="selected-price">${fmt.format(selectedTicket.faceValue)}원</strong>
    `
    : `
      <span class="selected-count">총 0석 선택되었습니다.</span>
      <div class="selected-seat-table">
        <div><span>좌석등급</span><strong>-</strong></div>
        <div><span>좌석번호</span><strong>좌석을 선택해주세요</strong></div>
      </div>
      <strong class="selected-price">좌석을 선택하면 가격이 표시됩니다.</strong>
    `;

  return `
    <div class="interpark-seat-flow">
      <div class="seat-step-banner">
        <strong>02 좌석 선택</strong>
        <span>${currentEvent().title} · ${new Date(currentEvent().date).toLocaleDateString("ko-KR")} · ${currentEvent().venue}</span>
      </div>
      <div class="seat-map-panel">
        <div class="seat-map-head">
          <div>
            <strong>${venueMap.venue}</strong>
            <span>${venueMap.helper}</span>
          </div>
          <em>좌석 클릭 후 우측에서 선택을 완료하세요.</em>
        </div>
        <div class="venue-map-canvas ${venueMap.type}" aria-label="${venueMap.helper}">
          <div class="stage-label">${venueMap.stage}</div>
          <div class="venue-field" aria-hidden="true"></div>
          ${mapLabels}
          ${mapSeats}
        </div>
      </div>
      <div class="selected-seat-panel">
        <div class="seat-side-title">
          <strong>좌석도 전체보기</strong>
          <span>원하시는 좌석위치를 선택하세요</span>
        </div>
        <div class="seat-grade-head">
          <strong>좌석등급 / 잔여석</strong>
          <button type="button" class="mini-price-button" data-price-summary="true">가격 전체보기</button>
        </div>
        <div class="seat-grade-list" aria-label="좌석 등급 선택">${zoneCards}</div>
        <div class="selected-seat-head">
          <strong>선택좌석</strong>
          ${summary}
        </div>
        <div class="payment-methods" aria-label="결제수단 선택">
          ${renderPaymentMethods()}
        </div>
        <button data-buy-selected="true" ${selectedTicket ? "" : "disabled"}>좌석선택완료</button>
        <div class="seat-flow-actions">
          <button type="button" class="secondary" data-previous-booking-step="true">이전단계</button>
          <button type="button" class="secondary" data-reset-seat="true">좌석 다시 선택</button>
        </div>
        <button type="button" class="seat-caution-button" data-seat-caution="true">좌석 선택시 유의사항</button>
      </div>
    </div>
  `;
}

function renderTickets() {
  const tickets = filteredTickets().filter((ticket) => ticket.status === "ON_SALE");
  ensureSelectedSeat(tickets);
  const seatStep = appState.bookingStarted
    ? renderSeatMap(tickets)
    : `
      <div class="booking-standby">
        <strong>관람일 선택 후 예매하기를 눌러주세요.</strong>
        <span>좌석 선택과 결제는 다음 단계에서 진행됩니다.</span>
      </div>
    `;

  $("#ticketGrid").innerHTML = `
    <article class="purchase-event">
      <img src="/assets/neon-stage-hero.png" alt="${currentEvent().title} 포스터" />
      <div class="event-info">
        <span class="badge">공식 1차 판매</span>
        <h3>${currentEvent().title}</h3>
        <p>${new Date(currentEvent().date).toLocaleString("ko-KR")} · ${currentEvent().venue}</p>
        <div class="event-stats">${renderStats()}</div>
        ${renderBookingCalendar()}
        ${seatStep}
      </div>
    </article>
  `;
}

function renderSearchResults() {
  const container = $("#searchResults");
  if (!appState.searchActive) {
    container.hidden = true;
    return;
  }

  const queryText = appState.query.trim() || "전체";
  const normalizedQuery = queryText.toLowerCase();
  const matchedEvents = Object.values(categoryEvents)
    .flat()
    .filter((item) => `${item.title} ${item.meta} ${item.badge}`.toLowerCase().includes(normalizedQuery));
  const events = matchedEvents.length ? matchedEvents : categoryEvents[appState.activeCategory];
  container.hidden = false;
  $("#searchResultCopy").textContent = `"${queryText}" 검색 조건에 맞는 판매 공연입니다. 좌석은 예매 단계에서 선택합니다.`;
  $("#saleTicketResults").innerHTML = events.map((item, index) => `
    <div class="event-card" data-route="booking" tabindex="0" role="link" aria-label="${item.title} 예매하기">
      <img src="${item.image}" alt="${item.title} 포스터" />
      <div class="event-info">
        <span class="badge">${item.badge}</span>
        <h3>${item.title}</h3>
        <p>${item.meta}</p>
        <div class="event-stats">
          ${index === 0 && item.title === currentEvent().title
            ? renderStats()
            : ["공식 티켓 판매", "구매 단계 좌석 선택", "공식 양도 허용"].map((text) => `<span class="stat-pill">${text}</span>`).join("")
          }
        </div>
      </div>
      <a class="event-cta" href="#booking" data-route="booking">예매하기</a>
    </div>
  `).join("");

  const openPools = appState.data.resalePools.filter((pool) => pool.status === "OPEN");
  $("#resalePreviewList").innerHTML = openPools.length ? openPools.map((pool) => {
    const zone = zoneById(pool.zoneId);
    return `
      <article class="resale-card">
        <div class="resale-top">
          <div>
            <strong>${zone.name} 공식 재판매</strong>
            <p>${fmt.format(pool.price)}원 · 대기자 ${pool.buyers.length}명</p>
          </div>
          <span class="seat-status">OPEN</span>
        </div>
        <div class="resale-actions">
          <button data-join="${pool.id}">대기 신청</button>
          <button class="secondary" data-draw="${pool.id}">매칭 진행</button>
        </div>
      </article>
    `;
  }).join("") : `
    <article class="resale-card">
      <div class="resale-top">
        <div>
          <strong>현재 열린 공식 재판매 풀이 없습니다.</strong>
          <p>My 예매내역에서 보유 티켓을 공식 재판매로 등록하면 이곳에 표시됩니다.</p>
        </div>
      </div>
      <a class="plain-link" href="#my" data-route="my">내 티켓 판매하기</a>
    </article>
  `;
}

function renderPools() {
  const openPools = appState.data.resalePools.filter((pool) => pool.status === "OPEN");
  $("#poolList").innerHTML = openPools.length ? openPools.map((pool) => {
    const zone = zoneById(pool.zoneId);
    return `
      <article class="resale-card">
        <div class="resale-top">
          <div>
            <strong>${zone.name} 공식 재판매</strong>
            <p>${fmt.format(pool.price)}원 · 대기자 ${pool.buyers.length}명</p>
          </div>
          <span class="seat-status">OPEN</span>
        </div>
        <p>판매자를 지정할 수 없으며, 대기자 풀에서 랜덤으로 매칭됩니다.</p>
        <div class="resale-actions">
          <button data-join="${pool.id}">대기 신청</button>
          <button class="secondary" data-draw="${pool.id}">매칭 진행</button>
        </div>
      </article>
    `;
  }).join("") : `<p>현재 열린 공식 재판매 티켓이 없습니다. My 예매내역에서 보유 티켓을 등록할 수 있습니다.</p>`;
}

function renderSellForm() {
  const user = currentUser();
  const sellable = appState.data.tickets.filter((ticket) =>
    ticket.ownerId === user.id && ticket.status === "OWNED" && ticket.transferCount < ticket.maxTransferCount
  );
  optionList($("#sellTicketSelect"), sellable, (ticket) =>
    `${ticket.seatLabel} · 최대 ${fmt.format(ticket.maxPrice)}원`
  );
  const first = sellable[0];
  $("#sellPriceInput").value = first ? first.maxPrice : "";
  $("#sellBtn").disabled = !sellable.length;
}

function renderMyTickets() {
  const user = currentUser();
  const owned = appState.data.tickets.filter((ticket) => ticket.ownerId === user.id);
  $("#myTicketList").innerHTML = owned.length ? owned.map((ticket) => {
    const canResell = ticket.status === "OWNED" && ticket.transferCount < ticket.maxTransferCount;
    return `
      <article class="myticket-card">
        <div class="myticket-top">
          <div>
            <strong>${ticket.seatLabel}</strong>
            <p>${currentEvent().title}</p>
          </div>
          <span class="seat-status ${ticket.status === "OWNED" ? "" : "closed"}">${statusLabel(ticket)}</span>
        </div>
        <p>${new Date(currentEvent().date).toLocaleString("ko-KR")} · ${currentEvent().venue}</p>
        <button ${ticket.status === "OWNED" ? "" : "disabled"} data-qr="${ticket.id}">입장 QR 발급</button>
        <button class="secondary" ${canResell ? "" : "disabled"} data-fill-sell="${ticket.id}">재판매 등록 준비</button>
      </article>
    `;
  }).join("") : `<p>아직 보유한 티켓이 없습니다. 좌석 선택에서 먼저 예매해보세요.</p>`;
}

async function refresh() {
  appState.data = await api("/api/state");
  renderUsers();
  renderAccount();
  renderHero();
  startHeroTimer();
  renderProductDetails();
  renderEventCatalog();
  renderDiscoverySections();
  renderZoneTabs();
  renderTickets();
  renderPools();
  renderSearchResults();
  renderSellForm();
  renderMyTickets();
  setRoute(window.location.hash.replace("#", "") || appState.route, false);
}

async function buyTicket(ticketId) {
  const result = await api("/api/tickets/buy", {
    userId: currentUser().id,
    ticketId,
    paymentMethod: appState.paymentMethod
  });
  const paymentLabel = result.payment?.label || selectedPaymentLabel();
  const actionLabel = paymentMethods.find((method) => method.label === paymentLabel)?.actionLabel || selectedPaymentActionLabel();
  const statusCopy = result.payment?.status === "WAITING_DEPOSIT" ? "입금대기 상태로 예매되었습니다." : "결제가 승인되었습니다.";
  toast(`${actionLabel} ${statusCopy} My 예매내역에서 확인하세요.`);
  await refresh();
}

async function listForResale() {
  const ticketId = $("#sellTicketSelect").value;
  const price = Number($("#sellPriceInput").value);
  if (!ticketId || !price) {
    toast("판매할 티켓과 가격을 입력해주세요.");
    return;
  }
  await api("/api/resale/list", { sellerId: currentUser().id, ticketId, price });
  toast("공식 재판매 풀에 등록했습니다.");
  await refresh();
}

async function joinPool(poolId) {
  await api("/api/resale/join", { buyerId: currentUser().id, poolId });
  toast("공식 재판매 대기 신청이 완료되었습니다.");
  await refresh();
}

async function drawPool(poolId) {
  await api("/api/resale/draw", { poolId });
  toast("랜덤 매칭이 진행되었습니다.");
  await refresh();
}

async function issueQr(ticketId) {
  const ticket = appState.data.tickets.find((item) => item.id === ticketId);
  appState.qr = await api("/api/tickets/qr", { userId: ticket.ownerId, ticketId });
  $("#qrBox").innerHTML = `
    <div class="qr-token">
      <strong>입장 QR 토큰</strong>
      <span>ticket=${appState.qr.ticketId}</span>
      <span>expires=${appState.qr.expiresAt}</span>
      <span>signature=${appState.qr.signature}</span>
    </div>
  `;
  toast("20초 동안 유효한 입장 QR을 발급했습니다.");
  await refresh();
}

async function verifyQr() {
  if (!appState.qr) {
    toast("먼저 입장 QR을 발급해주세요.");
    return;
  }
  const result = await api("/api/gate/verify", appState.qr);
  toast(result.valid ? "사용 가능한 QR입니다." : "만료되었거나 유효하지 않은 QR입니다.");
  await refresh();
}

function toggleProfile(open) {
  const dropdown = $("#profileDropdown");
  const next = open ?? !dropdown.classList.contains("open");
  dropdown.classList.toggle("open", next);
  $("#profileButton").setAttribute("aria-expanded", String(next));
}

document.addEventListener("click", async (event) => {
  const target = event.target;
  const profileButton = target.closest("#profileButton");
  const profileMenu = target.closest(".profile-menu");
  const routeLink = target.closest("[data-route]");
  const seatZoneButton = target.closest("[data-seat-zone]");
  const seatButton = target.closest("[data-seat-id]");
  const paymentButton = target.closest("[data-payment-method]");
  const bookingDateButton = target.closest("[data-booking-date]");

  if (profileButton) {
    toggleProfile();
    return;
  }
  if (routeLink) {
    event.preventDefault();
    if (routeLink.dataset.route === "booking") {
      const heroRoot = routeLink.closest(".hero");
      appState.bookingCategory = heroRoot ? heroSlides[appState.heroIndex].category : appState.activeCategory;
    }
    setRoute(routeLink.dataset.route);
    if (routeLink.dataset.route === "booking") renderTickets();
  }
  if (!profileMenu) toggleProfile(false);
  if (target.dataset.closeMenu) toggleProfile(false);
  if (target.dataset.openProfileEdit) {
    $("#nicknameInput").focus();
  }
  if (paymentButton) {
    appState.paymentMethod = paymentButton.dataset.paymentMethod;
    renderTickets();
    return;
  }
  if (bookingDateButton?.dataset.bookingDate) {
    appState.selectedPerformanceDate = bookingDateButton.dataset.bookingDate;
    appState.bookingStarted = false;
    appState.selectedSeatId = "";
    renderTickets();
    return;
  }
  if (target.dataset.startBooking) {
    appState.selectedPerformanceDate = selectedBookingDate();
    appState.bookingStarted = !appState.bookingStarted;
    appState.selectedSeatId = "";
    renderTickets();
    return;
  }
  if (target.dataset.heroDir) {
    setHeroSlide(appState.heroIndex + Number(target.dataset.heroDir));
    return;
  }
    if (target.dataset.heroIndex) {
      setHeroSlide(Number(target.dataset.heroIndex));
      return;
    }
    if (seatZoneButton) {
      appState.activeZone = seatZoneButton.dataset.seatZone;
      appState.selectedSeatId = "";
      renderZoneTabs();
      renderTickets();
      return;
    }
    if (seatButton) {
      appState.selectedSeatId = seatButton.dataset.seatId;
      const selectedTicket = appState.data.tickets.find((ticket) => ticket.id === appState.selectedSeatId);
      if (selectedTicket) appState.activeZone = selectedTicket.zoneId;
      renderZoneTabs();
      renderTickets();
      return;
    }

  try {
    if (target.dataset.zone) {
      appState.activeZone = target.dataset.zone;
      appState.selectedSeatId = "";
      renderZoneTabs();
      renderTickets();
      renderSearchResults();
    }
    if (target.dataset.filter) {
      document.querySelectorAll(".chip").forEach((chip) => chip.classList.remove("active"));
      target.classList.add("active");
      const label = target.dataset.filter;
      appState.activeZone = label === "all" ? "all" : currentEvent().zones.find((zone) => zone.name === label)?.id || "all";
      renderZoneTabs();
      renderTickets();
      appState.searchActive = true;
      renderSearchResults();
      setRoute("concerts");
      $("#searchResults").scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (target.dataset.resetSeat) {
      appState.selectedSeatId = "";
      renderTickets();
      return;
    }
    if (target.dataset.previousBookingStep) {
      appState.bookingStarted = false;
      appState.selectedSeatId = "";
      renderTickets();
      return;
    }
    if (target.dataset.priceSummary) {
      toast("좌석 등급별 잔여석과 가격을 확인해주세요.");
      return;
    }
    if (target.dataset.seatCaution) {
      toast("좌석은 선택 후 좌석선택완료 버튼을 눌러야 예매가 진행됩니다.");
      return;
    }
    const categoryButton = target.closest("[data-category]");
    if (categoryButton) {
      appState.activeCategory = categoryButton.dataset.category;
      document.querySelectorAll(".category-tab").forEach((tab) => {
        tab.classList.toggle("active", tab.dataset.category === appState.activeCategory);
      });
      renderEventCatalog();
    }
    if (target.dataset.buy) await buyTicket(target.dataset.buy);
    if (target.dataset.buySelected) {
      const seatId = appState.selectedSeatId;
      if (!appState.bookingStarted) {
        toast("예매하기 버튼을 먼저 눌러 좌석 선택 단계로 이동해주세요.");
      } else if (!seatId) {
        toast("예매할 좌석을 선택해주세요.");
      } else {
        await buyTicket(seatId);
      }
    }
    if (target.dataset.join) await joinPool(target.dataset.join);
    if (target.dataset.draw) await drawPool(target.dataset.draw);
    if (target.dataset.qr) await issueQr(target.dataset.qr);
    if (target.dataset.fillSell) {
      $("#sellTicketSelect").value = target.dataset.fillSell;
      $("#sellTicketSelect").dispatchEvent(new Event("change"));
      document.querySelector("#my").scrollIntoView({ behavior: "smooth" });
    }
  } catch (error) {
    toast(error.message);
  }
});

$("#userSelect").addEventListener("change", () => {
  appState.nicknameOverride = "";
  renderAccount();
  renderSellForm();
  renderMyTickets();
});

$("#sellTicketSelect").addEventListener("change", () => {
  const ticket = appState.data.tickets.find((item) => item.id === $("#sellTicketSelect").value);
  $("#sellPriceInput").value = ticket ? ticket.maxPrice : "";
});

$("#sellBtn").addEventListener("click", () => listForResale().catch((error) => toast(error.message)));
$("#verifyQrBtn").addEventListener("click", () => verifyQr().catch((error) => toast(error.message)));
$("#searchBtn").addEventListener("click", () => {
  appState.query = $("#searchInput").value;
  appState.searchActive = true;
  renderTickets();
  renderSearchResults();
  setRoute("concerts");
  $("#searchResults").scrollIntoView({ behavior: "smooth", block: "start" });
});
$("#searchInput").addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    appState.query = event.target.value;
    appState.searchActive = true;
    renderTickets();
    renderSearchResults();
    setRoute("concerts");
    $("#searchResults").scrollIntoView({ behavior: "smooth", block: "start" });
  }
});

document.addEventListener("keydown", (event) => {
  if (event.target.closest?.(".hero") && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
    event.preventDefault();
    setHeroSlide(appState.heroIndex + (event.key === "ArrowRight" ? 1 : -1));
    return;
  }
  if (event.key !== "Enter") return;
  const routeTarget = event.target.closest?.("[data-route]");
  if (!routeTarget) return;
  event.preventDefault();
  if (routeTarget.dataset.route === "booking") {
    appState.bookingCategory = appState.activeCategory;
  }
  setRoute(routeTarget.dataset.route);
  if (routeTarget.dataset.route === "booking") renderTickets();
});

$("#profileEditForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const value = $("#nicknameInput").value.trim();
  if (!value) {
    toast("닉네임을 입력해주세요.");
    return;
  }
  appState.nicknameOverride = value;
  renderAccount();
  toast("회원정보가 수정되었습니다.");
});

$("#logoutBtn").addEventListener("click", () => {
  toggleProfile(false);
  toast("데모 화면에서는 로그아웃 대신 로그인 상태를 유지합니다.");
});

window.addEventListener("hashchange", () => {
  setRoute(window.location.hash.replace("#", "") || "concerts", false);
});

refresh().catch((error) => toast(error.message));
