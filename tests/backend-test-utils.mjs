import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import https from "node:https";
import net from "node:net";
import assert from "node:assert/strict";

const repoRoot = new URL("../", import.meta.url);
const appAttestationSecret = "backend-test-app-attestation-secret";
const adminToken = "backend-test-admin-token";
const adminSessionSecret = "backend-test-admin-session-secret";
const appAttestVerifierToken = "backend-test-app-attest-verifier-token";
export const bootstrapAdminPassword = "ticketground-test-admin";

const appAttestTestKey = `-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCwwrNXZfth82jo
F2XVUpD/tP53UBLIt172tgKD03iKOIVvLZIk1RNnsEwui4I35W7BOZPsQABsDfo1
8LDiP7gyKez8YYrCnSaMhjK00RomxOp90Q4v1tMsuYJZ143GzSDBqeuAvFMUN8C6
0cu7v1sTul3BJjvJhVgu+VUnaOBNd4dyzg/QEl0f/dMDhBoJA/3/RzojAuJqKVzS
VxSz7r7i4Lgr0jMGOJJmu/YVBXfCbX+hybDG1inEyAliarbDiIfnzH4d0oWR8aNC
IpINWMeoMeX7f8y9aJPel+CpRBjlKGE0u+f5lpN5wy3FS3GaS2WdcfTd+F6Rn/gB
sw6Olo2vAgMBAAECggEAAx6EdKvfikR12vaivOd2mJSUkv1uP22A9wCSPcpLC8Fg
lWwr8otyCrfhOEcM9riNQkqmUhp1B3Mdsbr8HBn8waHcxT1hafrE9eDeXzN7byi1
bJ/2TKDRXC4v3y7/GP2AsPozJjPskWREeed+3WLMlCYLRn/KuU0pl7adqpLetm84
d9vVbVbFbRcyVDHMAz3XKpCsJRv9zrtFq1gjC+bz8ur5l2p0wjZdy9n4dkLshJQN
iD27G2f+gkFsGlZk5GBOtvo8nJN7DKwYQidzGjOf8ZhmUFiheuJTsdOKhaVyQqXR
Mst5wzc/jwICSvjGC6xpa1Fdv8QrDDaCraMdYuM+tQKBgQD0NfRpWpexmpPVmlgS
5dQmEWtgYYedx3YdHlnLzBH8H4Jb1Hig456LIfF5n8BDYGt1QskWk2zQUXaEk3bP
32mdyRiv7LXZnIWFFmlYR8KxAHdk9/WlVN2QJInlF3/tQyMsRz/Pz38wikS+Y0yv
OpD3s8xvNgiXTRlJr/3Ja5LlEwKBgQC5SyvulU+OqiHYW4fYbCgdydAuzi3sCw15
V0iSDkScRoov+7KEmFYR2HzxD+nxiEmDuHu182qyRS4+W/VKOIZEs+h4A7aZHARt
XJj2HRU56bpNfmfFdFFVX7BFdhqFQwpxVV+jInO+FAC/hLvLdhhDsXghBQkqPaaw
8VpJc+Q0dQKBgCvmSxJpQ52coPij7zMud22Ech34Sk21nmjrnM7C13TQITnqvuiF
Imn2Zxcq/X/fJFIG+GkDhWsJSdnZPGFv0ueXT8XIMoR025eqCLPi6n+xCsVuwYy/
7bhMqTEygT+gcwExqansrfuGz4a+CPny+D5e5uATAYZZSLNzXJbJrLVbAoGAXeun
egh+yf6cpzFF+0JfVzILbx4dEs9LZh0C8N2Ak4IB226GP0WEIwmL0xjQ6Re+w6CI
PGMEyxXb6cns3FEoZbyXcfXX4WXdLJ3J/r4hGzjIsS0IZoKeE1ssWxkROkkQCwBO
OL9m0YsMEgeytN/ITs+u53XI/ns/eeLsc9zlaF0CgYAXOr908mRDYfdnNL7J5MuR
A5Sx73RLakehB5BrpdXAfAILImI9E6z8qZ/6yk4ctpJ18qn0YXjxW7J69xMXeyfb
dob85FdovV8D4FKpiGZmuAiSJe+ZJH/A0Vz8WGJc2hOLGMP45JzMYu34mscgoVAS
S4f0SH0FSJnNmNLXG+RfSA==
-----END PRIVATE KEY-----`;

