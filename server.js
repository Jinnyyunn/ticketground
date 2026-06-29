import crypto from "node:crypto";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import next from "next";
import { createTicketgroundApp } from "./backend/app.js";

const projectDir = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(projectDir, "public");
const adminDir = path.join(projectDir, "admin");
const seatMapDir = path.join(projectDir, "좌석 도면");
const dbPath = path.resolve(process.env.TIG_DB_PATH || path.join(projectDir, "data", "db.json"));
const port = Number(process.env.PORT || 4173);
const adminPort = Number(process.env.ADMIN_PORT || 50084);
const hostname = process.env.HOSTNAME || "0.0.0.0";
const adminHostname = process.env.ADMIN_HOSTNAME || "127.0.0.1";
const isDev = process.env.NODE_ENV !== "production";

function requiredSecret(name) {
  const value = process.env[name];
  if (value) return value;
  if (!isDev) throw new Error(`${name} is required in production.`);
  return crypto.randomBytes(32).toString("hex");
}

const adminToken = requiredSecret("TIG_ADMIN_TOKEN");
const app = await createTicketgroundApp({
  dbPath,
  runtime: {
    appAttestationSecret: process.env.TIG_APP_ATTESTATION_SECRET,
    nowOverride: process.env.TIG_NOW,
    secret: requiredSecret("TIG_SECRET")
  },
  http: {
    adminDir,
    fallbackPublic: "/index.html",
    jamsilOlympicSeatMapDir: path.join(seatMapDir, "잠실 올림픽 경기장"),
    MIME: {
      ".css": "text/css; charset=utf-8",
      ".html": "text/html; charset=utf-8",
      ".jpeg": "image/jpeg",
      ".jpg": "image/jpeg",
      ".js": "text/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".png": "image/png",
      ".svg": "image/svg+xml",
      ".webp": "image/webp"
    },
    projectDir,
    publicDir,
    seatMapDir
  }
});
const nextApp = next({ dev: isDev, hostname, port });
const handleNextRequest = nextApp.getRequestHandler();

function isAuthorizedAdmin(req) {
  const provided = req.headers["x-tig-admin-token"];
  if (typeof provided !== "string") return false;
  const expected = Buffer.from(adminToken);
  const actual = Buffer.from(provided);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function writeAdminUnauthorized(res) {
  const body = { ok: false, error: { code: "ADMIN_TOKEN_REQUIRED", message: "관리자 인증 토큰이 필요합니다." } };
  res.writeHead(401, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body, null, 2));
}

function servePublic(req, res) {
  const requestUrl = req.url || "/";
  if (requestUrl.startsWith("/api/")) {
    app.handleRequest(req, res, app.db, "public");
    return;
  }
  handleNextRequest(req, res).catch((error) => {
    console.error("Next request failed", error);
    if (!res.headersSent) res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Internal Server Error");
  });
}

function serveAdmin(req, res) {
  if (!isAuthorizedAdmin(req)) {
    writeAdminUnauthorized(res);
    return;
  }
  app.handleRequest(req, res, app.db, "admin");
}

await nextApp.prepare();

http.createServer(servePublic).listen(port, hostname, () => {
  console.log(`Ticketground public app running at http://${hostname}:${port}`);
});

http.createServer(serveAdmin).listen(adminPort, adminHostname, () => {
  console.log(`Ticketground admin API running at http://${adminHostname}:${adminPort}`);
});
