import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { allowedCategories } from "../backend/admin-event-content.js";
import { createTicketgroundApp } from "../backend/app.js";
import { eventBlueprints } from "../backend/catalog-data.js";

const tinyPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAF/wJ/0R5yyAAAAABJRU5ErkJggg==";

function requestStream(method, url, body) {
  const request = Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []);
  request.method = method;
  request.url = url;
  request.headers = { host: "admin-event-content.test" };
  return request;
}

async function requestApp(app, { body, method, surface, url }) {
  const response = { status: 0, body: "" };
  const res = {
    writeHead(status) {
      response.status = status;
    },
    end(chunk = "") {
      response.body += chunk.toString();
    }
  };
  await app.handleRequest(requestStream(method, url, body), res, app.db, surface);
  return { ...response, json: JSON.parse(response.body) };
}

async function ticketgroundApp(tempDir) {
  return await createTicketgroundApp({
    dbPath: path.join(tempDir, "db.json"),
    mediaDir: { directory: path.join(tempDir, "uploads"), urlPrefix: "/manual-uploads" },
    runtime: {
      appAttestationSecret: "admin-event-content-app-secret",
      nowOverride: "2026-05-01T12:00:00+09:00",
      secret: "admin-event-content-runtime-secret"
    },
    http: {
      adminDir: tempDir,
      fallbackPublic: "/index.html",
      jamsilOlympicSeatMapDir: tempDir,
      MIME: { ".json": "application/json; charset=utf-8" },
      projectDir: process.cwd(),
      publicDir: tempDir,
      seatMapDir: tempDir
    }
  });
}

function eventById(state, eventId) {
  const event = state.data.events.find((item) => item.id === eventId);
  assert.ok(event, `${eventId} exists`);
  return event;
}

test("backend event blueprints use the public category taxonomy", () => {
  // Given: the backend seed events and the admin-supported public taxonomy.
  const allowed = new Set(allowedCategories);

  // When: every seeded backend event category is checked.
  const unsupported = eventBlueprints().filter((event) => !allowed.has(event.category));

  // Then: no legacy-only category remains in seed data.
  assert.deepEqual(unsupported, []);
});

