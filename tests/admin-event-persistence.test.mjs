import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { createTicketgroundApp } from "../backend/app.js";

const tinyPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAF/wJ/0R5yyAAAAABJRU5ErkJggg==";

function requestStream(method, url, body) {
  const request = Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []);
  request.method = method;
  request.url = url;
  request.headers = { host: "admin-event-persistence.test" };
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
      nowOverride: "2026-05-01T12:00:00+09:00",
      secret: "admin-event-persistence-runtime-secret"
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

test("admin event remains loadable after update removes price zones", async () => {
  // Given: an admin-created event with extra custom zones persisted to the JSON DB.
  const tempDir = await mkdtemp(path.join(tmpdir(), "ticketground-zone-shrink-"));
  try {
    const app = await ticketgroundApp(tempDir);
    const create = await requestApp(app, {
      surface: "admin",
      method: "POST",
      url: "/api/admin/events/create",
      body: {
        title: "존 축소 검증 공연",
        category: "musical",
        startsAt: "2026-05-13T19:30:00+09:00",
        venueId: "venue_bluesquare_shinhan_card_hall",
        slug: "zone-shrink-event",
        prices: [
          { grade: "OP", seat: "OP석", price: 200000 },
          { grade: "VIP", seat: "VIP석", price: 190000 },
          { grade: "R", seat: "R석", price: 160000 },
          { grade: "S", seat: "S석", price: 120000 },
          { grade: "A", seat: "A석", price: 80000 }
        ],
        imageDataUrl: tinyPng
      }
    });
    assert.equal(create.status, 200);

    // When: the event is updated to keep only one zone.
    const update = await requestApp(app, {
      surface: "admin",
      method: "POST",
      url: "/api/admin/events/sale",
      body: {
        eventId: create.json.data.event.id,
        title: "존 축소 검증 공연",
        category: "musical",
        startsAt: "2026-05-13T19:30:00+09:00",
        venueId: "venue_bluesquare_shinhan_card_hall",
        saleState: "ON_SALE",
        prices: [{ grade: "VIP", seat: "VIP석", price: 190000 }]
      }
    });
    assert.equal(update.status, 200);

    // Then: a fresh app load normalizes the DB without stale removed-zone tickets.
    const reloaded = await ticketgroundApp(tempDir);
    const state = await requestApp(reloaded, { surface: "public", method: "GET", url: "/api/state" });
    assert.equal(state.status, 200);
    const event = state.json.data.events.find((item) => item.id === create.json.data.event.id);
    assert.ok(event);
    assert.deepEqual(event.zones.map((zone) => zone.id), ["zone_vip"]);
    const eventTickets = state.json.data.tickets.filter((ticket) => ticket.eventId === event.id);
    assert.ok(eventTickets.length > 0);
    assert.deepEqual([...new Set(eventTickets.map((ticket) => ticket.zoneId))], ["zone_vip"]);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
