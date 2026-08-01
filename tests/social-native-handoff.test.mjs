import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { api, startServer } from "./backend-test-utils.mjs";
import {
  configureSocialEnv,
  cookieHeaderFromSetCookie,
  PROVIDERS,
  redirected,
} from "./social-auth-test-helpers.mjs";

async function startIosLogin(baseUrl, provider) {
  const response = await fetch(`${baseUrl}/api/auth/${provider}/start?client=ios`, {
    redirect: "manual",
  });
  const authorizeUrl = new URL(await redirected(response));
  return {
    cookie: cookieHeaderFromSetCookie(response.headers.get("set-cookie")),
    state: authorizeUrl.searchParams.get("state"),
  };
}

async function completeIosLogin(baseUrl, provider) {
  const { cookie, state } = await startIosLogin(baseUrl, provider);
  assert.ok(state, `${provider} state is present`);
  const response = await fetch(
    `${baseUrl}/api/auth/${provider}/callback?code=${PROVIDERS[provider].code}&state=${encodeURIComponent(state)}`,
    { headers: { cookie }, redirect: "manual" },
  );
  assert.ok(
    response.headers.get("set-cookie")?.includes(`tig_oauth_state_${provider}=;`),
    `${provider} state cookie is cleared`,
  );
  const callbackUrl = new URL(await redirected(response));
  assert.equal(callbackUrl.protocol, "ticketground:");
  assert.equal(callbackUrl.host, "auth");
  assert.equal(callbackUrl.pathname, "/social/callback");
  assert.equal(callbackUrl.searchParams.get("provider"), provider);
  const code = callbackUrl.searchParams.get("code");
  assert.ok(code, `${provider} handoff code is present`);
  return code;
}

test("iOS social callback persists only a provider-bound handoff hash", async (t) => {
  // Given: a configured Kakao OAuth flow started explicitly for iOS.
  configureSocialEnv(t, true);
  const dataDir = await mkdtemp(path.join(tmpdir(), "ticketground-social-handoff-"));
  const dbPath = path.join(dataDir, "db.json");
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  const server = await startServer(t, { dbPath });

  // When: the state-verified provider callback completes.
  const code = await completeIosLogin(server.baseUrl, "kakao");

  // Then: persistence contains only the code hash and its provider binding.
  const persisted = JSON.parse(await readFile(dbPath, "utf8"));
  assert.equal(persisted.nativeAuthHandoffs.length, 1);
  assert.equal(persisted.nativeAuthHandoffs[0].provider, "kakao");
  assert.match(persisted.nativeAuthHandoffs[0].codeHash, /^[a-f0-9]{64}$/);
  assert.equal(persisted.nativeAuthHandoffs[0].consumedAt, null);
  assert.equal(JSON.stringify(persisted).includes(code), false);
});

test("native handoff is provider-bound and can be consumed only once", async (t) => {
  // Given: one valid Naver iOS handoff code.
  configureSocialEnv(t, true);
  const server = await startServer(t);
  const code = await completeIosLogin(server.baseUrl, "naver");

  // When: a different provider attempts to exchange the code.
  const wrongProvider = await api(server.baseUrl, "/api/auth/native/handoff", {
    provider: "kakao",
    code,
  }, 401);

  // Then: the provider mismatch is rejected without consuming the code.
  assert.equal(wrongProvider.error.code, "NATIVE_HANDOFF_INVALID");

  // When: the bound provider exchanges the same code.
  const exchanged = await api(server.baseUrl, "/api/auth/native/handoff", {
    provider: "naver",
    code,
  });

  // Then: it receives the existing revocable native-session response contract.
  assert.equal(exchanged.data.user.name, PROVIDERS.naver.userName);
  assert.equal(typeof exchanged.data.session.credential, "string");
  assert.match(exchanged.data.session.expiresAt, /^\d{4}-\d{2}-\d{2}T/);

  // When: the code is exchanged again.
  const reused = await api(server.baseUrl, "/api/auth/native/handoff", {
    provider: "naver",
    code,
  }, 401);

  // Then: the consumed code is rejected deterministically.
  assert.equal(reused.error.code, "NATIVE_HANDOFF_INVALID");
});

test("native handoff expires after five minutes", async (t) => {
  // Given: an iOS handoff issued at a controlled time.
  configureSocialEnv(t, true);
  const dataDir = await mkdtemp(path.join(tmpdir(), "ticketground-social-handoff-expiry-"));
  const dbPath = path.join(dataDir, "db.json");
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  const issuedServer = await startServer(t, {
    dbPath,
    now: "2026-08-01T00:00:00.000Z",
  });
  const code = await completeIosLogin(issuedServer.baseUrl, "kakao");
  await issuedServer.stop();

  // When: the code is exchanged after its five-minute lifetime.
  const expiredServer = await startServer(t, {
    dbPath,
    now: "2026-08-01T00:05:00.001Z",
  });
  const expired = await api(expiredServer.baseUrl, "/api/auth/native/handoff", {
    provider: "kakao",
    code,
  }, 401);

  // Then: no native session is issued.
  assert.equal(expired.error.code, "NATIVE_HANDOFF_INVALID");
  const persisted = JSON.parse(await readFile(dbPath, "utf8"));
  assert.equal(persisted.nativeSessions.length, 0);
});

test("iOS state mismatch issues no user or handoff", async (t) => {
  // Given: a configured Naver OAuth flow started for iOS.
  configureSocialEnv(t, true);
  const dataDir = await mkdtemp(path.join(tmpdir(), "ticketground-social-handoff-state-"));
  const dbPath = path.join(dataDir, "db.json");
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  const server = await startServer(t, { dbPath });
  const { cookie } = await startIosLogin(server.baseUrl, "naver");

  // When: the callback state does not match its signed cookie.
  const response = await fetch(
    `${server.baseUrl}/api/auth/naver/callback?code=${PROVIDERS.naver.code}&state=wrong-state`,
    { headers: { cookie }, redirect: "manual" },
  );

  // Then: the browser returns to the safe web error and nothing is issued.
  const location = new URL(await redirected(response), server.baseUrl);
  assert.equal(location.pathname, "/login");
  assert.equal(location.searchParams.get("socialError"), "naver_state_invalid");
  const persisted = JSON.parse(await readFile(dbPath, "utf8"));
  assert.equal(persisted.nativeAuthHandoffs.length, 0);
  assert.equal(persisted.users.some((user) => user.name === PROVIDERS.naver.userName), false);
  assert.equal(persisted.nativeSessions.length, 0);
});
