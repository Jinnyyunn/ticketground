import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import net from "node:net";
import assert from "node:assert/strict";

const repoRoot = new URL("../", import.meta.url);
const appAttestationSecret = "backend-test-app-attestation-secret";

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

export async function startServer(t, { now = "2026-09-19T17:00:00+09:00" } = {}) {
  const tempDir = await mkdtemp(path.join(tmpdir(), "ticketground-backend-"));
  const port = await freePort();
  const adminPort = await freePort();
  const child = spawn(process.execPath, ["server.js"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PORT: String(port),
      ADMIN_PORT: String(adminPort),
      TIG_DB_PATH: path.join(tempDir, "db.json"),
      TIG_NOW: now,
      TIG_APP_ATTESTATION_SECRET: appAttestationSecret
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let stdout = "";
  let stderr = "";
  let exited = false;
  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  child.once("exit", () => {
    exited = true;
  });

  t.after(async () => {
    if (!exited) {
      child.kill("SIGTERM");
      await new Promise((resolve) => child.once("exit", resolve));
    }
    await rm(tempDir, { recursive: true, force: true });
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (exited) break;
    try {
      const response = await fetch(`${baseUrl}/api/state`);
      if (response.ok) return { baseUrl, adminUrl: `http://127.0.0.1:${adminPort}`, stderr };
    } catch {
      // wait until both HTTP servers bind
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`server did not start on ${port}/${adminPort}: stdout=${stdout} stderr=${stderr}`);
}

export async function api(baseUrl, pathName, body, expectedStatus = 200) {
  const response = await fetch(`${baseUrl}${pathName}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await response.json();
  assert.equal(response.status, expectedStatus, `${pathName} status ${response.status}: ${JSON.stringify(json)}`);
  return json;
}

export async function buyFirstTicket(baseUrl) {
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