const appAttestTestCertificate = `-----BEGIN CERTIFICATE-----
MIIDGjCCAgKgAwIBAgIUMklLgMQFpQkmyQbu+Eto6y+bp/8wDQYJKoZIhvcNAQEL
BQAwFDESMBAGA1UEAwwJMTI3LjAuMC4xMB4XDTI2MDgxMjE0NDIwMFoXDTM2MDgw
OTE0NDIwMFowFDESMBAGA1UEAwwJMTI3LjAuMC4xMIIBIjANBgkqhkiG9w0BAQEF
AAOCAQ8AMIIBCgKCAQEAsMKzV2X7YfNo6Bdl1VKQ/7T+d1ASyLde9rYCg9N4ijiF
by2SJNUTZ7BMLouCN+VuwTmT7EAAbA36NfCw4j+4Mins/GGKwp0mjIYytNEaJsTq
fdEOL9bTLLmCWdeNxs0gwanrgLxTFDfAutHLu79bE7pdwSY7yYVYLvlVJ2jgTXeH
cs4P0BJdH/3TA4QaCQP9/0c6IwLiailc0lcUs+6+4uC4K9IzBjiSZrv2FQV3wm1/
ocmwxtYpxMgJYmq2w4iH58x+HdKFkfGjQiKSDVjHqDHl+3/MvWiT3pfgqUQY5Shh
NLvn+ZaTecMtxUtxmktlnXH03fhekZ/4AbMOjpaNrwIDAQABo2QwYjAdBgNVHQ4E
FgQUeoyBBqVue+WDO+osI9Vc8353d8UwHwYDVR0jBBgwFoAUeoyBBqVue+WDO+os
I9Vc8353d8UwDwYDVR0TAQH/BAUwAwEB/zAPBgNVHREECDAGhwR/AAABMA0GCSqG
SIb3DQEBCwUAA4IBAQBVcS1r5AXc60kEot612//2ExsyfOQl7I48A8LFD2TGWYPs
n3uvHO0sT3Qp+9X80dPqp1nbqUEhyB6J5c+lTw84cmE3mvoiNS3OFcB7BFXoGXkq
7/hmhb9i1RWrWroOFaqtWpKQrKNZaMzIjrxtE5aepO2tXn4yEn/7Oe8w5+qdlnJo
mi76jWlhGQDXVOI6T4bydNyPVoGm2ErHOLYoFXd6krpOTkihc9x/xbb83/baeP4D
/5anSDkePMX3mQ7A//asljfnqw+VgMb5MhMaXCtnXzaMe/7VwniwVEi4R5ChQMcB
XpqRCs+FAM+OaVl7t4xKwXQGtrZDuuszToEH4zEi
-----END CERTIFICATE-----`;

export function appAttestation(purpose, ...parts) {
  return crypto
    .createHmac("sha256", appAttestationSecret)
    .update(["app", purpose, ...parts.map((part) => String(part || ""))].join(":"))
    .digest("hex");
}

async function freePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

export async function startAppAttestVerifier(t) {
  const server = https.createServer({ key: appAttestTestKey, cert: appAttestTestCertificate }, async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const authorized = req.method === "POST"
      && req.url === "/verify"
      && req.headers.authorization === `Bearer ${appAttestVerifierToken}`
      && body.appId === "kr.ticketground.app"
      && ["attestation", "assertion"].includes(body.kind)
      && typeof body.challenge === "string"
      && body.challenge.length > 0
      && body.keyId === "test-app-attest-key"
      && body.proof === "test-app-attest-proof";
    res.writeHead(authorized ? 200 : 403, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ verified: authorized }));
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  const address = server.address();
  return {
    TIG_APP_ATTEST_VERIFIER_TOKEN: appAttestVerifierToken,
    TIG_APP_ATTEST_VERIFIER_URL: `https://127.0.0.1:${address.port}/verify`,
    NODE_TLS_REJECT_UNAUTHORIZED: "0"
  };
}