test("admin API stores complete event content when creating and updating catalog events", async (t) => {
  // Given: a full TicketShow-shaped event payload submitted through the admin API.
  const tempDir = await mkdtemp(path.join(tmpdir(), "ticketground-admin-content-"));
  t.after(() => rm(tempDir, { recursive: true, force: true }));
  const app = await ticketgroundApp(tempDir);
  const createPayload = {
    title: "레미제라블 40주년",
    shortTitle: "레미제라블",
    category: "theater",
    startsAt: "2026-05-13T19:30:00+09:00",
    venueId: "venue_lg_arts_center_seoul_lg_signature_hall",
    saleState: "OPEN_SOON",
    saleNote: "클린티켓 오픈 예정",
    discountRate: 10,
    period: "2026.05.13 ~ 2026.08.30",
    runtime: "170분(인터미션 20분 포함)",
    ageLimit: "8세 이상 관람가",
    badge: "클린티켓",
    artistSlug: "les-miserables-cast",
    slug: "les-miserables-admin",
    prices: [
      { grade: "OP", seat: "OP석", price: 200000 },
      { grade: "VIP", seat: "VIP석", price: 190000 },
      { grade: "R", seat: "R석", price: 160000 },
      { grade: "S", seat: "S석", price: 120000 },
      { grade: "A", seat: "A석", price: 80000 }
    ],
    schedules: [
      { label: "5월 13일", date: "2026.05.13", times: ["19:30"] },
      { label: "5월 14일", date: "2026.05.14", times: ["14:30", "19:30"] }
    ],
    casts: ["민우혁", "최재림", "김소현"],
    notices: ["회차별 1인 4매까지 예매할 수 있습니다.", "공식 양도 정책이 적용됩니다."],
    summary: "관리자 콘솔에서 하드코딩 공연 수준의 상세 정보를 저장합니다.",
    pinnedRank: 3,
    imageDataUrl: tinyPng
  };

  // When: the event is created.
  const create = await requestApp(app, {
    surface: "admin",
    method: "POST",
    url: "/api/admin/events/create",
    body: createPayload
  });

  // Then: the public state preserves every submitted content field.
  assert.equal(create.status, 200, create.body);
  assert.equal(create.json.data.event.slug, "les-miserables-admin");
  assert.deepEqual(create.json.data.event.zones.map((zone) => zone.id), ["zone_op", "zone_vip", "zone_r", "zone_s", "zone_a"]);
  assert.ok(create.json.data.ticketsCreated > 0);

  const createdState = await requestApp(app, { surface: "public", method: "GET", url: "/api/state" });
  assert.equal(createdState.status, 200, createdState.body);
  const createdEvent = eventById(createdState.json, create.json.data.event.id);
  assert.equal(createdEvent.shortTitle, createPayload.shortTitle);
  assert.equal(createdEvent.period, createPayload.period);
  assert.equal(createdEvent.runtime, createPayload.runtime);
  assert.equal(createdEvent.ageLimit, createPayload.ageLimit);
  assert.equal(createdEvent.badge, createPayload.badge);
  assert.equal(createdEvent.artistSlug, createPayload.artistSlug);
  assert.equal(createdEvent.slug, createPayload.slug);
  assert.deepEqual(createdEvent.prices, createPayload.prices);
  assert.deepEqual(createdEvent.schedules, createPayload.schedules);
  assert.deepEqual(createdEvent.casts, createPayload.casts);
  assert.deepEqual(createdEvent.notices, createPayload.notices);
  assert.equal(createdEvent.summary, createPayload.summary);
  assert.equal(createdEvent.pinnedRank, 3);
  assert.deepEqual(createdEvent.dates.map((date) => date.startsAt), [
    "2026-05-13T19:30:00+09:00",
    "2026-05-14T14:30:00+09:00",
    "2026-05-14T19:30:00+09:00"
  ]);

  // When: the same event is edited through the sale update endpoint.
  const updatePayload = {
    eventId: create.json.data.event.id,
    title: "레미제라블 최종",
    shortTitle: "레미제라블 최종",
    category: "musical",
    startsAt: "2026-06-01T20:00:00+09:00",
    venueId: "venue_bluesquare_shinhan_card_hall",
    saleState: "ON_SALE",
    saleNote: "공식 판매 진행 중",
    discountRate: 0,
    period: "2026.06.01 ~ 2026.08.30",
    runtime: "165분",
    ageLimit: "14세 이상 관람가",
    badge: "좌석우위",
    artistSlug: "les-miserables-final-cast",
    slug: "les-miserables-final-admin",
    prices: [
      { grade: "VIP", seat: "VIP석", price: 195000 },
      { grade: "R", seat: "R석", price: 165000 },
      { grade: "S", seat: "S석", price: 125000 }
    ],
    schedules: [
      { label: "6월 1일", date: "2026.06.01", times: ["20:00"] },
      { label: "6월 2일", date: "2026.06.02", times: ["15:00"] }
    ],
    casts: ["최재림", "김소현"],
    notices: ["변경된 회차 정보입니다."],
    summary: "수정 엔드포인트에서도 상세 정보를 다시 저장합니다.",
    pinnedRank: null
  };
  const updated = await requestApp(app, {
    surface: "admin",
    method: "POST",
    url: "/api/admin/events/sale",
    body: updatePayload
  });

  // Then: edited content is reflected in the same public state response.
  assert.equal(updated.status, 200, updated.body);
  assert.equal(updated.json.data.event.slug, updatePayload.slug);
  const updatedState = await requestApp(app, { surface: "public", method: "GET", url: "/api/state" });
  assert.equal(updatedState.status, 200, updatedState.body);
  const updatedEvent = eventById(updatedState.json, create.json.data.event.id);
  assert.equal(updatedEvent.title, updatePayload.title);
  assert.equal(updatedEvent.shortTitle, updatePayload.shortTitle);
  assert.equal(updatedEvent.category, updatePayload.category);
  assert.equal(updatedEvent.venue, "블루스퀘어 신한카드홀");
  assert.equal(updatedEvent.period, updatePayload.period);
  assert.equal(updatedEvent.runtime, updatePayload.runtime);
  assert.equal(updatedEvent.ageLimit, updatePayload.ageLimit);
  assert.equal(updatedEvent.badge, updatePayload.badge);
  assert.equal(updatedEvent.artistSlug, updatePayload.artistSlug);
  assert.equal(updatedEvent.slug, updatePayload.slug);
  assert.deepEqual(updatedEvent.prices, updatePayload.prices);
  assert.deepEqual(updatedEvent.schedules, updatePayload.schedules);
  assert.deepEqual(updatedEvent.casts, updatePayload.casts);
  assert.deepEqual(updatedEvent.notices, updatePayload.notices);
  assert.equal(updatedEvent.summary, updatePayload.summary);
  assert.equal(updatedEvent.pinnedRank, null);

  const duplicateSlug = await requestApp(app, {
    surface: "admin",
    method: "POST",
    url: "/api/admin/events/create",
    body: {
      ...createPayload,
      title: "중복 슬러그 공연",
      startsAt: "2026-07-01T19:30:00+09:00",
      slug: updatePayload.slug
    }
  });
  assert.equal(duplicateSlug.status, 409, duplicateSlug.body);
  assert.equal(duplicateSlug.json.error.code, "EVENT_SLUG_EXISTS");
});

