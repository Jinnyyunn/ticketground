import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createIdentityBackend } from "../backend/identity.js";

function makeIdentityBackend() {
  return createIdentityBackend({
    appendLedger() {},
    findUser(database, userId) {
      const user = database.users.find((item) => item.id === userId);
      if (!user) throw new Error("missing user");
      return user;
    },
    hash(value) { return `hash:${value}`; },
    hmac(value) { return `hmac:${value}`; },
    httpError(status, code, message) { const error = new Error(message); error.status = status; error.code = code; return error; },
    id(prefix) { return `${prefix}-1`; },
    now() { return "2026-08-13T00:00:00.000Z"; }
  });
}

function encryptNiceResult({ ticket, transactionId, iterations, payload, integrityOverride }) {
  const rawMaterial = crypto.pbkdf2Sync(ticket, transactionId, iterations, 64, "sha256");
  const keyString = rawMaterial.toString("base64url");
  const aesKey = Buffer.from(keyString.slice(0, 32), "utf8");
  const hmacKey = Buffer.from(keyString.slice(48, 80), "utf8");
  const iv = Buffer.from("0123456789abcdef", "utf8");
  const cipher = crypto.createCipheriv("aes-256-gcm", aesKey, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const encData = Buffer.concat([iv, encrypted, cipher.getAuthTag()]).toString("base64url");
  const integrityValue = integrityOverride || crypto.createHmac("sha256", hmacKey).update(encData, "utf8").digest("base64url");
  return { encData, integrityValue };
}

test("NICE standard-window requests include the documented Node runtime header", async (t) => {
  const previousEnv = {
    clientId: process.env.TIG_NICE_CLIENT_ID,
    clientSecret: process.env.TIG_NICE_CLIENT_SECRET,
    callback: process.env.TIG_NICE_CALLBACK_RETURN_URL,
    product: process.env.TIG_NICE_PRODUCT_CODE_PHONE,
    testMode: process.env.TIG_NICE_IDENTITY_TEST_MODE,
    nodeEnv: process.env.NODE_ENV
  };
  process.env.TIG_NICE_CLIENT_ID = "test-client-id";
  process.env.TIG_NICE_CLIENT_SECRET = "test-client-secret";
  process.env.TIG_NICE_CALLBACK_RETURN_URL = "https://dev.ticketground.co.kr/api/identity/nice/callback";
  process.env.TIG_NICE_PRODUCT_CODE_PHONE = "CK622";
  process.env.TIG_NICE_IDENTITY_TEST_MODE = "0";
  process.env.NODE_ENV = "production";
  t.after(() => {
    for (const [key, value] of Object.entries({
      TIG_NICE_CLIENT_ID: previousEnv.clientId,
      TIG_NICE_CLIENT_SECRET: previousEnv.clientSecret,
      TIG_NICE_CALLBACK_RETURN_URL: previousEnv.callback,
      TIG_NICE_PRODUCT_CODE_PHONE: previousEnv.product,
      TIG_NICE_IDENTITY_TEST_MODE: previousEnv.testMode,
      NODE_ENV: previousEnv.nodeEnv
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  const originalFetch = globalThis.fetch;
  const requests = [];
  let providerErrorCode = "";
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (url, init) => {
    requests.push({ url: String(url), init });
    const payload = providerErrorCode
      ? { result_code: providerErrorCode, result_message: providerErrorCode === "1006" ? "ClientID 권한 없음" : "허용되지 않은 IP 접근" }
      : String(url).endsWith("/auth/token")
      ? { result_code: "0000", access_token: "access-token", ticket: "ticket", iterators: 1000 }
      : { result_code: "0000", transaction_id: "transaction-id", auth_url: "https://auth.niceid.co.kr/ido/cert/request/test" };
    return Response.json(payload, { status: 200 });
  };

  const db = { users: [{ id: "user-1", identityVerification: null }], identityVerifications: [] };
  const identity = makeIdentityBackend();

  const started = await identity.startNiceVerification(db, { userId: "user-1" });
  assert.equal(started.niceConfigured, true);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].init.headers["X-Intc-DevLang"], "Linux/Node.js");
  assert.equal(requests[0].init.headers.Authorization, `Basic ${Buffer.from("test-client-id:test-client-secret").toString("base64url")}`);
  const tokenBody = JSON.parse(requests[0].init.body);
  const authBody = JSON.parse(requests[1].init.body);
  assert.deepEqual(tokenBody, { grant_type: "client_credentials", request_no: db.identityVerifications[0].tokenRequestNo });
  assert.deepEqual(authBody.svc_types, ["M"]);
  assert.equal(new URL(authBody.return_url).pathname, "/api/identity/nice/callback");
  assert.equal(new URL(authBody.return_url).searchParams.get("rid"), "idv-1");
  assert.notEqual(tokenBody.request_no, authBody.request_no);

  providerErrorCode = "1006";
  await assert.rejects(
    identity.startNiceVerification(db, { userId: "user-1" }),
    (error) => error.code === "NICE_CLIENT_PERMISSION" && error.status === 503 && error.detail.providerCode === "1006"
  );

  providerErrorCode = "1007";
  await assert.rejects(
    identity.startNiceVerification(db, { userId: "user-1" }),
    (error) => error.code === "NICE_OUTBOUND_IP_DENIED" && error.status === 503 && error.detail.providerCode === "1007"
  );
});

test("NICE callback decrypts the documented Base64URL KDF result and verifies integrity_value", async (t) => {
  const previousEnv = {
    clientId: process.env.TIG_NICE_CLIENT_ID,
    clientSecret: process.env.TIG_NICE_CLIENT_SECRET,
    callback: process.env.TIG_NICE_CALLBACK_RETURN_URL,
    testMode: process.env.TIG_NICE_IDENTITY_TEST_MODE,
    nodeEnv: process.env.NODE_ENV
  };
  process.env.TIG_NICE_CLIENT_ID = "test-client-id";
  process.env.TIG_NICE_CLIENT_SECRET = "test-client-secret";
  process.env.TIG_NICE_CALLBACK_RETURN_URL = "https://dev.ticketground.co.kr/api/identity/nice/callback";
  process.env.TIG_NICE_IDENTITY_TEST_MODE = "0";
  process.env.NODE_ENV = "production";
  t.after(() => {
    for (const [key, value] of Object.entries({
      TIG_NICE_CLIENT_ID: previousEnv.clientId,
      TIG_NICE_CLIENT_SECRET: previousEnv.clientSecret,
      TIG_NICE_CALLBACK_RETURN_URL: previousEnv.callback,
      TIG_NICE_IDENTITY_TEST_MODE: previousEnv.testMode,
      NODE_ENV: previousEnv.nodeEnv
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  const originalFetch = globalThis.fetch;
  const db = { users: [{ id: "user-1", identityVerification: null }], identityVerifications: [] };
  const identity = makeIdentityBackend();
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    if (String(url).endsWith("/auth/token")) {
      return Response.json({ result_code: "0000", access_token: "access-token", ticket: "ticket", iterators: 1000 });
    }
    if (String(url).endsWith("/auth/url")) {
      return Response.json({ result_code: "0000", transaction_id: "transaction-id", auth_url: "https://auth.niceid.co.kr/ido/cert/request/test" });
    }
    assert.equal(body.web_transaction_id, "web-transaction-id");
    const record = db.identityVerifications[0];
    const encrypted = encryptNiceResult({
      ticket: record.ticket,
      transactionId: record.transactionId,
      iterations: record.iterators,
      payload: { mobile_no: "01012345678", ci: "ci-value" }
    });
    return Response.json({ result_code: "0000", enc_data: encrypted.encData, integrity_value: encrypted.integrityValue });
  };

  await identity.startNiceVerification(db, { userId: "user-1" });
  const result = await identity.completeNiceVerificationFromCallback(db, {
    identityVerificationId: "idv-1",
    webTransactionId: "web-transaction-id"
  });
  assert.equal(result.verified, true);
  assert.equal(result.phoneMasked, "010-****-5678");
});

test("NICE callback rejects a result whose integrity_value does not match enc_data", async (t) => {
  const previousEnv = {
    clientId: process.env.TIG_NICE_CLIENT_ID,
    clientSecret: process.env.TIG_NICE_CLIENT_SECRET,
    callback: process.env.TIG_NICE_CALLBACK_RETURN_URL,
    testMode: process.env.TIG_NICE_IDENTITY_TEST_MODE,
    nodeEnv: process.env.NODE_ENV
  };
  process.env.TIG_NICE_CLIENT_ID = "test-client-id";
  process.env.TIG_NICE_CLIENT_SECRET = "test-client-secret";
  process.env.TIG_NICE_CALLBACK_RETURN_URL = "https://dev.ticketground.co.kr/api/identity/nice/callback";
  process.env.TIG_NICE_IDENTITY_TEST_MODE = "0";
  process.env.NODE_ENV = "production";
  t.after(() => {
    for (const [key, value] of Object.entries({
      TIG_NICE_CLIENT_ID: previousEnv.clientId,
      TIG_NICE_CLIENT_SECRET: previousEnv.clientSecret,
      TIG_NICE_CALLBACK_RETURN_URL: previousEnv.callback,
      TIG_NICE_IDENTITY_TEST_MODE: previousEnv.testMode,
      NODE_ENV: previousEnv.nodeEnv
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  const originalFetch = globalThis.fetch;
  const db = { users: [{ id: "user-1", identityVerification: null }], identityVerifications: [] };
  const identity = makeIdentityBackend();
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (url) => {
    if (String(url).endsWith("/auth/token")) return Response.json({ result_code: "0000", access_token: "access-token", ticket: "ticket", iterators: 1000 });
    if (String(url).endsWith("/auth/url")) return Response.json({ result_code: "0000", transaction_id: "transaction-id", auth_url: "https://auth.niceid.co.kr/ido/cert/request/test" });
    const record = db.identityVerifications[0];
    const encrypted = encryptNiceResult({
      ticket: record.ticket,
      transactionId: record.transactionId,
      iterations: record.iterators,
      payload: { mobile_no: "01012345678", ci: "ci-value" },
      integrityOverride: "tampered-integrity"
    });
    return Response.json({ result_code: "0000", enc_data: encrypted.encData, integrity_value: encrypted.integrityValue });
  };

  await identity.startNiceVerification(db, { userId: "user-1" });
  await assert.rejects(
    identity.completeNiceVerificationFromCallback(db, { identityVerificationId: "idv-1", webTransactionId: "web-transaction-id" }),
    (error) => error.code === "NICE_INTEGRITY_INVALID"
  );
});
