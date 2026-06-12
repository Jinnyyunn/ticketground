const appState = {
  data: null,
  activeZone: "all",
  activeCategory: "concert",
  query: "",
  searchActive: false,
  qr: null,
  route: "concerts",
  nicknameOverride: ""
};

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

const $ = (selector) => document.querySelector(selector);
const fmt = new Intl.NumberFormat("ko-KR");

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
  const aliases = { resale: "booking" };
  const wasAlias = Boolean(aliases[route]);
  const nextRoute = aliases[route] || route;
  const validRoutes = ["concerts", "booking", "my", "guide"];
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
  if (!updateHash && wasAlias && window.location.hash !== `#${appState.route}`) {
    history.replaceState(null, "", `#${appState.route}`);
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

function renderEventCatalog() {
  const events = categoryEvents[appState.activeCategory] || categoryEvents.concert;
  $("#eventCatalog").innerHTML = events.map((item, index) => `
    <div class="event-card">
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
      <a class="event-cta" href="#booking" data-route="${item.route}">${item.cta}</a>
    </div>
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

function renderTickets() {
  const tickets = filteredTickets().filter((ticket) => ticket.status === "ON_SALE");
  const zoneOptions = currentEvent().zones.map((zone) => {
    const availableCount = tickets.filter((ticket) => ticket.zoneId === zone.id).length;
    return `<option value="${zone.id}" ${availableCount ? "" : "disabled"}>${zone.name} · ${fmt.format(zone.faceValue)}원 · ${availableCount}석</option>`;
  }).join("");
  const seatOptions = tickets.map((ticket) => `
    <option value="${ticket.id}" data-zone="${ticket.zoneId}">
      ${ticket.seatLabel} · ${fmt.format(ticket.faceValue)}원
    </option>
  `).join("");

  $("#ticketGrid").innerHTML = `
    <article class="purchase-event">
      <img src="/assets/neon-stage-hero.png" alt="${currentEvent().title} 포스터" />
      <div class="event-info">
        <span class="badge">공식 1차 판매</span>
        <h3>${currentEvent().title}</h3>
        <p>${new Date(currentEvent().date).toLocaleString("ko-KR")} · ${currentEvent().venue}</p>
        <div class="event-stats">${renderStats()}</div>
        <div class="seat-purchase-row">
          <label>
            구역 선택
            <select id="purchaseZoneSelect">${zoneOptions}</select>
          </label>
          <label>
            좌석 선택
            <select id="purchaseSeatSelect">${seatOptions || `<option value="">예매 가능한 좌석 없음</option>`}</select>
          </label>
          <button data-buy-selected="true" ${seatOptions ? "" : "disabled"}>예매하기</button>
        </div>
      </div>
    </article>
  `;
  syncPurchaseSeats();
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
    <div class="event-card">
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
  renderEventCatalog();
  renderZoneTabs();
  renderTickets();
  renderPools();
  renderSearchResults();
  renderSellForm();
  renderMyTickets();
  setRoute(window.location.hash.replace("#", "") || appState.route, false);
}

async function buyTicket(ticketId) {
  await api("/api/tickets/buy", { userId: currentUser().id, ticketId });
  toast("예매가 완료되었습니다. My 예매내역에서 확인하세요.");
  await refresh();
}

function syncPurchaseSeats() {
  const zoneSelect = $("#purchaseZoneSelect");
  const seatSelect = $("#purchaseSeatSelect");
  if (!zoneSelect || !seatSelect) return;
  const selectedZone = zoneSelect.value;
  let firstVisible = "";
  [...seatSelect.options].forEach((option) => {
    const isVisible = !option.value || option.dataset.zone === selectedZone;
    option.hidden = !isVisible;
    option.disabled = !isVisible;
    if (isVisible && option.value && !firstVisible) firstVisible = option.value;
  });
  if (firstVisible) seatSelect.value = firstVisible;
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

  if (profileButton) {
    toggleProfile();
    return;
  }
  if (routeLink) {
    event.preventDefault();
    setRoute(routeLink.dataset.route);
  }
  if (!profileMenu) toggleProfile(false);
  if (target.dataset.closeMenu) toggleProfile(false);
  if (target.dataset.openProfileEdit) {
    $("#nicknameInput").focus();
  }

  try {
    if (target.dataset.zone) {
      appState.activeZone = target.dataset.zone;
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
      const seatId = $("#purchaseSeatSelect")?.value;
      if (!seatId) {
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
document.addEventListener("change", (event) => {
  if (event.target.id === "purchaseZoneSelect") syncPurchaseSeats();
});
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
