import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { api, startServer, verifyIdentity } from "./backend-test-utils.mjs";
import { configureGoogleEnv, GOOGLE_AUTH_TEST_CREDENTIAL } from "./google-auth-test-helpers.mjs";

async function nativeLogin(server) {
  const login = await api(server.baseUrl, "/api/auth/google/native", {
    credential: GOOGLE_AUTH_TEST_CREDENTIAL
  });
  return {
    authorization: `Bearer ${login.data.session.credential}`,
    user: login.data.user
  };
}

async function request(server, pathName, { authorization, body, method = "GET", status = 200 } = {}) {
  const response = await fetch(`${server.baseUrl}${pathName}`, {
    method,
    headers: {
      ...(authorization ? { Authorization: authorization } : {}),
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await response.json();
  assert.equal(response.status, status, `${method} ${pathName}: ${JSON.stringify(json)}`);
  return json;
}

test("native account routes derive the user exclusively from the bearer credential", async (t) => {
  configureGoogleEnv(t, true);
  const server = await startServer(t);
  const login = await nativeLogin(server);

  const me = await request(server, "/api/me?userId=user_fan_a", {
    authorization: login.authorization
  });
  assert.equal(me.data.id, login.user.id);
  assert.equal(me.data.balance, undefined);
  assert.equal(me.data.sanctions, undefined);

  const missing = await request(server, "/api/me", { status: 401 });
  assert.equal(missing.error.code, "NATIVE_SESSION_INVALID");

  await api(server.baseUrl, "/api/auth/native/logout", {}, 200, {
    Authorization: login.authorization
  });
  const revoked = await request(server, "/api/me", {
    authorization: login.authorization,
    status: 401
  });
  assert.equal(revoked.error.code, "NATIVE_SESSION_INVALID");
});

test("native profile update allows only the principal nickname and redacts it from the ledger", async (t) => {
  configureGoogleEnv(t, true);
  const dataDir = await mkdtemp(path.join(tmpdir(), "ticketground-native-account-"));
  const dbPath = path.join(dataDir, "db.json");
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  const server = await startServer(t, { dbPath });
  const login = await nativeLogin(server);

  const updated = await request(server, "/api/me/profile", {
    authorization: login.authorization,
    method: "PATCH",
    body: {
      name: "보안닉네임",
      userId: "user_fan_a",
      status: "SUSPENDED",
      trustScore: 0
    }
  });
  assert.equal(updated.data.id, login.user.id);
  assert.equal(updated.data.name, "보안닉네임");
  assert.equal(updated.data.status, "ACTIVE");
  assert.equal(updated.data.trustScore, 90);
  assert.equal(updated.data.profileConfirmed, true);

  const profile = await request(server, "/api/me/profile?userId=user_fan_a", {
    authorization: login.authorization
  });
  assert.deepEqual(profile.data, updated.data);

  const persisted = await readFile(dbPath, "utf8");
  assert.equal(persisted.includes("보안닉네임"), true);
  const database = JSON.parse(persisted);
  const ledger = database.ledger.findLast((entry) => entry.action === "DEMO_PROFILE_UPDATED");
  assert.ok(ledger);
  assert.equal(JSON.stringify(ledger).includes("보안닉네임"), false);
  assert.equal(JSON.stringify(ledger).includes(login.user.name), false);
});

test("native tickets return only tickets owned by the bearer principal", async (t) => {
  configureGoogleEnv(t, true);
  const server = await startServer(t);
  const login = await nativeLogin(server);

  await verifyIdentity(server.baseUrl, login.user.id, "010-9000-0002");
  const state = await api(server.baseUrl, "/api/state");
  const ticket = state.data.tickets.find((item) => item.status === "ON_SALE");
  assert.ok(ticket);
  await api(server.baseUrl, "/api/tickets/buy", {
    userId: login.user.id,
    ticketId: ticket.id,
    paymentMethod: "CREDIT_CARD"
  });

  const tickets = await request(server, "/api/me/tickets?userId=user_fan_a", {
    authorization: login.authorization
  });
  assert.equal(tickets.data.length, 1);
  assert.equal(tickets.data[0].id, ticket.id);
  assert.equal(tickets.data[0].ownerId, undefined);
  assert.equal(typeof tickets.data[0].event.title, "string");
  assert.equal(tickets.data[0].payment.method, "CREDIT_CARD");
  assert.equal(typeof tickets.data[0].payment.status, "string");
});