test("admin API accepts repeated source price grades and stores canonical price rows", async (t) => {
  // Given: a source TicketShow-style payload with repeated PASS grades.
  const tempDir = await mkdtemp(path.join(tmpdir(), "ticketground-repeat-grade-"));
  t.after(() => rm(tempDir, { recursive: true, force: true }));
  const app = await ticketgroundApp(tempDir);

  // When: the event is created through the same admin API route.
  const create = await requestApp(app, {
    surface: "admin",
    method: "POST",
    url: "/api/admin/events/create",
    body: {
      title: "서울 재즈 페스티벌",
      category: "concert",
      startsAt: "2026-05-30T13:00:00+09:00",
      venueId: "venue_nanjipark",
      slug: "repeat-pass-grade",
      prices: [
        { grade: "PASS", seat: "1일권", price: 121000, hidden: { should: "drop" } },
        { grade: "PASS", seat: "양일권", price: 198000 }
      ],
      schedules: [{ label: "5월 30일", date: "2026.05.30", times: ["13:00"] }],
      imageDataUrl: tinyPng
    }
  });

  // Then: both rows become usable zones, and public prices contain only canonical fields.
  assert.equal(create.status, 200, create.body);
  assert.equal(create.json.data.event.zones[0].id, "zone_pass-1");
  assert.match(create.json.data.event.zones[1].id, /^zone_pass-[a-f0-9]{12}$/);
  const state = await requestApp(app, { surface: "public", method: "GET", url: "/api/state" });
  const event = eventById(state.json, create.json.data.event.id);
  assert.deepEqual(event.prices, [
    { grade: "PASS", seat: "1일권", price: 121000 },
    { grade: "PASS", seat: "양일권", price: 198000 }
  ]);

  const ownedTicket = app.db.tickets.find((ticket) => ticket.eventId === event.id && ticket.zoneId === "zone_pass-1");
  assert.ok(ownedTicket);
  ownedTicket.ownerId = "user_fan_a";
  ownedTicket.status = "OWNED";
  const reordered = await requestApp(app, {
    surface: "admin",
    method: "POST",
    url: "/api/admin/events/sale",
    body: {
      eventId: event.id,
      title: "서울 재즈 페스티벌",
      category: "concert",
      startsAt: "2026-05-30T13:00:00+09:00",
      venueId: "venue_nanjipark",
      prices: [
        { grade: "PASS", seat: "양일권", price: 198000 },
        { grade: "PASS", seat: "1일권", price: 121000 }
      ]
    }
  });
  assert.equal(reordered.status, 200, reordered.body);
  const updatedOneDayZone = reordered.json.data.event.zones.find((zone) => zone.id === "zone_pass-1");
  assert.equal(updatedOneDayZone.name, "1일권");
  assert.equal(updatedOneDayZone.faceValue, 121000);
  assert.equal(ownedTicket.zoneId, "zone_pass-1");
  assert.equal(ownedTicket.faceValue, 121000);
});

