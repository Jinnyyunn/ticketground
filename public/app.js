const appState = {
  data: null,
  activeZone: "all",
  activeCategory: "concert",
  query: "",
  searchActive: false,
  qr: null,
  route: "concerts",
  selectedEventId: "",
  selectedDateId: "",
  bookingStep: "date",
  nicknameOverride: "",
  heroIndex: 0,
  heroTimer: null,
  selectedSeatId: "",
  paymentMethod: "CREDIT_CARD",
  seatMap: null,
  seatMapEventId: "",
  activeProductTab: "all",
  supportOpen: false,
  activeSupportThreadId: "",
  supportPollTimer: null,
  qrRefreshTimer: null,
  myTickets: [],
  loggedInUserId: "",
  sessionUser: null
};

const WEB_ADMISSION_QR_GUIDANCE = "실제 입장 QR은 입장 당일 모바일 앱에서만 확인할 수 있습니다.";
const DEMO_USER_STORAGE_KEY = "ticketground.demoUserId";
const DEMO_LOGGED_OUT_KEY = "ticketground.demoLoggedOut";

const paymentMethods = [
  { id: "CREDIT_CARD", label: "신용카드", actionLabel: "신용카드로", note: "카드 승인 후 예매" },
  { id: "BANK_TRANSFER", label: "계좌이체", actionLabel: "계좌이체로", note: "실시간 이체 승인" },
  { id: "BANK_DEPOSIT", label: "무통장 입금", actionLabel: "무통장 입금으로", note: "입금대기 예매" },
  { id: "MOBILE", label: "휴대폰 결제", actionLabel: "휴대폰 결제로", note: "통신사 결제 승인" }
];

const categoryLabels = {
  concert: "콘서트",
  festival: "페스티벌",
  musical: "뮤지컬",
  sports: "스포츠"
};

const heroSlides = [
  {
    tone: "concert",
    category: "concert",
    eventId: "event_kpop_001",
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
    eventId: "event_festival_001",
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
    eventId: "event_musical_001",
    eyebrow: "뮤지컬 프리뷰",
    title: "Midnight Sonata",
    copy: "공연 날짜를 먼저 고르고 원하는 좌석을 직접 선택하세요.",
    primary: "뮤지컬 예매",
    secondary: "상세 정보 보기",
    secondaryRoute: "booking",
    image: "/assets/neon-stage-hero.png",
    alt: "뮤지컬 무대 조명"
  },
  {
    tone: "sports",
    category: "sports",
    eventId: "event_sports_001",
    eyebrow: "스포츠 공식 판매",
    title: "Seoul Tigers Match Day",
    copy: "인기 경기 티켓도 개최 날짜와 좌석 단위로 공식 구매합니다.",
    primary: "스포츠 예매",
    secondary: "공식 재판매 보기",
    secondaryRoute: "resale",
    image: "/assets/neon-stage-hero.png",
    alt: "스포츠 경기장 조명"
  }
];

const discoverySections = [
  {
    title: "오픈 예정",
    more: "전체보기",
    items: [
      { title: "TIG Live: Neon Stage", meta: "오늘 20:00 티켓 오픈", tags: ["HOT", "단독판매"], eventId: "event_kpop_001" },
      { title: "Tig Summer Beat Festival", meta: "06.20(토) 14:00 오픈", tags: ["페스티벌", "얼리버드"], eventId: "event_festival_001" },
      { title: "Midnight Sonata", meta: "06.24(수) 15:00 오픈", tags: ["뮤지컬", "좌석우위"], eventId: "event_musical_001" },
      { title: "Seoul Tigers vs Busan Waves", meta: "06.28(일) 11:00 오픈", tags: ["스포츠", "공식판매"], eventId: "event_sports_001" }
    ]
  },
  {
    title: "장르별 랭킹",
    more: "전체보기",
    items: [
      { title: "TIG Live: Neon Stage", meta: "콘서트 랭킹 1위", tags: ["콘서트"], eventId: "event_kpop_001" },
      { title: "Midnight Sonata", meta: "뮤지컬 랭킹 2위", tags: ["뮤지컬"], eventId: "event_musical_001" },
      { title: "Seoul Tigers vs Busan Waves", meta: "스포츠 랭킹 3위", tags: ["스포츠"], eventId: "event_sports_001" },
      { title: "Tig Summer Beat Festival", meta: "페스티벌 랭킹 4위", tags: ["페스티벌"], eventId: "event_festival_001" }
    ]
  },
  {
    title: "할인 중인 티켓",
    more: "특가보기",
    items: [
      { title: "Tig Summer Beat Festival", meta: "얼리버드 20% · 69,000원", tags: ["타임딜"], eventId: "event_festival_001" },
      { title: "Midnight Sonata", meta: "프리뷰 15% · 88,000원", tags: ["할인"], eventId: "event_musical_001" },
      { title: "TIG Live: Neon Stage", meta: "팬클럽 선예매 · 154,000원", tags: ["선예매"], eventId: "event_kpop_001" },
      { title: "Seoul Tigers vs Busan Waves", meta: "홈 응원석 · 44,000원", tags: ["스포츠"], eventId: "event_sports_001" }
    ]
  }
];

const $ = (selector) => document.querySelector(selector);
const fmt = new Intl.NumberFormat("ko-KR");

function formatDateTime(value) {
  return new Date(value).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatDateCompact(value) {
  return new Date(value).toLocaleDateString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short"
  });
}

function formatDatePeriod(value) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
  return `${year}.${month}.${day}.(${weekday})`;
}

function eventPeriod(event) {
  const dates = event.dates?.length
    ? [...event.dates].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
    : [{ startsAt: event.date }];
  const firstDate = dates[0];
  const lastDate = dates.at(-1);
  if (!firstDate?.startsAt) return "";
  if (lastDate?.startsAt && firstDate.startsAt !== lastDate.startsAt) {
    return `${formatDatePeriod(firstDate.startsAt)} ~ ${formatDatePeriod(lastDate.startsAt)}`;
  }
  return formatDatePeriod(firstDate.startsAt);
}

function toast(message) {
  const node = $("#toast");
  node.textContent = message;
  node.classList.add("show");
  window.setTimeout(() => node.classList.remove("show"), 3000);
}

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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
  if (isLoggedIn()) return appState.sessionUser;
  const selectedId = $("#loginUserSelect")?.value || $("#userSelect")?.value || appState.data.users[0]?.id;
  return appState.data.users.find((user) => user.id === selectedId) || appState.data.users[0] || { id: "", name: "로그인" };
}

function displayName() {
  if (!isLoggedIn()) return "로그인";
  return appState.nicknameOverride || currentUser().name;
}

function isLoggedIn() {
  return Boolean(appState.loggedInUserId && appState.sessionUser);
}

function requireLogin(message = "로그인이 필요합니다.") {
  if (isLoggedIn()) return true;
  toast(message);
  toggleProfile(true);
  return false;
}

function eventById(eventId) {
  return appState.data.events.find((event) => event.id === eventId) || appState.data.events[0];
}

function currentEvent() {
  return eventById(appState.selectedEventId);
}

function venueById(venueId) {
  return appState.data.venues.find((venue) => venue.id === venueId);
}