export async function issueIosAppAttestProof(baseUrl, authorization, { purpose, deviceId, ticketId, kind }) {
  const challenge = await api(baseUrl, "/api/me/device-attestation/challenges", {
    platform: "ios",
    purpose,
    deviceId,
    ...(ticketId ? { ticketId } : {})
  }, 200, { Authorization: authorization });
  return {
    platform: "ios",
    challengeId: challenge.data.id,
    keyId: "test-app-attest-key",
    [kind === "attestation" ? "attestationObject" : "assertion"]: "test-app-attest-proof"
  };
}

export async function startServer(t, { now = "2026-09-19T17:00:00+09:00", env = {}, dbPath } = {}) {
  const tempDir = dbPath ? null : await mkdtemp(path.join(tmpdir(), "ticketground-backend-"));
  const resolvedDbPath = dbPath || path.join(tempDir, "db.json");
  const port = await freePort();
  const adminPort = await freePort();
  const child = spawn(process.execPath, ["server.js"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      TIG_NEXT_DEV: "0",
      PORT: String(port),
      ADMIN_PORT: String(adminPort),
      TIG_ADMIN_TOKEN: adminToken,
      TIG_ADMIN_SESSION_SECRET: adminSessionSecret,
      TIG_ADMIN_USERNAME: "admin",
      TIG_ADMIN_PASSWORD: bootstrapAdminPassword,
      TIG_DB_PATH: resolvedDbPath,
      TIG_NOW: now,
      TIG_APP_ATTESTATION_SECRET: appAttestationSecret,
      TIG_PORTONE_IDENTITY_TEST_MODE: "1",
      TIG_DEMO_PROFILE_API: "1",
      TIG_DEMO_SUPPORT_API: "1",
      TIG_DEMO_WATCHLIST_API: "1",
      TIG_SECRET: "backend-test-runtime-secret",
      ...env
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let stdout = "";
  let stderr = "";
  let exited = false;
  const exitPromise = new Promise((resolve) => {
    child.once("exit", resolve);
  });
  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  child.once("exit", () => {
    exited = true;
  });

  async function stop() {
    if (!exited) child.kill("SIGTERM");
    await exitPromise;
  }

  t.after(async () => {
    await stop();
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (exited) break;
    try {
      const response = await fetch(`${baseUrl}/api/state`);
      if (response.ok) {
        return {
          baseUrl,
          adminToken,
          adminUrl: `http://127.0.0.1:${adminPort}`,
          pid: child.pid,
          stderr,
          stop
        };
      }
    } catch {
      // wait until both HTTP servers bind
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`server did not start on ${port}/${adminPort}: stdout=${stdout} stderr=${stderr}`);
}

export async function api(baseUrl, pathName, body, expectedStatus = 200, headers = {}) {
  const response = await fetch(`${baseUrl}${pathName}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json", ...headers } : headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await response.json();
  assert.equal(response.status, expectedStatus, `${pathName} status ${response.status}: ${JSON.stringify(json)}`);
  return json;
}

export async function adminApi(server, pathName, body, expectedStatus = 200) {
  return api(server.adminUrl, pathName, body, expectedStatus, { "x-tig-admin-token": server.adminToken });
}

export async function issueGateToken(server, gateLabel = "GATE-A") {
  const issued = await adminApi(server, "/api/admin/gate-sessions", { gateLabel });
  return issued.data.token;
}

export async function verifyIdentity(baseUrl, userId = "user_fan_a", phone = "010-9000-0001") {
  const started = await api(baseUrl, "/api/identity/portone-danal/start", { userId, phone });
  const verified = await api(baseUrl, "/api/identity/portone-danal/confirm", {
    userId,
    phone,
    identityVerificationId: started.data.identityVerificationId
  });
  return verified.data;
}

export async function buyFirstTicket(baseUrl) {
  await verifyIdentity(baseUrl, "user_fan_a", "010-9000-0001");
  const state = await api(baseUrl, "/api/state");
  const ticket = state.data.tickets.find((item) => item.eventId === "event_kpop_001" && item.status === "ON_SALE");
  assert.ok(ticket, "seeded kpop ticket exists");
  const purchase = await api(baseUrl, "/api/tickets/buy", {
    userId: "user_fan_a",
    ticketId: ticket.id,
    paymentMethod: "CREDIT_CARD"
  });
  return { ticket: purchase.data.ticket, purchase: purchase.data };
}