test("admin workspace selects a requested non-default event by eventId", async (t) => {
  // Given: a seeded app with many public catalog events.
  const tempDir = await mkdtemp(path.join(tmpdir(), "ticketground-workspace-event-picker-"));
  t.after(() => rm(tempDir, { recursive: true, force: true }));
  const app = await ticketgroundApp(tempDir);
  const catalog = await requestApp(app, { surface: "public", method: "GET", url: "/api/catalog" });
  assert.equal(catalog.status, 200, catalog.body);
  assert.ok(catalog.json.data.events.length > 2);
  const target = catalog.json.data.events[2];

  // When: the sales workspace is requested with a specific eventId.
  const selected = await requestApp(app, {
    surface: "admin",
    method: "GET",
    url: `/api/admin/workspaces/sales?eventId=${encodeURIComponent(target.id)}`
  });
  const defaulted = await requestApp(app, {
    surface: "admin",
    method: "GET",
    url: "/api/admin/workspaces/sales"
  });

  // Then: the lightweight picker still lists all events, while the editable record is the selected event.
  assert.equal(selected.status, 200, selected.body);
  assert.equal(selected.json.data.events.length, 1);
  assert.equal(selected.json.data.events[0].id, target.id);
  assert.ok(selected.json.data.eventSummaries.length >= catalog.json.data.events.length);
  assert.ok(selected.json.data.eventSummaries.some((event) => event.id === target.id && event.ticketCount > 0));
  assert.notEqual(defaulted.json.data.events[0].id, "event_kpop_001");
  assert.ok(defaulted.json.data.events[0].prices.length > 0);
});

test("admin hold and closed sale states are visible and not bookable in the public catalog", async (t) => {
  // Given: an admin-created event that is explicitly held.
  const tempDir = await mkdtemp(path.join(tmpdir(), "ticketground-sale-state-public-"));
  t.after(() => rm(tempDir, { recursive: true, force: true }));
  const app = await ticketgroundApp(tempDir);
  const create = await requestApp(app, {
    surface: "admin",
    method: "POST",
    url: "/api/admin/events/create",
    body: {
      title: "관리 보류 공개 검증",
      category: "concert",
      startsAt: "2026-05-30T13:00:00+09:00",
      venueId: "venue_nanjipark",
      saleState: "ADMIN_HOLD",
      saleNote: "운영 검수 중",
      slug: "admin-hold-public-contract",
      prices: [{ grade: "PASS", seat: "1일권", price: 121000 }],
      imageDataUrl: tinyPng
    }
  });
  assert.equal(create.status, 200, create.body);

  // When: the public catalog is read and then the same event is closed.
  const heldCatalog = await requestApp(app, { surface: "public", method: "GET", url: "/api/catalog" });
  const heldEvent = eventById(heldCatalog.json, create.json.data.event.id);
  const closed = await requestApp(app, {
    surface: "admin",
    method: "POST",
    url: "/api/admin/events/sale",
    body: {
      eventId: create.json.data.event.id,
      title: "관리 보류 공개 검증",
      category: "concert",
      startsAt: "2026-05-30T13:00:00+09:00",
      venueId: "venue_nanjipark",
      saleState: "CLOSED"
    }
  });
  const closedCatalog = await requestApp(app, { surface: "public", method: "GET", url: "/api/catalog" });
  const closedEvent = eventById(closedCatalog.json, create.json.data.event.id);

  // Then: users see the sale state before checkout and both states are non-bookable.
  assert.equal(heldEvent.saleState, "ADMIN_HOLD");
  assert.equal(heldEvent.sale.bookable, false);
  assert.equal(heldEvent.sale.label, "판매 보류");
  assert.equal(heldEvent.sale.note, "운영 검수 중");
  assert.equal(closed.status, 200, closed.body);
  assert.equal(closedEvent.saleState, "CLOSED");
  assert.equal(closedEvent.sale.bookable, false);
  assert.equal(closedEvent.sale.label, "판매 종료");
});

