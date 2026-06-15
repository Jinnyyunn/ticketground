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
  paymentMethod: "BALANCE",
  seatMap: null,
  seatMapEventId: ""
};

const paymentMethods = [
  { id: "BALANCE", label: "충전금", actionLabel: "충전금으로", note: "보유 충전금 즉시 차감" },
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

function ownerName(ownerId) {
  return appState.data.users.find((user) => user.id === ownerId)?.name || "예매 가능";
}

function statusLabel(ticket) {
  if (ticket.status === "ON_SALE") return "예매 가능";
  if (ticket.status === "IN_RESALE_POOL") return "재판매 중";
  return "예매 완료";
}

function eventMeta(event) {
  const firstDate = event.dates?.[0];
  const lastDate = event.dates?.at(-1);
  const dateCopy = firstDate && lastDate && firstDate.id !== lastDate.id
    ? `${formatDateCompact(firstDate.startsAt)} - ${formatDateCompact(lastDate.startsAt)}`
    : formatDateTime(firstDate?.startsAt || event.date);
  return `${dateCopy} · ${event.venue}`;
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
  $("#headerLoginStatus").textContent = `${name}님 로그인`;
  $("#headerBalance").textContent = `충전금 ${fmt.format(user.balance)}원`;
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
  const validRoutes = ["concerts", "booking", "resale", "my", "admin", "guide"];
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
  return [
    `예매 가능 ${available}석`,
    `공식 재판매 ${resale}건`,
    "개최 날짜 선택",
    "좌석 직접 선택"
  ].map((text) => `<span class="stat-pill">${text}</span>`).join("");
}

function renderEventCatalog() {
  const events = appState.data.events.filter((event) => event.category === appState.activeCategory);
  $("#eventCatalog").innerHTML = events.map((event) => `
    <div class="event-card" data-route="booking" data-event-id="${event.id}" tabindex="0" role="link" aria-label="${event.title} 예매하기">
      <img src="${event.image}" alt="${event.title} 포스터" />
      <div class="event-info">
        <span class="badge">${event.badge}</span>
        <h3>${event.title}</h3>
        <p>${eventMeta(event)}</p>
        <div class="event-stats">${renderStats(event)}</div>
      </div>
      <a class="event-cta" href="#booking" data-route="booking" data-event-id="${event.id}">예매하기</a>
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
          <article class="discovery-card" data-route="booking" data-event-id="${item.eventId}" tabindex="0" role="link" aria-label="${item.title} 예매하기">
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
  const event = currentEvent();
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
  return paymentMethods.find((method) => method.id === appState.paymentMethod)?.label || "충전금";
}

function selectedPaymentActionLabel() {
  return paymentMethods.find((method) => method.id === appState.paymentMethod)?.actionLabel || "충전금으로";
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
  const dates = event.dates || [];
  return `
    <div class="date-step-panel">
      <div class="booking-step-copy">
        <strong>예매 날짜 선택</strong>
        <span>관리자가 등록한 실제 개최 날짜만 선택할 수 있습니다.</span>
      </div>
      <div class="booking-date-grid">
        ${dates.map((date) => `
          <button
            class="booking-date ${appState.selectedDateId === date.id ? "active" : ""}"
            type="button"
            data-booking-date="${date.id}"
            aria-pressed="${appState.selectedDateId === date.id ? "true" : "false"}"
          >
            <span>${date.label || categoryLabels[event.category] || "공연"}</span>
            <strong>${formatDateCompact(date.startsAt)}</strong>
            <em>${new Date(date.startsAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</em>
          </button>
        `).join("")}
      </div>
      <div class="booking-step-actions">
        <button type="button" onclick="window.openSeatSelector()">좌석 선택</button>
      </div>
    </div>
  `;
}

function seatSelectorUrl() {
  const event = currentEvent();
  const date = currentDate();
  const url = new URL("/좌석 도면/잠실 올림픽 경기장/좌석선택.dc.html", window.location.origin);
  url.searchParams.set("eventTitle", event.title);
  url.searchParams.set("eventSub", event.badge || categoryLabels[event.category] || "Ticketground");
  url.searchParams.set("eventVenue", event.venue);
  url.searchParams.set("eventDate", formatDateTime(date.startsAt));
  url.searchParams.set("maxTickets", "4");
  return url.toString();
}

window.openSeatSelector = function openSeatSelector() {
  if (!currentDate()) {
    toast("예매 날짜를 먼저 선택해주세요.");
    return;
  }
  const popup = window.open(
    seatSelectorUrl(),
    "ticketground-seat-selector",
    "popup=yes,width=1280,height=860,menubar=no,toolbar=no,location=no,status=no"
  );
  if (!popup) {
    toast("팝업이 차단되었습니다. 브라우저 팝업 허용 후 다시 예매하기를 눌러주세요.");
    return;
  }
  popup.focus();
};

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

  const mapSeats = venueMap.seats.map((seat) => {
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
  facts[1].querySelector("strong").textContent = event.dates?.length > 1
    ? `${formatDateCompact(event.dates[0].startsAt)} 외 ${event.dates.length - 1}회`
    : formatDateCompact(event.dates?.[0]?.startsAt || event.date);
  facts[2].querySelector("strong").textContent = `${event.durationMinutes || 120}분`;
  facts[3].querySelector("strong").textContent = event.ageLimit || "8세 이상";
  $("#productPlace p").textContent = `${venue.name} · ${venue.address || event.venue}`;
}

function renderTickets() {
  ensureBookingSelection();
  renderProductSummary();
  const event = currentEvent();
  const venue = currentVenue();
  $("#ticketGrid").innerHTML = `
    <article class="purchase-event">
      <img src="${event.image}" alt="${event.title} 포스터" />
      <div class="event-info">
        <span class="badge">${event.badge}</span>
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
    <div class="event-card" data-route="booking" data-event-id="${event.id}" tabindex="0" role="link" aria-label="${event.title} 예매하기">
      <img src="${event.image}" alt="${event.title} 포스터" />
      <div class="event-info">
        <span class="badge">${event.badge}</span>
        <h3>${event.title}</h3>
        <p>${eventMeta(event)}</p>
        <div class="event-stats">${renderStats(event)}</div>
      </div>
      <a class="event-cta" href="#booking" data-route="booking" data-event-id="${event.id}">예매하기</a>
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
          <p>${formatDateTime(date.startsAt)} · ${fmt.format(pool.price)}원 · 대기자 ${pool.buyers.length}명</p>
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

function renderSellForm() {
  const user = currentUser();
  const sellable = appState.data.tickets.filter((ticket) =>
    ticket.ownerId === user.id && ticket.status === "OWNED" && ticket.transferCount < ticket.maxTransferCount
  );
  optionList($("#sellTicketSelect"), sellable, (ticket) =>
    `${ticketLabel(ticket)} · 최대 ${fmt.format(ticket.maxPrice)}원`
  );
  const first = sellable[0];
  $("#sellPriceInput").value = first ? first.maxPrice : "";
  $("#sellBtn").disabled = !sellable.length;
}

function renderMyTickets() {
  const user = currentUser();
  const owned = appState.data.tickets.filter((ticket) => ticket.ownerId === user.id);
  $("#myTicketList").innerHTML = owned.length ? owned.map((ticket) => {
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
        <button ${ticket.status === "OWNED" ? "" : "disabled"} data-qr="${ticket.id}">입장 QR 발급</button>
        <button class="secondary" ${canResell ? "" : "disabled"} data-fill-sell="${ticket.id}">재판매 등록 준비</button>
      </article>
    `;
  }).join("") : `<p>아직 보유한 티켓이 없습니다. 날짜 선택과 좌석 선택 후 결제해보세요.</p>`;
}

function renderAdminPanel() {
  const eventSelect = $("#adminEventSelect");
  const venueSelect = $("#adminVenueSelect");
  if (!eventSelect || !venueSelect) return;
  const previousEvent = eventSelect.value || appState.selectedEventId;
  eventSelect.innerHTML = appState.data.events.map((event) => `
    <option value="${event.id}">${event.title} · ${categoryLabels[event.category] || event.category}</option>
  `).join("");
  eventSelect.value = appState.data.events.some((event) => event.id === previousEvent) ? previousEvent : appState.selectedEventId;
  const selectedEvent = eventById(eventSelect.value);
  venueSelect.innerHTML = appState.data.venues.map((venue) => `
    <option value="${venue.id}">${venue.name}</option>
  `).join("");
  venueSelect.value = selectedEvent.venueId;
  const selectedVenue = venueById(venueSelect.value);
  $("#adminVenueCurrent").textContent = `${selectedEvent.title} 현재 개최 장소: ${selectedVenue?.name || selectedEvent.venue}`;
  $("#adminMapPreview").innerHTML = `
    <strong>${selectedVenue?.name || "공연장"}</strong>
    <span>${selectedVenue?.address || "주소 정보 없음"}</span>
    <em>${selectedVenue?.mapType || "map"} 도면 API가 사용자 예매 화면에 연결됩니다.</em>
  `;
}

async function refresh() {
  appState.data = await api("/api/state");
  ensureBookingSelection();
  await loadSeatMap();
  renderUsers();
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
  renderAdminPanel();
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
  appState.bookingStep = "date";
  appState.selectedSeatId = "";
  await refresh();
  setRoute("my");
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

async function updateVenue() {
  const eventId = $("#adminEventSelect").value;
  const venueId = $("#adminVenueSelect").value;
  await api("/api/admin/events/venue", { eventId, venueId });
  appState.selectedEventId = eventId;
  appState.bookingStep = "date";
  appState.selectedSeatId = "";
  toast("관리자 설정이 저장되었습니다. 사용자 예매 화면에 새 도면 API가 적용됩니다.");
  await refresh();
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

$("#saveVenueBtn").addEventListener("click", () => updateVenue().catch((error) => toast(error.message)));
$("#adminEventSelect").addEventListener("change", () => renderAdminPanel());
$("#adminVenueSelect").addEventListener("change", () => renderAdminPanel());

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
