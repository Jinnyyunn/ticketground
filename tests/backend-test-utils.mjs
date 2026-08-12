import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import net from "node:net";
import assert from "node:assert/strict";

const repoRoot = new URL("../", import.meta.url);
const appAttestationSecret = "backend-test-app-attestation-secret";
const adminToken = "backend-test-admin-token";
const adminSessionSecret = "backend-test-admin-session-secret";
export const bootstrapAdminPassword = "ticketground-test-admin";

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
      TIG_ALLOW_LEGACY_APP_ATTESTATION: "1",
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