test("admin venue change removes stale open tickets from the previous venue", async (t) => {
  // Given: an event with generated tickets for one real venue.
  const tempDir = await mkdtemp(path.join(tmpdir(), "ticketground-venue-stale-tickets-"));
  t.after(() => rm(tempDir, { recursive: true, force: true }));
  const app = await ticketgroundApp(tempDir);
  const create = await requestApp(app, {
    surface: "admin",
    method: "POST",
    url: "/api/admin/events/create",
    body: {
      title: "장소 변경 유령 좌석 검증",
      category: "concert",
      startsAt: "2026-06-01T20:00:00+09:00",
      venueId: "venue_jamsil_olympic",
      slug: "venue-stale-ticket-cleanup",
      imageDataUrl: tinyPng
    }
  });
  assert.equal(create.status, 200, create.body);
  const eventId = create.json.data.event.id;
  const baseTicket = app.db.tickets.find((ticket) => ticket.eventId === eventId && ticket.status === "ON_SALE");
  assert.ok(baseTicket);
  app.db.tickets.push({
    ...baseTicket,
    id: "ticket_old_venue_ghost",
    seatLabel: "OLD-VENUE-GHOST-1"
  });

  // When: the venue changes to a different layout.
  const changed = await requestApp(app, {
    surface: "admin",
    method: "POST",
    url: "/api/admin/events/venue",
    body: { eventId, venueId: "venue_bluesquare_shinhan_card_hall" }
  });

  // Then: no open ticket from the previous venue remains sellable.
  assert.equal(changed.status, 200, changed.body);
  assert.equal(app.db.tickets.some((ticket) => ticket.id === "ticket_old_venue_ghost"), false);
  assert.ok(app.db.tickets.some((ticket) => ticket.eventId === eventId && ticket.status === "ON_SALE"));
});

test("admin sale update syncs schedules from startsAt and applies custom zone seat counts", async (t) => {
  // Given: a custom-grade event with an explicit synthetic capacity.
  const tempDir = await mkdtemp(path.join(tmpdir(), "ticketground-schedule-seatcount-"));
  t.after(() => rm(tempDir, { recursive: true, force: true }));
  const app = await ticketgroundApp(tempDir);
  const create = await requestApp(app, {
    surface: "admin",
    method: "POST",
    url: "/api/admin/events/create",
    body: {
      title: "좌석 수 및 일정 동기화",
      category: "concert",
      startsAt: "2026-07-01T19:30:00+09:00",
      venueId: "venue_nanjipark",
      slug: "seat-count-schedule-sync",
      prices: [{ grade: "FLOORX", seat: "커스텀 플로어", price: 88000, seatCount: 7 }],
      schedules: [{ label: "7월 1일", date: "2026.07.01", times: ["19:30"] }],
      imageDataUrl: tinyPng
    }
  });
  assert.equal(create.status, 200, create.body);
  const eventId = create.json.data.event.id;
  assert.equal(app.db.tickets.filter((ticket) => ticket.eventId === eventId).length, 7);

  // When: the sales endpoint changes only the representative startsAt and increases synthetic capacity.
  const update = await requestApp(app, {
    surface: "admin",
    method: "POST",
    url: "/api/admin/events/sale",
    body: {
      eventId,
      title: "좌석 수 및 일정 동기화",
      category: "concert",
      startsAt: "2026-07-02T20:15:00+09:00",
      venueId: "venue_nanjipark",
      prices: { [create.json.data.event.zones[0].id]: 99000 },
      seatCounts: { [create.json.data.event.zones[0].id]: 9 }
    }
  });

  // Then: the public schedule and generated tickets match the sales edit.
  assert.equal(update.status, 200, update.body);
  const state = await requestApp(app, { surface: "public", method: "GET", url: "/api/state" });
  const event = eventById(state.json, eventId);
  assert.deepEqual(event.schedules, [{ label: "1회차", date: "2026-07-02", times: ["20:15"] }]);
  assert.equal(event.zones[0].seatCount, 9);
  assert.equal(state.json.data.tickets.filter((ticket) => ticket.eventId === eventId).length, 9);
});