function currentVenue() {
  const event = currentEvent();
  return venueById(event.venueId) || { name: event.venue, address: "" };
}

function eventDateById(event, performanceDateId) {
  return event.dates?.find((date) => date.id === performanceDateId) || event.dates?.[0];
}

function currentDate() {
  return eventDateById(currentEvent(), appState.selectedDateId);
}

function zoneById(zoneId, event = currentEvent()) {
  return event.zones.find((zone) => zone.id === zoneId);
}

function ownerName(userRef) {
  return appState.data.users.find((user) => user.id === userRef)?.name || "예매 가능";
}

function statusLabel(ticket) {
  if (ticket.status === "ON_SALE") return "예매 가능";
  if (ticket.status === "IN_RESALE_POOL") return "재판매 중";
  return "예매 완료";
}

function eventMeta(event) {
  const dateCopy = eventPeriod(event);
  return `${dateCopy} · ${event.venue}`;
}

function eventSale(event) {
  return event.sale || {
    state: event.saleState || "ON_SALE",
    label: event.saleState === "OPEN_SOON" ? "오픈 예정" : event.saleState === "DISCOUNT_SOON" ? "할인 예정" : event.saleState === "ADMIN_HOLD" ? "판매 보류" : "예매 가능",
    note: event.saleNote || "공식 판매 진행 중",
    discountRate: Number(event.discountRate || 0),
    displayPrice: Math.min(...event.zones.map((zone) => zone.faceValue)),
    basePrice: Math.min(...event.zones.map((zone) => zone.faceValue)),
    bookable: (event.saleState || "ON_SALE") === "ON_SALE"
  };
}

function saleBadge(event) {
  const sale = eventSale(event);
  const discount = sale.discountRate ? ` · ${sale.discountRate}%` : "";
  return `${sale.label}${discount}`;
}

function salePriceCopy(event) {
  const sale = eventSale(event);
  if (sale.discountRate > 0) {
    return `${fmt.format(sale.displayPrice)}원 예정 · 정상가 ${fmt.format(sale.basePrice)}원`;
  }
  return `${fmt.format(sale.basePrice)}원부터`;
}

function optionList(select, rows, label) {
  if (!rows.length) {
    select.innerHTML = `<option value="">선택 가능한 항목 없음</option>`;
    return;
  }
  select.innerHTML = rows.map((row) => `<option value="${row.id}">${label(row)}</option>`).join("");
}

function ensureBookingSelection() {
  if (!appState.data?.events?.length) return;
  if (!eventById(appState.selectedEventId)) appState.selectedEventId = appState.data.events[0].id;
  const event = currentEvent();
  if (!event.dates?.some((date) => date.id === appState.selectedDateId)) {
    appState.selectedDateId = event.dates?.[0]?.id || "";
  }
  if (!["date", "seat", "payment"].includes(appState.bookingStep)) appState.bookingStep = "date";
  if (!currentSelectedTicket()) appState.selectedSeatId = "";
}

async function loadSeatMap() {
  if (!appState.selectedEventId) return;
  appState.seatMap = await api(`/api/events/${encodeURIComponent(appState.selectedEventId)}/seat-map`);
  appState.seatMapEventId = appState.selectedEventId;
}

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

  const primary = hero.querySelector(".primary-link");
  primary.textContent = slide.primary;
  primary.href = "#booking";
  primary.dataset.route = "booking";
  primary.dataset.eventId = slide.eventId;

  const secondary = hero.querySelector(".ghost-link");
  secondary.textContent = slide.secondary;
  secondary.href = `#${slide.secondaryRoute}`;
  secondary.dataset.route = slide.secondaryRoute;
  if (slide.secondaryRoute === "booking") secondary.dataset.eventId = slide.eventId;
  else delete secondary.dataset.eventId;

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

function renderUsers() {
  const rows = appState.data.users;
  const hiddenSelect = $("#userSelect");
  const loginSelect = $("#loginUserSelect");
  const label = (user) => user.name;
  if (hiddenSelect) optionList(hiddenSelect, rows, label);
  if (loginSelect) optionList(loginSelect, rows, label);
  const selectedId = appState.loggedInUserId || rows[0]?.id || "";
  for (const select of [hiddenSelect, loginSelect].filter(Boolean)) {
    if ([...select.options].some((option) => option.value === selectedId)) {
      select.value = selectedId;
    }
  }
}

function renderAccount() {
  const user = currentUser();
  const name = displayName();
  const status = isLoggedIn() ? user.status : "LOGGED_OUT";
  const trustScore = isLoggedIn() ? `${user.trustScore}점` : "-";
  document.body.classList.toggle("is-logged-out", !isLoggedIn());
  $("#profileNickname").textContent = name;
  $("#dropdownName").textContent = isLoggedIn() ? `${name}님` : "데모 로그인";
  $("#dropdownBalance").textContent = isLoggedIn() ? `계정 상태 ${status}` : "사용자를 선택해 로그인해주세요.";
  $("#headerLoginStatus").textContent = isLoggedIn() ? `${name}님 로그인` : "로그아웃 상태";
  $("#headerBalance").textContent = isLoggedIn() ? `신뢰 점수 ${trustScore}` : "로그인 필요";
  $("#loginName").textContent = name;
  $("#loginStatus").textContent = status;
  $("#loginTrust").textContent = trustScore;
  $("#nicknameInput").value = name;
  $("#nicknameInput").disabled = !isLoggedIn();
  $("#profileEditForm button").disabled = !isLoggedIn();
  $("#logoutBtn").disabled = !isLoggedIn();
  $("#loginBtn").disabled = isLoggedIn();
  $("#loginUserSelect").disabled = isLoggedIn();
  $("#ledgerStatus").textContent = appState.data.ledger.verified
    ? `거래 원장 정상 · ${appState.data.ledger.totalEntries}건`
    : "거래 원장 확인 필요";
}

function syncLoginSelects(userId) {
  for (const select of [$("#userSelect"), $("#loginUserSelect")].filter(Boolean)) {
    if ([...select.options].some((option) => option.value === userId)) {
      select.value = userId;
    }
  }
}

async function loadSessionUser(userId) {
  const session = await api(`/api/users/${encodeURIComponent(userId)}/session`);
  appState.loggedInUserId = session.id;
  appState.sessionUser = session;
  appState.nicknameOverride = "";
  localStorage.setItem(DEMO_USER_STORAGE_KEY, session.id);
  localStorage.removeItem(DEMO_LOGGED_OUT_KEY);
  syncLoginSelects(session.id);
  return session;
}

async function restoreDemoSession() {
  if (localStorage.getItem(DEMO_LOGGED_OUT_KEY) === "1") {
    appState.loggedInUserId = "";
    appState.sessionUser = null;
    return;
  }
  const storedUserId = localStorage.getItem(DEMO_USER_STORAGE_KEY);
  const fallbackUserId = appState.data.users[0]?.id || "";
  const userId = storedUserId || fallbackUserId;
  if (!userId) return;
  await loadSessionUser(userId);
}

