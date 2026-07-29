import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { createCatalogPersistence } from "../backend/catalog-persistence.js";
import { createSessionBackend } from "../backend/session.js";
import {
  configureSocialEnv,
  cookieHeaderFromSetCookie,
  createDirectSocialBackend,
  PROVIDERS,
} from "./social-auth-test-helpers.mjs";

test("database reload preserves explicitly incomplete profiles while backfilling legacy users", () => {
  // Given: one newly registered social user with an explicitly incomplete
  // profile and one legacy user whose confirmation field predates the feature.
  const confirmedAt = "2026-09-19T17:00:00.000Z";
  const database = {
    users: [
      { id: "provider_user_new", profileConfirmedAt: null },
      { id: "provider_user_saved", profileConfirmedAt: "2026-09-18T17:00:00.000Z" },
      { id: "user_legacy" },
    ],
    events: [],
    tickets: [],
    resalePools: [],
  };
  const persistence = createCatalogPersistence({
    appendLedger() {},
    clone: structuredClone,
    ensureAdmissionCredential() {},
    ensureTicketsForEvent: () => false,
    eventBlueprints: () => [],
    now: () => confirmedAt,
    primaryDate: () => ({ id: "unused" }),
    stableId: () => "unused",
    syncEventVenue() {},
    venueBlueprints: () => [],
  });

  // When: the persisted database is normalized during a server restart.
  persistence.normalizeDb(database);

  // Then: only absent legacy state is backfilled; explicit incompleteness remains.
  assert.equal(database.users[0].profileConfirmedAt, null);
  assert.equal(database.users[1].profileConfirmedAt, "2026-09-18T17:00:00.000Z");
  assert.equal(database.users[2].profileConfirmedAt, confirmedAt);
});

test("new Kakao and Naver identities persist an explicit incomplete-profile marker", async (t) => {
  // Given: enabled deterministic provider callbacks for isolated Kakao and Naver identities.
  configureSocialEnv(t, true);

  for (const provider of ["kakao", "naver"]) {
    const { backend, db } = createDirectSocialBackend();
    const request = { headers: { host: "127.0.0.1:1" } };
    const start = backend.socialAuthStart(request, provider);
    const state = new URL(start.redirect).searchParams.get("state");
    assert.ok(state, `${provider} state is present`);

    // When: the provider callback registers a first-time social user.
    await backend.socialAuthCallback(
      db,
      {
        headers: {
          host: "127.0.0.1:1",
          cookie: cookieHeaderFromSetCookie(start.headers["Set-Cookie"]),
        },
      },
      provider,
      new URLSearchParams({ code: PROVIDERS[provider].code, state }),
    );

    // Then: persistence can distinguish this incomplete profile from legacy missing data.
    assert.equal(db.users.length, 1);
    assert.equal(db.users[0].profileConfirmedAt, null);
  }
});

test("new Google identities persist an explicit incomplete-profile marker", async (t) => {
  // Given: a deterministic Google credential and an empty user database.
  const previousTestMode = process.env.TIG_GOOGLE_AUTH_TEST_MODE;
  process.env.TIG_GOOGLE_AUTH_TEST_MODE = "1";
  t.after(() => {
    if (previousTestMode === undefined) delete process.env.TIG_GOOGLE_AUTH_TEST_MODE;
    else process.env.TIG_GOOGLE_AUTH_TEST_MODE = previousTestMode;
  });
  const db = { users: [], ledger: [] };
  const sessionBackend = createSessionBackend({
    appendLedger(database, actorId, action, payload) {
      database.ledger.push({ actorId, action, payload });
    },
    currentTimeMs: () => Date.UTC(2026, 8, 19, 8, 0, 0),
    findUser(database, userId) {
      return database.users.find((user) => user.id === userId);
    },
    hmac: () => "unused",
    httpError(status, code, message) {
      return Object.assign(new Error(message), { code, status });
    },
    now: () => "2026-09-19T17:00:00.000Z",
    stableId: (prefix, value) => `${prefix}_${value}`,
  });

  // When: Google authentication registers a first-time user.
  await sessionBackend.googleSession(db, {
    credential: "ticketground-google-test-credential",
  });

  // Then: persistence can distinguish this incomplete profile from legacy missing data.
  assert.equal(db.users.length, 1);
  assert.equal(db.users[0].profileConfirmedAt, null);
});

test("Kakao, Naver, and Google identities cannot expose another provider profile", async (t) => {
  // Given: all three providers authenticate into one persisted user database.
  configureSocialEnv(t, true);
  const previousGoogleTestMode = process.env.TIG_GOOGLE_AUTH_TEST_MODE;
  process.env.TIG_GOOGLE_AUTH_TEST_MODE = "1";
  t.after(() => {
    if (previousGoogleTestMode === undefined) delete process.env.TIG_GOOGLE_AUTH_TEST_MODE;
    else process.env.TIG_GOOGLE_AUTH_TEST_MODE = previousGoogleTestMode;
  });
  const db = { users: [], ledger: [] };
  const nowMs = Date.UTC(2026, 8, 19, 8, 0, 0);
  const sessionBackend = createSessionBackend({
    appendLedger(database, actorId, action, payload) {
      database.ledger.push({ actorId, action, payload });
    },
    currentTimeMs: () => nowMs,
    findUser(database, userId) {
      return database.users.find((user) => user.id === userId);
    },
    hmac: (value) => crypto.createHmac("sha256", "profile-isolation-test-secret").update(value).digest("hex"),
    httpError(status, code, message) {
      return Object.assign(new Error(message), { code, status });
    },
    now: () => "2026-09-19T17:00:00.000Z",
    stableId: (prefix, ...values) => `${prefix}_${crypto.createHash("sha256").update(values.join(":")).digest("hex").slice(0, 12)}`,
  });

  async function registerSocialProvider(provider) {
    const request = { headers: { host: "127.0.0.1:1" } };
    const start = sessionBackend.socialAuthStart(request, provider);
    const state = new URL(start.redirect).searchParams.get("state");
    assert.ok(state, `${provider} state is present`);
    await sessionBackend.socialAuthCallback(
      db,
      {
        headers: {
          host: "127.0.0.1:1",
          cookie: cookieHeaderFromSetCookie(start.headers["Set-Cookie"]),
        },
      },
      provider,
      new URLSearchParams({ code: PROVIDERS[provider].code, state }),
    );
    return db.users.at(-1);
  }

  const kakaoUser = await registerSocialProvider("kakao");
  assert.ok(kakaoUser);
  kakaoUser.name = "카카오 저장 프로필";
  kakaoUser.profileConfirmedAt = "2026-09-19T17:01:00.000Z";

  // When: different Naver and Google identities authenticate afterward.
  const naverUser = await registerSocialProvider("naver");
  const googleSession = await sessionBackend.googleSession(db, {
    credential: "ticketground-google-test-credential",
  });

  // Then: each provider resolves its own record and cannot observe Kakao's saved profile.
  assert.ok(naverUser);
  assert.equal(new Set(db.users.map((user) => user.id)).size, 3);
  assert.notEqual(naverUser.id, kakaoUser.id);
  assert.notEqual(googleSession.id, kakaoUser.id);
  assert.notEqual(naverUser.name, "카카오 저장 프로필");
  assert.notEqual(googleSession.name, "카카오 저장 프로필");
  assert.equal(kakaoUser.name, "카카오 저장 프로필");
});