test("admin API maps legacy festival category payloads to the public concert taxonomy", async (t) => {
  // Given: the previously accepted admin category value from the legacy console.
  const tempDir = await mkdtemp(path.join(tmpdir(), "ticketground-legacy-festival-"));
  t.after(() => rm(tempDir, { recursive: true, force: true }));
  const app = await ticketgroundApp(tempDir);

  // When: the legacy payload is submitted.
  const create = await requestApp(app, {
    surface: "admin",
    method: "POST",
    url: "/api/admin/events/create",
    body: {
      title: "레거시 페스티벌",
      category: "festival",
      startsAt: "2026-05-30T13:00:00+09:00",
      venueId: "venue_nanjipark",
      slug: "legacy-festival-event",
      imageDataUrl: tinyPng
    }
  });

  // Then: the request remains compatible, but stored public category uses the new taxonomy.
  assert.equal(create.status, 200, create.body);
  assert.equal(create.json.data.event.category, "concert");
  const state = await requestApp(app, { surface: "public", method: "GET", url: "/api/state" });
  const event = eventById(state.json, create.json.data.event.id);
  assert.equal(event.category, "concert");
});

test("admin API rejects malformed or oversized event content before persisting it", async (t) => {
  // Given: a clean app state.
  const tempDir = await mkdtemp(path.join(tmpdir(), "ticketground-bad-content-"));
  t.after(() => rm(tempDir, { recursive: true, force: true }));
  const app = await ticketgroundApp(tempDir);
  const initialState = await requestApp(app, { surface: "public", method: "GET", url: "/api/state" });
  const initialEventCount = initialState.json.data.events.length;
  const basePayload = {
    title: "입력 검증 공연",
    category: "musical",
    startsAt: "2026-05-13T19:30:00+09:00",
    venueId: "venue_bluesquare_shinhan_card_hall",
    imageDataUrl: tinyPng
  };
  const invalidPayloads = [
    { slug: "bad-price-row", prices: [null] },
    { slug: "overflow-price", prices: [{ grade: "VIP", seat: "VIP석", price: 1.7e308 }] },
    { slug: "impossible-date", schedules: [{ label: "오류", date: "2026.02.30", times: ["19:30"] }] },
    {
      slug: "too-many-prices",
      prices: Array.from({ length: 21 }, (_, index) => ({ grade: `G${index}`, seat: `G${index}석`, price: 10000 }))
    },
    {
      slug: "too-many-schedules",
      schedules: Array.from({ length: 31 }, (_, index) => ({ label: `${index + 1}회`, date: "2026.05.13", times: ["19:30"] }))
    }
  ];

  // When/Then: every malformed request returns a structured 4xx and creates no event.
  for (const payload of invalidPayloads) {
    const response = await requestApp(app, {
      surface: "admin",
      method: "POST",
      url: "/api/admin/events/create",
      body: { ...basePayload, ...payload }
    });
    assert.equal(response.status, 422, response.body);
    assert.ok(response.json.error.code);
  }
  const finalState = await requestApp(app, { surface: "public", method: "GET", url: "/api/state" });
  assert.equal(finalState.json.data.events.length, initialEventCount);
});