async function loginDemoUser() {
  const userId = $("#loginUserSelect").value;
  if (!userId) {
    toast("로그인할 데모 계정을 선택해주세요.");
    return;
  }
  await loadSessionUser(userId);
  await reloadMyTickets();
  renderAccount();
  renderSellForm();
  renderMyTickets();
  renderSupport();
  toggleProfile(false);
  toast("데모 계정으로 로그인했습니다.");
}

function logoutDemoUser() {
  appState.loggedInUserId = "";
  appState.sessionUser = null;
  appState.myTickets = [];
  appState.qr = null;
  appState.activeSupportThreadId = "";
  window.clearInterval(appState.qrRefreshTimer);
  appState.qrRefreshTimer = null;
  localStorage.removeItem(DEMO_USER_STORAGE_KEY);
  localStorage.setItem(DEMO_LOGGED_OUT_KEY, "1");
  $("#qrBox").textContent = "가상 티켓 보기 버튼을 눌러 예매 확인용 QR을 확인해주세요.";
  setVerifyQrDisabled();
  renderAccount();
  renderSellForm();
  renderMyTickets();
  renderSupport();
  toggleProfile(false);
  toast("로그아웃되었습니다.");
}

async function updateProfile() {
  if (!requireLogin("회원정보 수정은 로그인 후 가능합니다.")) return;
  const value = $("#nicknameInput").value.trim();
  if (!value) {
    toast("닉네임을 입력해주세요.");
    return;
  }
  const userId = appState.loggedInUserId;
  appState.sessionUser = await api(`/api/users/${encodeURIComponent(userId)}/profile`, {
    name: value
  });
  appState.nicknameOverride = "";
  renderUsers();
  renderAccount();
  renderSupport();
  toast("회원정보가 수정되었습니다.");
}

