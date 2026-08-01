import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { api, startServer } from "./backend-test-utils.mjs";
import { configureGoogleEnv, GOOGLE_AUTH_TEST_CREDENTIAL } from "./google-auth-test-helpers.mjs";

test("Google native login persists only a revocable credential hash", async (t) => {
  configureGoogleEnv(t, true);
  const dataDir = await mkdtemp(path.join(tmpdir(), "ticketground-google-native-"));
  const dbPath = path.join(dataDir, "db.json");
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  const server = await startServer(t, { dbPath });

  const login = await api(server.baseUrl, "/api/auth/google/native", {
    credential: GOOGLE_AUTH_TEST_CREDENTIAL
  });

  assert.equal(login.data.user.id, "google_user_test");
  assert.equal(typeof login.data.session.credential, "string");
  assert.ok(login.data.session.credential.length >= 43);
  assert.match(login.data.session.expiresAt, /^\d{4}-\d{2}-\d{2}T/);

  const persisted = JSON.parse(await readFile(dbPath, "utf8"));
  assert.equal(persisted.nativeSessions.length, 1);
  assert.equal(persisted.nativeSessions[0].userId, "google_user_test");
  assert.match(persisted.nativeSessions[0].credentialHash, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(persisted).includes(login.data.session.credential), false);

  const restored = await api(
    server.baseUrl,
    "/api/auth/native/session",
    undefined,
    200,
    { Authorization: `Bearer ${login.data.session.credential}` }
  );
  assert.equal(restored.data.user.id, "google_user_test");
  assert.equal(restored.data.user.balance, undefined);
  assert.equal(restored.data.user.sanctions, undefined);

  await api(
    server.baseUrl,
    "/api/auth/native/logout",
    {},
    200,
    { Authorization: `Bearer ${login.data.session.credential}` }
  );
  const revoked = await api(
    server.baseUrl,
    "/api/auth/native/session",
    undefined,
    401,
    { Authorization: `Bearer ${login.data.session.credential}` }
  );
  assert.equal(revoked.error.code, "NATIVE_SESSION_INVALID");
});

test("Google native login keeps configuration and credential failures distinct", async (t) => {
  configureGoogleEnv(t, false);
  const unconfigured = await startServer(t, {
    env: {
      TIG_GOOGLE_CLIENT_ID: "",
      NEXT_PUBLIC_GOOGLE_CLIENT_ID: ""
    }
  });

  const missingConfiguration = await api(unconfigured.baseUrl, "/api/auth/google/native", {
    credential: "not-a-google-token"
  }, 500);
  assert.equal(missingConfiguration.error.code, "GOOGLE_AUTH_NOT_CONFIGURED");
});

test("Google native session expires after its fixed lifetime", async (t) => {
  configureGoogleEnv(t, true);
  const dataDir = await mkdtemp(path.join(tmpdir(), "ticketground-google-native-expiry-"));
  const dbPath = path.join(dataDir, "db.json");
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  const issuedServer = await startServer(t, {
    dbPath,
    now: "2026-09-19T08:00:00.000Z"
  });
  const login = await api(issuedServer.baseUrl, "/api/auth/google/native", {
    credential: GOOGLE_AUTH_TEST_CREDENTIAL
  });
  await issuedServer.stop();

  const expiredServer = await startServer(t, {
    dbPath,
    now: "2026-10-20T08:00:00.000Z"
  });
  const expired = await api(
    expiredServer.baseUrl,
    "/api/auth/native/session",
    undefined,
    401,
    { Authorization: `Bearer ${login.data.session.credential}` }
  );
  assert.equal(expired.error.code, "NATIVE_SESSION_INVALID");
});