test("admin update preserves owned tickets and removes stale open tickets for replaced schedules", async (t) => {
  // Given: an admin event with two zones and two performance dates.
  const tempDir = await mkdtemp(path.join(tmpdir(), "ticketground-ticket-integrity-"));
  t.after(() => rm(tempDir, { recursive: true, force: true }));
  const app = await ticketgroundApp(tempDir);
  const create = await requestApp(app, {
    surface: "admin",
    method: "POST",
    url: "/api/admin/events/create",
    body: {
      title: "티켓 무결성 검증 공연",
      category: "musical",
      startsAt: "2026-05-13T19:30:00+09:00",
      venueId: "venue_bluesquare_shinhan_card_hall",
      slug: "ticket-integrity-event",
      prices: [
        { grade: "VIP", seat: "VIP석", price: 190000 },
        { grade: "R", seat: "R석", price: 160000 }
      ],
      schedules: [
        { label: "5월 13일", date: "2026.05.13", times: ["19:30"] },
        { label: "5월 14일", date: "2026.05.14", times: ["14:30"] }
      ],
      imageDataUrl: tinyPng
    }
  });
  assert.equal(create.status, 200, create.body);
  const eventId = create.json.data.event.id;
  const ownedTicket = app.db.tickets.find((ticket) => ticket.eventId === eventId && ticket.zoneId === "zone_r");
  assert.ok(ownedTicket);
  ownedTicket.ownerId = "user_fan_a";
  ownedTicket.status = "OWNED";
  ownedTicket.faceValue = 160000;
  ownedTicket.maxPrice = 171200;

  // When: an update tries to remove the owned ticket's zone.
  const rejected = await requestApp(app, {
    surface: "admin",
    method: "POST",
    url: "/api/admin/events/sale",
    body: {
      eventId,
      title: "티켓 무결성 검증 공연",
      category: "musical",
      startsAt: "2026-05-13T19:30:00+09:00",
      venueId: "venue_bluesquare_shinhan_card_hall",
      prices: [{ grade: "VIP", seat: "VIP석", price: 190000 }]
    }
  });

  // Then: the owned ticket is not silently rewritten.
  assert.equal(rejected.status, 409, rejected.body);
  assert.equal(rejected.json.error.code, "EVENT_ZONE_IN_USE");
  assert.equal(ownedTicket.zoneId, "zone_r");
  assert.equal(ownedTicket.faceValue, 160000);
  assert.equal(ownedTicket.maxPrice, 171200);

  // When: schedules are replaced while only open tickets reference the removed date.
  ownedTicket.ownerId = null;
  ownedTicket.status = "ON_SALE";
  const updated = await requestApp(app, {
    surface: "admin",
    method: "POST",
    url: "/api/admin/events/sale",
    body: {
      eventId,
      title: "티켓 무결성 검증 공연",
      category: "musical",
      startsAt: "2026-05-15T20:00:00+09:00",
      venueId: "venue_bluesquare_shinhan_card_hall",
      prices: [
        { grade: "VIP", seat: "VIP석", price: 190000 },
        { grade: "R", seat: "R석", price: 160000 }
      ],
      schedules: [{ label: "5월 15일", date: "2026.05.15", times: ["20:00"] }]
    }
  });

  // Then: stale open tickets for removed dates are gone and new date inventory exists.
  assert.equal(updated.status, 200, updated.body);
  const state = await requestApp(app, { surface: "public", method: "GET", url: "/api/state" });
  const event = eventById(state.json, eventId);
  const activeDateIds = new Set(event.dates.map((date) => date.id));
  const eventTickets = state.json.data.tickets.filter((ticket) => ticket.eventId === eventId);
  assert.ok(eventTickets.length > 0);
  assert.deepEqual([...new Set(eventTickets.map((ticket) => ticket.performanceDateId))], [...activeDateIds]);
});