function setRoute(route, updateHash = true) {
  const nextRoute = route;
  const validRoutes = ["concerts", "booking", "resale", "my", "guide", "support"];
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

function ticketsForEvent(event = currentEvent()) {
  return appState.data.tickets.filter((ticket) => ticket.eventId === event.id);
}

function renderStats(event = currentEvent()) {
  const tickets = ticketsForEvent(event);
  const available = tickets.filter((ticket) => ticket.status === "ON_SALE").length;
  const resale = appState.data.resalePools.filter((pool) => pool.eventId === event.id && pool.status === "OPEN").length;
  const sale = eventSale(event);
  return [
    sale.bookable ? `예매 가능 ${available}석` : sale.label,
    salePriceCopy(event),
    `공식 재판매 ${resale}건`,
    sale.note || "개최 날짜 선택"
  ].map((text) => `<span class="stat-pill">${text}</span>`).join("");
}

function renderEventCatalog() {
  const events = appState.data.events.filter((event) => event.category === appState.activeCategory);
  $("#eventCatalog").innerHTML = events.map((event) => {
    const sale = eventSale(event);
    return `
    <div class="event-card ${sale.bookable ? "" : "is-upcoming"}" data-route="booking" data-event-id="${event.id}" tabindex="0" role="link" aria-label="${event.title} ${sale.label}">
      <img src="${event.image}" alt="${event.title} 포스터" />
      <div class="event-info">
        <span class="badge">${event.badge}</span>
        <span class="sale-state">${saleBadge(event)}</span>
        <h3>${event.title}</h3>
        <p>${eventMeta(event)}</p>
        <div class="event-stats">${renderStats(event)}</div>
      </div>
      <a class="event-cta ${sale.bookable ? "" : "disabled"}" href="#booking" data-route="booking" data-event-id="${event.id}">${sale.bookable ? "예매하기" : sale.label}</a>
    </div>
  `;
  }).join("");
}

function renderDiscoverySections() {
  const image = "/assets/neon-stage-hero.png";
  const openSoon = appState.data.events.filter((event) => eventSale(event).state === "OPEN_SOON" || eventSale(event).state === "DISCOUNT_SOON");
  const ranking = appState.data.events.filter((event) => eventSale(event).bookable);
  const discount = appState.data.events.filter((event) => eventSale(event).discountRate > 0);
  const sections = [
    { title: "오픈 예정", more: "전체보기", events: openSoon.length ? openSoon : appState.data.events },
    { title: "장르별 랭킹", more: "전체보기", events: ranking.length ? ranking : appState.data.events },
    { title: "할인 예정 티켓", more: "특가보기", events: discount.length ? discount : openSoon }
  ];
  $("#ticketDiscovery").innerHTML = sections.map((section) => `
    <section class="discovery-section">
      <div class="discovery-head">
        <h3>${section.title}</h3>
        <a href="#booking" data-route="booking">${section.more}</a>
      </div>
      <div class="discovery-grid">
        ${section.events.slice(0, 4).map((event) => `
          <article class="discovery-card" data-route="booking" data-event-id="${event.id}" tabindex="0" role="link" aria-label="${event.title} ${eventSale(event).label}">
            <img src="${event.image || image}" alt="${event.title}" />
            <div class="card-tags"><em>${categoryLabels[event.category] || "공연"}</em><em>${saleBadge(event)}</em></div>
            <strong>${event.title}</strong>
            <span>${eventSale(event).note || eventMeta(event)} · ${salePriceCopy(event)}</span>
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
  const event = currentEvent();
  if (!eventSale(event).bookable) return [];
  const query = appState.query.trim().toLowerCase();
  return appState.data.tickets.filter((ticket) => {
    if (ticket.eventId !== event.id) return false;
    if (ticket.performanceDateId !== appState.selectedDateId) return false;
    const zone = zoneById(ticket.zoneId, event);
    const inZone = appState.activeZone === "all" || ticket.zoneId === appState.activeZone;
    const inQuery = !query || `${ticket.seatLabel} ${zone?.name || ""} ${event.title} ${event.venue}`
      .toLowerCase()
      .includes(query);
    return inZone && inQuery;
  });
}

function currentSelectedTicket(tickets = filteredTickets()) {
  return tickets.find((ticket) => ticket.id === appState.selectedSeatId && ticket.status === "ON_SALE");
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
  return paymentMethods.find((method) => method.id === appState.paymentMethod)?.label || "신용카드";
}

function selectedPaymentActionLabel() {
  return paymentMethods.find((method) => method.id === appState.paymentMethod)?.actionLabel || "신용카드로";
}

function renderBookingProgress() {
  const steps = [
    { id: "date", label: "날짜 선택" },
    { id: "seat", label: "좌석 선택" },
    { id: "payment", label: "결제" }
  ];
  const activeIndex = steps.findIndex((step) => step.id === appState.bookingStep);
  return `
    <ol class="booking-progress" aria-label="예매 단계">
      ${steps.map((step, index) => `
        <li class="${index === activeIndex ? "active" : index < activeIndex ? "done" : ""}">
          <span>${index + 1}</span>
          <strong>${step.label}</strong>
        </li>
      `).join("")}
    </ol>
  `;
}

function renderDateSelection() {
  const event = currentEvent();
  const sale = eventSale(event);
  const dates = event.dates || [];
  const selectedDate = currentDate();
  return `
    <div class="date-step-panel">
      <div class="booking-step-copy">
        <strong>${sale.bookable ? "예매 날짜 선택" : sale.label}</strong>
        <span>${sale.bookable ? "관리자가 등록한 실제 개최 날짜만 선택할 수 있습니다." : `${sale.note || "관리자 판매 오픈 후 예매할 수 있습니다."} · ${salePriceCopy(event)}`}</span>
      </div>
      <div class="booking-date-grid">
        ${dates.map((date) => `
          <button
            class="booking-date ${appState.selectedDateId === date.id ? "active" : ""}"
            type="button"
            data-booking-date="${date.id}"
            ${sale.bookable ? "" : "disabled"}
            aria-pressed="${appState.selectedDateId === date.id ? "true" : "false"}"
          >
            <span>${date.label || categoryLabels[event.category] || "공연"}</span>
            <strong>${formatDateCompact(date.startsAt)}</strong>
            <em>${new Date(date.startsAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</em>
          </button>
        `).join("")}
      </div>
      <div class="booking-step-actions">
        <button
          class="seat-selector-link"
          type="button"
          data-booking-step="seat"
          ${sale.bookable && selectedDate ? "" : "disabled"}
        >${sale.bookable ? "예매하기" : sale.label}</button>
      </div>
    </div>
  `;
}

function fallbackSeats(tickets) {
  const zoneOffsets = new Map(currentEvent().zones.map((zone, index) => [zone.id, index]));
  const zoneCounts = new Map();
  return tickets.map((ticket, index) => {
    const zoneIndex = zoneOffsets.get(ticket.zoneId) || 0;
    const count = zoneCounts.get(ticket.zoneId) || 0;
    zoneCounts.set(ticket.zoneId, count + 1);
    const col = count % 8;
    const row = Math.floor(count / 8);
    return {
      zoneId: ticket.zoneId,
      seatLabel: ticket.seatLabel,
      number: index + 1,
      x: 14 + col * 10,
      y: 22 + zoneIndex * 22 + row * 6,
      section: zoneById(ticket.zoneId)?.name || "좌석"
    };
  });
}

function renderSeatMap(tickets) {
  const event = currentEvent();
  const zones = event.zones;
  const selectedTicket = currentSelectedTicket(tickets);
  const venueMap = appState.seatMap || { seats: [], labels: [], venue: event.venue, helper: "좌석 배치도", stage: "STAGE", type: "arena" };
  const ticketsBySeat = new Map(tickets.map((ticket) => [`${ticket.zoneId}:${ticket.seatLabel}`, ticket]));
  const availableByZone = new Map(zones.map((zone) => [zone.id, tickets.filter((ticket) => ticket.zoneId === zone.id && ticket.status === "ON_SALE").length]));

  const zoneCards = zones.map((zone) => {
    const isActive = selectedTicket?.zoneId === zone.id || appState.activeZone === zone.id;
    return `
      <button class="seat-grade ${isActive ? "active" : ""}" type="button" data-seat-zone="${zone.id}">
        <span>${zone.name}</span>
        <strong>${fmt.format(zone.faceValue)}원</strong>
        <em>잔여 ${availableByZone.get(zone.id) || 0}석</em>
      </button>
    `;
  }).join("");

  const layoutSeats = venueMap.seats?.length ? venueMap.seats : fallbackSeats(tickets);
  const mapSeats = layoutSeats.map((seat) => {
    const ticket = ticketsBySeat.get(`${seat.zoneId}:${seat.seatLabel}`);
    const available = ticket?.status === "ON_SALE";
    const selected = ticket?.id === appState.selectedSeatId;
    const number = seat.seatLabel.replace(/[^0-9]/g, "");
    return `
      <button
        class="map-seat venue-seat zone-${seat.zoneId} ${selected ? "selected" : ""}"
        type="button"
        data-seat-id="${ticket?.id || ""}"
        style="--seat-x:${seat.x}%; --seat-y:${seat.y}%"
        ${available ? "" : "disabled"}
        aria-pressed="${selected ? "true" : "false"}"
        aria-label="${seat.section} ${seat.seatLabel} ${available ? "선택 가능" : "선택 불가"}"
        title="${seat.seatLabel}${ticket ? ` · ${fmt.format(ticket.faceValue)}원` : ""}"
      >${number}</button>
    `;
  }).join("");

  const mapLabels = venueMap.labels.map((label) => `
    <span class="venue-section-label" style="--label-x:${label.x}%; --label-y:${label.y}%">${label.text}</span>
  `).join("");

  const blueprint = venueMap.imageUrl
    ? `<img class="venue-blueprint" src="${venueMap.imageUrl}" alt="${venueMap.venue} 좌석 도면" loading="lazy" onerror="this.hidden=true" />`
    : "";

  const summary = selectedTicket
    ? `
      <strong>${selectedTicket.seatLabel}</strong>
      <span>${zoneById(selectedTicket.zoneId)?.name || ""} · ${fmt.format(selectedTicket.faceValue)}원</span>
    `
    : `
      <strong>선택된 좌석 없음</strong>
      <span>도면에서 좌석 하나를 클릭해주세요.</span>
    `;

  return `
    <div class="interpark-seat-flow">
      <div class="seat-grade-list" aria-label="좌석 등급 선택">${zoneCards}</div>
      <div class="seat-map-panel">
        <div class="seat-map-head">
          <div>
            <strong>${venueMap.venue}</strong>
            <span>${venueMap.helper}</span>
          </div>
          <em>좌석 클릭 → 선택, 결제 단계에서 확정</em>
        </div>
        <div class="venue-map-canvas ${venueMap.type}" aria-label="${venueMap.helper}">
          ${blueprint}
          <div class="stage-label">${venueMap.stage}</div>
          <div class="venue-field" aria-hidden="true"></div>
          ${mapLabels}
          ${mapSeats}
        </div>
        <p class="map-source">도면 API: ${venueMap.imageSource || "Ticketground 좌석 도면"}</p>
      </div>
      <div class="selected-seat-panel">
        <div>
          <span>선택 좌석</span>
          ${summary}
        </div>
        <div class="booking-step-actions split">
          <button class="secondary" type="button" data-booking-step="date">날짜 다시 선택</button>
          <button type="button" data-booking-step="payment" ${selectedTicket ? "" : "disabled"}>결제 단계로</button>
        </div>
      </div>
    </div>
  `;
}

function renderPaymentStep() {
  const event = currentEvent();
  const date = currentDate();
  const ticket = currentSelectedTicket();
  if (!ticket) {
    appState.bookingStep = "seat";
    return renderSeatStep();
  }
  const zone = zoneById(ticket.zoneId, event);
  return `
    <div class="payment-step-panel">
      <div class="payment-summary-card">
        <span class="badge">결제 전 최종 확인</span>
        <h3>${event.title}</h3>
        <dl>
          <div><dt>날짜</dt><dd>${formatDateTime(date.startsAt)}</dd></div>
          <div><dt>장소</dt><dd>${event.venue}</dd></div>
          <div><dt>좌석</dt><dd>${ticket.seatLabel} · ${zone.name}</dd></div>
          <div><dt>금액</dt><dd>${fmt.format(ticket.faceValue)}원</dd></div>
        </dl>
      </div>
      <div class="payment-methods" aria-label="결제수단 선택">
        ${renderPaymentMethods()}
      </div>
      <div class="booking-step-actions split">
        <button class="secondary" type="button" data-booking-step="seat">좌석 다시 선택</button>
        <button type="button" data-buy-selected="true">${selectedPaymentActionLabel()} 결제 완료</button>
      </div>
    </div>
  `;
}

function renderSeatStep() {
  const tickets = filteredTickets();
  return `
    <div class="seat-step-panel">
      <div class="booking-step-copy">
        <strong>좌석 선택</strong>
        <span>${formatDateTime(currentDate().startsAt)} 회차의 잔여 좌석입니다.</span>
      </div>
      ${renderSeatMap(tickets)}
    </div>
  `;
}

function renderBookingFlow() {
  if (appState.bookingStep === "date") return renderDateSelection();
  if (appState.bookingStep === "payment") return renderPaymentStep();
  return renderSeatStep();
}

function renderProductSummary() {
  const event = currentEvent();
  const venue = currentVenue();
  const summary = $(".product-summary");
  if (!summary) return;
  summary.querySelector(".badge").textContent = event.badge;
  summary.querySelector("h3").textContent = event.title;
  summary.querySelector(".rating-line strong").textContent = event.rating || "4.8";
  const facts = summary.querySelectorAll(".product-facts div");
  facts[0].querySelector("strong").textContent = venue.name;
  facts[1].querySelector("strong").textContent = eventPeriod(event);
  facts[2].querySelector("strong").textContent = `${event.durationMinutes || 120}분`;
  facts[3].querySelector("strong").textContent = event.ageLimit || "8세 이상";
  $("#productPlace p").textContent = `${venue.name} · ${venue.address || event.venue}`;
}

function renderProductTabs() {
  const isAll = appState.activeProductTab === "all";
  const activeTab = isAll || document.querySelector(`[data-product-panel="${appState.activeProductTab}"]`)
    ? appState.activeProductTab
    : "all";
  appState.activeProductTab = activeTab;
  document.querySelectorAll("[data-product-tab]").forEach((tab) => {
    const isActive = tab.dataset.productTab === activeTab;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });
  document.querySelectorAll("[data-product-panel]").forEach((panel) => {
    panel.hidden = activeTab !== "all" && panel.dataset.productPanel !== activeTab;
  });
}

function renderTickets() {
  ensureBookingSelection();
  renderProductSummary();
  const event = currentEvent();
  const venue = currentVenue();
  const sale = eventSale(event);
  $("#ticketGrid").innerHTML = `
    <article class="purchase-event ${sale.bookable ? "" : "is-upcoming"}">
      <img src="${event.image}" alt="${event.title} 포스터" />
      <div class="event-info">
        <span class="badge">${event.badge}</span>
        <span class="sale-state">${saleBadge(event)}</span>
        <h3>${event.title}</h3>
        <p>${eventMeta(event)} · ${venue.address || ""}</p>
        <div class="event-stats">${renderStats(event)}</div>
        ${renderBookingProgress()}
        ${renderBookingFlow()}
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
  const matchedEvents = appState.data.events.filter((event) =>
    `${event.title} ${event.venue} ${event.badge} ${categoryLabels[event.category] || ""}`.toLowerCase().includes(normalizedQuery)
  );
  const events = matchedEvents.length ? matchedEvents : appState.data.events.filter((event) => event.category === appState.activeCategory);
  container.hidden = false;

  $("#searchResultCopy").textContent = `"${queryText}" 검색 조건에 맞는 판매 공연입니다. 예매 단계에서 날짜와 좌석을 선택합니다.`;
  $("#saleTicketResults").innerHTML = events.map((event) => `
    <div class="event-card ${eventSale(event).bookable ? "" : "is-upcoming"}" data-route="booking" data-event-id="${event.id}" tabindex="0" role="link" aria-label="${event.title} ${eventSale(event).label}">
      <img src="${event.image}" alt="${event.title} 포스터" />
      <div class="event-info">
        <span class="badge">${event.badge}</span>
        <span class="sale-state">${saleBadge(event)}</span>
        <h3>${event.title}</h3>
        <p>${eventMeta(event)}</p>
        <div class="event-stats">${renderStats(event)}</div>
      </div>
      <a class="event-cta ${eventSale(event).bookable ? "" : "disabled"}" href="#booking" data-route="booking" data-event-id="${event.id}">${eventSale(event).bookable ? "예매하기" : eventSale(event).label}</a>
    </div>
  `).join("");

  const openPools = appState.data.resalePools.filter((pool) => pool.status === "OPEN");
  $("#resalePreviewList").innerHTML = openPools.length ? openPools.map(renderPoolCard).join("") : `
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

function renderPoolCard(pool) {
  const event = eventById(pool.eventId);
  const zone = zoneById(pool.zoneId, event);
  const date = eventDateById(event, pool.performanceDateId);
  return `
    <article class="resale-card">
      <div class="resale-top">
        <div>
          <strong>${event.title} · ${zone.name} 공식 재판매</strong>
          <p>${formatDateTime(date.startsAt)} · ${fmt.format(pool.price)}원 · 대기자 ${pool.buyerCount || 0}명</p>
        </div>
        <span class="seat-status">OPEN</span>
      </div>
      <p>결제 완료 후 ${zone.name} 구역의 재판매 티켓과 자동 매칭됩니다.</p>
      <div class="resale-actions">
        <button data-resale-purchase="${pool.id}">재판매 티켓 구매</button>
      </div>
    </article>
  `;
}

function renderPools() {
  const openPools = appState.data.resalePools.filter((pool) => pool.status === "OPEN");
  $("#poolList").innerHTML = openPools.length
    ? openPools.map(renderPoolCard).join("")
    : `<p>현재 열린 공식 재판매 티켓이 없습니다. My 예매내역에서 보유 티켓을 등록할 수 있습니다.</p>`;
}

function ticketLabel(ticket) {
  const event = eventById(ticket.eventId);
  const date = eventDateById(event, ticket.performanceDateId);
  return `${event.title} · ${formatDateCompact(date.startsAt)} · ${ticket.seatLabel}`;
}

function sellableTickets() {
  if (!isLoggedIn()) return [];
  return appState.myTickets.filter((ticket) =>
    ticket.status === "OWNED" && ticket.transferCount < ticket.maxTransferCount
  );
}

function selectedSellTicket() {
  const selectedId = $("#sellTicketSelect").value;
  return sellableTickets().find((ticket) => ticket.id === selectedId) || null;
}

function renderSellPricePolicy(ticket) {
  const policy = $("#sellPricePolicy");
  const input = $("#sellPriceInput");
  input.min = ticket ? String(ticket.minPrice) : "0";
  input.max = ticket ? String(ticket.maxPrice) : "";
  input.step = "1000";
  input.value = ticket ? String(ticket.faceValue) : "";
  input.disabled = !ticket;

  if (!ticket) {
    policy.innerHTML = `<p>재판매 등록 가능한 보유 티켓이 없습니다.</p>`;
    return;
  }

  policy.innerHTML = `
    <dl>
      <div><dt>티켓 원가</dt><dd>${fmt.format(ticket.faceValue)}원</dd></div>
      <div><dt>판매 가능 범위</dt><dd>${fmt.format(ticket.minPrice)}원부터 ${fmt.format(ticket.maxPrice)}원까지</dd></div>
    </dl>
    <p>판매 가격은 위 범위 안에서 직접 입력할 수 있습니다.</p>
  `;
}

function renderSellForm() {
  const sellable = sellableTickets();
  optionList($("#sellTicketSelect"), sellable, (ticket) =>
    `${ticketLabel(ticket)} · 원가 ${fmt.format(ticket.faceValue)}원 · 최대 ${fmt.format(ticket.maxPrice)}원`
  );
  renderSellPricePolicy(sellable[0] || null);
  $("#sellBtn").disabled = !sellable.length;
}

function renderMyTickets() {
  if (!isLoggedIn()) {
    $("#myTicketList").innerHTML = `<p>로그인 후 예매 내역을 확인할 수 있습니다.</p>`;
    return;
  }
  const owned = appState.myTickets;
  $("#myTicketList").innerHTML = owned.length ? owned.map((ticket, ticketIndex) => {
    const event = eventById(ticket.eventId);
    const date = eventDateById(event, ticket.performanceDateId);
    const canResell = ticket.status === "OWNED" && ticket.transferCount < ticket.maxTransferCount;
    return `
      <article class="myticket-card">
        <div class="myticket-top">
          <div>
            <strong>${ticket.seatLabel}</strong>
            <p>${event.title}</p>
          </div>
          <span class="seat-status ${ticket.status === "OWNED" ? "" : "closed"}">${statusLabel(ticket)}</span>
        </div>
        <p>${formatDateTime(date.startsAt)} · ${event.venue}</p>
        <div class="ticket-action-grid">
          <button ${ticket.status === "OWNED" ? "" : "disabled"} data-virtual-ticket-index="${ticketIndex}">가상 티켓 보기</button>
          <button class="secondary" type="button" disabled aria-disabled="true">${WEB_ADMISSION_QR_GUIDANCE}</button>
        </div>
        <p class="ticket-app-only">웹에서는 캡처 방지를 위해 실제 입장 QR이 노출되지 않습니다.</p>
        <button class="secondary" ${canResell ? "" : "disabled"} data-fill-sell="${ticket.id}">재판매 등록 준비</button>
      </article>
    `;
  }).join("") : `<p>아직 보유한 티켓이 없습니다. 날짜 선택과 좌석 선택 후 결제해보세요.</p>`;
}

function supportStatusLabel(status) {
  const labels = { OPEN: "답변 대기", ANSWERED: "답변 완료", CLOSED: "상담 종료" };
  return labels[status] || status;
}

function supportThreadsForUser() {
  if (!isLoggedIn()) return [];
  const user = currentUser();
  return (appState.data.supportThreads || [])
    .filter((thread) => thread.userId === user.id)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function currentSupportThread() {
  const threads = supportThreadsForUser();
  return threads.find((thread) => thread.id === appState.activeSupportThreadId)
    || threads.find((thread) => thread.status !== "CLOSED")
    || threads[0];
}

function renderSupportThreads() {
  const node = $("#supportThreadList");
  if (!node) return;
  const threads = supportThreadsForUser();
  node.innerHTML = threads.length ? threads.map((thread) => {
    const lastMessage = thread.messages.at(-1);
    return `
      <button class="support-thread-card" type="button" data-support-thread="${thread.id}">
        <span>${supportStatusLabel(thread.status)}</span>
        <strong>${escapeHtml(thread.subject)}</strong>
        <em>${lastMessage ? escapeHtml(lastMessage.body) : "메시지 없음"}</em>
      </button>
    `;
  }).join("") : `<p class="empty">아직 문의 내역이 없습니다. 우측 하단 고객센터를 눌러 문의를 남겨보세요.</p>`;
}

function renderSupportChat() {
  const chat = $("#supportChat");
  if (!chat) return;
  chat.hidden = !appState.supportOpen;
  const thread = currentSupportThread();
  if (thread) appState.activeSupportThreadId = thread.id;
  const messages = thread?.messages || [];
  $("#supportChatMessages").innerHTML = messages.length ? messages.map((message) => `
    <div class="support-message ${message.role === "ADMIN" ? "admin" : "customer"}">
      <span>${message.role === "ADMIN" ? "상담원" : displayName()} · ${new Date(message.at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</span>
      <p>${escapeHtml(message.body)}</p>
    </div>
  `).join("") : `
    <div class="support-empty">
      <strong>무엇을 도와드릴까요?</strong>
      <p>예매, 좌석, 결제, 환불 관련 문의를 남겨주세요.</p>
    </div>
  `;
  $("#supportSubjectInput").hidden = !!thread;
  $("#supportSubjectInput").disabled = !!thread;
  $("#supportMessageInput").placeholder = thread ? "추가 메시지를 입력해주세요" : "문의 내용을 입력해주세요";
  $("#supportChatMessages").scrollTop = $("#supportChatMessages").scrollHeight;
}

function renderSupport() {
  renderSupportThreads();
  renderSupportChat();
}

async function reloadSupportThreads() {
  if (!isLoggedIn()) {
    appState.data.supportThreads = [];
    renderSupport();
    return;
  }
  const user = currentUser();
  const threads = await api(`/api/support/threads?userId=${encodeURIComponent(user.id)}`);
  const otherThreads = (appState.data.supportThreads || []).filter((thread) => thread.userId !== user.id);
  appState.data.supportThreads = [...threads, ...otherThreads];
  renderSupport();
}

async function reloadMyTickets() {
  if (!isLoggedIn()) {
    appState.myTickets = [];
    return;
  }
  const user = currentUser();
  appState.myTickets = await api(`/api/users/${encodeURIComponent(user.id)}/tickets`);
}

function openSupportChat(threadId = "") {
  appState.supportOpen = true;
  if (threadId) appState.activeSupportThreadId = threadId;
  renderSupport();
  clearInterval(appState.supportPollTimer);
  appState.supportPollTimer = window.setInterval(() => reloadSupportThreads().catch(() => {}), 3000);
}

function closeSupportChat() {
  appState.supportOpen = false;
  clearInterval(appState.supportPollTimer);
  renderSupportChat();
}

async function submitSupportMessage() {
  if (!requireLogin("문의는 로그인 후 남길 수 있습니다.")) return;
  const thread = currentSupportThread();
  const message = $("#supportMessageInput").value.trim();
  const subject = $("#supportSubjectInput").value.trim() || "1:1 실시간 문의";
  if (!message) {
    toast("문의 내용을 입력해주세요.");
    return;
  }
  if (thread && thread.status !== "CLOSED") {
    await api("/api/support/messages", {
      threadId: thread.id,
      actorId: currentUser().id,
      role: "CUSTOMER",
      message
    });
  } else {
    const created = await api("/api/support/threads", {
      userId: currentUser().id,
      subject,
      message
    });
    appState.activeSupportThreadId = created.id;
  }
  $("#supportMessageInput").value = "";
  $("#supportSubjectInput").value = "";
  await reloadSupportThreads();
  toast("문의가 고객센터로 전달되었습니다.");
}


async function refresh() {
  appState.data = await api("/api/state");
  ensureBookingSelection();
  await loadSeatMap();
  renderUsers();
  await restoreDemoSession();
  await reloadMyTickets();
  renderAccount();
  renderHero();
  startHeroTimer();
  renderEventCatalog();
  renderDiscoverySections();
  renderZoneTabs();
  renderTickets();
  renderPools();
  renderSearchResults();
  renderSellForm();
  renderMyTickets();
  await reloadSupportThreads();
  renderSupport();
  renderProductTabs();
  setRoute(window.location.hash.replace("#", "") || appState.route, false);
}

async function buyTicket(ticketId) {
  if (!requireLogin("예매는 로그인 후 가능합니다.")) return;
  const result = await api("/api/tickets/buy", {
    userId: currentUser().id,
    ticketId,
    paymentMethod: appState.paymentMethod
  });
  const paymentLabel = result.payment?.label || selectedPaymentLabel();
  const actionLabel = paymentMethods.find((method) => method.label === paymentLabel)?.actionLabel || selectedPaymentActionLabel();
  const statusCopy = result.payment?.status === "WAITING_DEPOSIT" ? "입금대기 상태로 예매되었습니다." : "결제가 승인되었습니다.";
  toast(`${actionLabel} ${statusCopy} My 예매내역에서 확인하세요.`);
  appState.bookingStep = "date";
  appState.selectedSeatId = "";
  await refresh();
  setRoute("my");
}

async function listForResale() {
  if (!requireLogin("재판매 등록은 로그인 후 가능합니다.")) return;
  const ticketId = $("#sellTicketSelect").value;
  const priceInput = $("#sellPriceInput");
  const priceText = priceInput.value.trim();
  const price = Number(priceText);
  const ticket = selectedSellTicket();
  if (!ticketId || !priceText || !Number.isFinite(price)) {
    toast("판매할 티켓과 가격을 입력해주세요.");
    return;
  }
  if (!ticket || price < ticket.minPrice || price > ticket.maxPrice) {
    toast(`판매 가격은 ${fmt.format(ticket?.minPrice || 0)}원부터 ${fmt.format(ticket?.maxPrice || 0)}원까지 입력할 수 있습니다.`);
    priceInput.focus();
    return;
  }
  await api("/api/resale/list", { sellerId: currentUser().id, ticketId, price });
  toast("공식 재판매 풀에 등록했습니다.");
  await refresh();
}

async function purchaseResaleTicket(poolId) {
  if (!requireLogin("재판매 티켓 구매는 로그인 후 가능합니다.")) return;
  const result = await api("/api/resale/purchase", {
    buyerId: currentUser().id,
    poolId,
    paymentMethod: appState.paymentMethod
  });
  if (result.skipped) {
    toast("결제가 완료되지 않았습니다. 다른 결제수단을 선택해주세요.");
    await refresh();
    return;
  }
  toast(`${selectedPaymentLabel()} 결제가 완료되어 재판매 티켓과 매칭되었습니다. My 예매내역에서 확인하세요.`);
  await refresh();
  setRoute("my");
}

async function issueQr(ticketId) {
  void ticketId;
  window.clearInterval(appState.qrRefreshTimer);
  appState.qrRefreshTimer = null;
  appState.qr = null;
  $("#qrBox").textContent = WEB_ADMISSION_QR_GUIDANCE;
  setVerifyQrDisabled();
  toast(WEB_ADMISSION_QR_GUIDANCE);
}

async function issueVirtualQr(ticketId) {
  if (!requireLogin("가상 티켓은 로그인 후 확인할 수 있습니다.")) return;
  window.clearInterval(appState.qrRefreshTimer);
  appState.qrRefreshTimer = null;
  appState.qr = await api("/api/tickets/virtual-qr", { userId: currentUser().id, ticketId });
  renderQrBox(appState.qr);
  toast("예매 확인용 가상 티켓을 표시했습니다. 실제 입장에는 사용할 수 없습니다.");
}

function setVerifyQrDisabled() {
  const button = $("#verifyQrBtn");
  if (!button) return;
  button.disabled = true;
  button.setAttribute("aria-disabled", "true");
  button.textContent = "입장 QR은 모바일 앱 전용";
}

function safeQrDetail(value, fallback = "확인 전") {
  if (value === null || value === undefined || value === "") return escapeHtml(fallback);
  return escapeHtml(value);
}

function safeQrDateTime(value) {
  if (!value) return "확인 전";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "확인 전";
  return formatDateTime(value);
}

function virtualQrStatusLabel(status) {
  const labels = {
    VIRTUAL_READY: "예매 확인 가능",
    QR_ACTIVE: "모바일 앱 입장 QR 활성화",
    USED: "입장 완료"
  };
  return labels[status] || "확인 전";
}

function virtualQrChannelLabel(channel) {
  const labels = {
    APP_ONLY: "모바일 앱 전용",
    APP: "모바일 앱",
    EMERGENCY: "현장 예외 처리"
  };
  return labels[channel] || "모바일 앱 전용";
}

function virtualQrPattern(seed) {
  const source = seed || "Ticketground";
  let hash = 0;
  for (const char of source) hash = ((hash << 5) - hash + char.charCodeAt(0)) >>> 0;
  return Array.from({ length: 81 }, (_, index) => {
    const x = index % 9;
    const y = Math.floor(index / 9);
    const finder =
      (x <= 2 && y <= 2) ||
      (x >= 6 && y <= 2) ||
      (x <= 2 && y >= 6);
    const filled = finder || (((hash + (index * 37) + (x * 11) + (y * 17)) % 7) <= 2);
    return `<span class="qr-cell ${filled ? "filled" : ""}" aria-hidden="true"></span>`;
  }).join("");
}

function renderQrBox(qr) {
  setVerifyQrDisabled();
  if (!qr || qr.type !== "VIRTUAL_TICKET") {
    $("#qrBox").innerHTML = `
      <div class="qr-summary locked">
        <strong>입장 QR은 모바일 앱에서만 확인 가능합니다</strong>
        <p>웹에서는 캡처 방지를 위해 실제 입장 QR을 노출하지 않습니다. 입장 당일 앱에서 본인 확인 후 20초 갱신 QR이 활성화됩니다.</p>
      </div>
    `;
    return;
  }
  const eventTitle = safeQrDetail(qr.eventTitle, "Ticketground 예매 티켓");
  const seatLabel = safeQrDetail(qr.seatLabel, "좌석 정보 확인 중");
  const performanceCopy = safeQrDateTime(qr.performanceStartsAt);
  const availableCopy = safeQrDateTime(qr.realQrAvailableAt);
  const preparedCopy = safeQrDateTime(qr.qrPreparedAt);
  const statusCopy = virtualQrStatusLabel(qr.admissionCredentialStatus);
  const channelCopy = virtualQrChannelLabel(qr.admissionChannel);
  const pattern = virtualQrPattern(`${qr.eventTitle || ""}|${qr.seatLabel || ""}|${qr.performanceStartsAt || ""}`);
  const details = [
    ["공연 일시", performanceCopy],
    ["준비 안내", preparedCopy],
    ["입장 QR", `${availableCopy} 앱 전용`],
    ["상태", statusCopy],
    ["확인 채널", channelCopy]
  ];
  $("#qrBox").innerHTML = `
    <div class="qr-summary virtual" data-watermark="TICKETGROUND">
      <div class="qr-card-copy">
        <span>가상 티켓</span>
        <strong>${eventTitle}</strong>
        <em>${seatLabel}</em>
      </div>
      <div class="qr-art" aria-label="예매 확인용 가상 QR 이미지">${pattern}</div>
      ${details.map(([label, value]) => `
        <div class="info-row">
          <strong>${label}</strong>
          <span>${safeQrDetail(value)}</span>
        </div>
      `).join("")}
      <p class="qr-app-lock">이 이미지는 예매 확인용입니다. 실제 입장 QR은 입장 당일 모바일 앱에서만 노출됩니다.</p>
    </div>
  `;
}

async function verifyQr() {
  window.clearInterval(appState.qrRefreshTimer);
  appState.qrRefreshTimer = null;
  appState.qr = null;
  $("#qrBox").textContent = WEB_ADMISSION_QR_GUIDANCE;
  setVerifyQrDisabled();
  toast(WEB_ADMISSION_QR_GUIDANCE);
}


function toggleProfile(open) {
  const dropdown = $("#profileDropdown");
  const next = open ?? !dropdown.classList.contains("open");
  dropdown.classList.toggle("open", next);
  $("#profileButton").setAttribute("aria-expanded", String(next));
}

async function selectEventForBooking(eventId) {
  if (eventId) appState.selectedEventId = eventId;
  appState.bookingStep = "date";
  appState.selectedSeatId = "";
  appState.activeZone = "all";
  appState.activeProductTab = "all";
  ensureBookingSelection();
  await loadSeatMap();
  renderTickets();
}

document.addEventListener("click", async (event) => {
  const target = event.target;
  const profileButton = target.closest("#profileButton");
  const profileMenu = target.closest(".profile-menu");
  const routeLink = target.closest("[data-route]");
  const dateButton = target.closest("[data-booking-date]");
  const stepButton = target.closest("[data-booking-step]");
  const seatZoneButton = target.closest("[data-seat-zone]");
  const seatButton = target.closest("[data-seat-id]");
  const paymentButton = target.closest("[data-payment-method]");
  const productTab = target.closest("[data-product-tab]");
  const supportThreadButton = target.closest("[data-support-thread]");
  const resalePurchaseButton = target.closest("[data-resale-purchase]");
  if (profileButton) {
    toggleProfile();
    return;
  }

  try {
    if (routeLink) {
      event.preventDefault();
      if (routeLink.dataset.route === "booking") {
        const heroRoot = routeLink.closest(".hero");
        const eventId = routeLink.dataset.eventId || (heroRoot ? heroSlides[appState.heroIndex].eventId : appState.selectedEventId);
        await selectEventForBooking(eventId);
      }
      setRoute(routeLink.dataset.route);
      if (routeLink.dataset.openProfileEdit) {
        window.setTimeout(() => $("#nicknameInput").focus(), 0);
      }
      return;
    }

    if (productTab) {
      event.preventDefault();
      appState.activeProductTab = productTab.dataset.productTab;
      renderProductTabs();
      return;
    }

    if (!profileMenu) toggleProfile(false);
    if (target.dataset.closeMenu) toggleProfile(false);
    if (target.dataset.openProfileEdit) $("#nicknameInput").focus();

    if (paymentButton) {
      appState.paymentMethod = paymentButton.dataset.paymentMethod;
      renderTickets();
      return;
    }

    if (target.closest("[data-open-support-chat]")) {
      openSupportChat();
      return;
    }

    if (target.closest("[data-close-support-chat]")) {
      closeSupportChat();
      return;
    }

    if (supportThreadButton) {
      openSupportChat(supportThreadButton.dataset.supportThread);
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

    if (dateButton) {
      appState.selectedDateId = dateButton.dataset.bookingDate;
      appState.selectedSeatId = "";
      appState.bookingStep = "date";
      renderTickets();
      return;
    }

    if (stepButton) {
      const requested = stepButton.dataset.bookingStep;
      if ((requested === "seat" || requested === "payment") && !requireLogin("예매는 로그인 후 가능합니다.")) {
        return;
      }
      if (requested === "payment" && !currentSelectedTicket()) {
        toast("결제 전에 좌석을 선택해주세요.");
        return;
      }
      appState.bookingStep = requested;
      renderTickets();
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
      if (!seatButton.dataset.seatId) return;
      appState.selectedSeatId = seatButton.dataset.seatId;
      const selectedTicket = appState.data.tickets.find((ticket) => ticket.id === appState.selectedSeatId);
      if (selectedTicket) appState.activeZone = selectedTicket.zoneId;
      renderZoneTabs();
      renderTickets();
      return;
    }

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
      appState.searchActive = true;
      renderTickets();
      renderSearchResults();
      setRoute("concerts");
      $("#searchResults").scrollIntoView({ behavior: "smooth", block: "start" });
    }
    const categoryButton = target.closest("[data-category]");
    if (categoryButton) {
      appState.activeCategory = categoryButton.dataset.category;
      document.querySelectorAll(".category-tab").forEach((tab) => {
        tab.classList.toggle("active", tab.dataset.category === appState.activeCategory);
      });
      renderEventCatalog();
    }
    if (target.dataset.buySelected) {
      const seatId = appState.selectedSeatId;
      if (!seatId) toast("예매할 좌석을 선택해주세요.");
      else await buyTicket(seatId);
    }
    if (resalePurchaseButton) await purchaseResaleTicket(resalePurchaseButton.dataset.resalePurchase);
    if (target.dataset.virtualTicketIndex !== undefined) {
      const ticket = appState.myTickets[Number(target.dataset.virtualTicketIndex)];
      if (ticket) await issueVirtualQr(ticket.id);
    }
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
  const userId = $("#userSelect").value;
  loadSessionUser(userId)
    .then(() => reloadMyTickets())
    .then(() => {
      renderAccount();
      renderSellForm();
      renderMyTickets();
      renderSupport();
    })
    .catch((error) => toast(error.message));
});

$("#sellTicketSelect").addEventListener("change", () => {
  renderSellPricePolicy(selectedSellTicket());
});

$("#sellBtn").addEventListener("click", () => listForResale().catch((error) => toast(error.message)));
$("#loginBtn").addEventListener("click", () => loginDemoUser().catch((error) => toast(error.message)));
$("#verifyQrBtn").addEventListener("click", () => verifyQr().catch((error) => toast(error.message)));
setVerifyQrDisabled();
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

$("#supportChatForm").addEventListener("submit", (event) => {
  event.preventDefault();
  submitSupportMessage().catch((error) => toast(error.message));
});


document.addEventListener("keydown", async (event) => {
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
    await selectEventForBooking(routeTarget.dataset.eventId || appState.selectedEventId);
  }
  setRoute(routeTarget.dataset.route);
});

$("#profileEditForm").addEventListener("submit", (event) => {
  event.preventDefault();
  updateProfile().catch((error) => toast(error.message));
});

$("#logoutBtn").addEventListener("click", () => {
  logoutDemoUser();
});

window.addEventListener("hashchange", () => {
  setRoute(window.location.hash.replace("#", "") || "concerts", false);
});

refresh().catch((error) => toast(error.message));
