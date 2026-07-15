import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import next from "next";
import { adminDto, permissionCatalog, roleCatalog } from "./backend/admin-acl.js";
import { createTicketgroundApp } from "./backend/app.js";

const projectDir = path.dirname(fileURLToPath(import.meta.url));
const { loadEnvConfig } = nextEnv;
const nextDevOverride = process.env.TIG_NEXT_DEV;
const isDev = nextDevOverride === undefined ? process.env.NODE_ENV !== "production" : nextDevOverride === "1";
loadEnvConfig(projectDir, isDev);
if (process.env.TIG_SOCIAL_AUTH_TEST_MODE === "1" && process.env.NODE_ENV !== "production") {
  process.env.TIG_SOCIAL_AUTH_TEST_MODE_ACTIVE = "1";
} else {
  delete process.env.TIG_SOCIAL_AUTH_TEST_MODE_ACTIVE;
}
const publicDir = path.join(projectDir, "public");
const adminDir = path.join(projectDir, "admin");
const adminUploadDir = path.join(publicDir, "uploads", "admin");
const seatMapDir = path.join(projectDir, "좌석 도면");
const dbPath = path.resolve(process.env.TIG_DB_PATH || path.join(projectDir, "data", "db.json"));
const port = Number(process.env.PORT || 4173);
const adminPort = Number(process.env.ADMIN_PORT || 50084);
const hostname = process.env.HOSTNAME || "0.0.0.0";
const adminHostname = process.env.ADMIN_HOSTNAME || "127.0.0.1";

function requiredSecret(name) {
  const value = process.env[name];
  if (value) return value;
  if (!isDev) throw new Error(`${name} is required in production.`);
  return crypto.randomBytes(32).toString("hex");
}

const adminToken = requiredSecret("TIG_ADMIN_TOKEN");
const adminSessionSecret = requiredSecret("TIG_ADMIN_SESSION_SECRET");
const adminUsername = process.env.TIG_ADMIN_USERNAME || (isDev ? "admin" : "");
const adminPassword = process.env.TIG_ADMIN_PASSWORD || (isDev ? "admin" : "");
if (!isDev && (!process.env.TIG_ADMIN_USERNAME || !process.env.TIG_ADMIN_PASSWORD)) {
  throw new Error("TIG_ADMIN_USERNAME and TIG_ADMIN_PASSWORD are required in production.");
}
if (!isDev && adminPassword.length < 12) {
  throw new Error("TIG_ADMIN_PASSWORD must be at least 12 characters in production.");
}

const app = await createTicketgroundApp({
  dbPath,
  mediaDir: { directory: adminUploadDir, urlPrefix: "/uploads/admin" },
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
const publicServer = http.createServer((req, res) => { void servePublic(req, res); });
const adminServer = http.createServer(serveAdmin);
const nextApp = next({ dev: isDev, hostname: adminHostname, port: adminPort, httpServer: adminServer });
const handleNextRequest = nextApp.getRequestHandler();
const adminSessions = new Map();
const adminSessionCookieName = "tig_admin_session";
const adminSessionTtlMs = 1000 * 60 * 60 * 8;
const adminLoginRateLimitWindowMs = 1000 * 60 * 5;
const adminLoginRateLimitMaxAttempts = 10;
const adminLoginAttempts = new Map();
const defaultAdminRoles = (process.env.TIG_ADMIN_ROLES || "owner")
  .split(",")
  .map((role) => role.trim())
  .filter(Boolean);
const defaultAdminIpAllowlist = String(process.env.TIG_ADMIN_IP_ALLOWLIST || "").split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
const trustAdminProxy = process.env.TIG_TRUST_PROXY === "1";
const trustedProxyIps = String(process.env.TIG_TRUSTED_PROXY_IPS || "").split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
const adminLoginRateLimitCleanup = setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of adminLoginAttempts) {
    if (entry.windowExpiresAt <= now) adminLoginAttempts.delete(ip);
  }
}, adminLoginRateLimitWindowMs);
adminLoginRateLimitCleanup.unref?.();

const sessionRoutePermissions = [
  { method: "POST", pattern: /^\/api\/admin\/logout$/, permission: "admin.dashboard.read" },
  { method: "GET", pattern: /^\/api\/admin\/summary$/, permission: "admin.dashboard.read" },
  { method: "GET", pattern: /^\/api\/admin\/venues$/, permission: "catalog.manage" },
  { method: "GET", pattern: /^\/api\/admin\/workspaces\/overview$/, permission: "admin.dashboard.read" },
  { method: "GET", pattern: /^\/api\/admin\/workspaces\/(catalog|sales|inventory)$/, permission: "catalog.manage" },
  { method: "GET", pattern: /^\/api\/admin\/workspaces\/accounts$/, permission: "accounts.manage" },
  { method: "GET", pattern: /^\/api\/admin\/workspaces\/support$/, permission: "support.manage" },
  { method: "GET", pattern: /^\/api\/admin\/workspaces\/resale$/, permission: "finance.read" },
  { method: "GET", pattern: /^\/api\/admin\/workspaces\/admission$/, permission: "admission.manage" },
  { method: "GET", pattern: /^\/api\/admin\/workspaces\/audit$/, permission: "security.manage" },
  { method: "GET", pattern: /^\/api\/admin\/workspaces\/acl$/, permission: "acl.read" },
  { method: "POST", pattern: /^\/api\/admin\/events\//, permission: "catalog.manage" },
  { method: "POST", pattern: /^\/api\/admin\/admin-accounts(?:\/update)?$/, permission: "acl.manage" },
  { method: "POST", pattern: /^\/api\/admin\/users\/status/, permission: "accounts.manage" },
  { method: "POST", pattern: /^\/api\/admin\/tickets\/status$/, permission: "catalog.manage" },
  { method: "POST", pattern: /^\/api\/admin\/support\//, permission: "support.manage" },
  { method: "GET", pattern: /^\/api\/ledger/, permission: "security.manage" }
];

function isAuthorizedAdmin(req) {
  const provided = req.headers["x-tig-admin-token"];
  if (typeof provided !== "string") return false;
  const expected = Buffer.from(adminToken);
  const actual = Buffer.from(provided);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected) && app.admin.isAdminIpAllowed(requestIp(req), defaultAdminIpAllowlist);
}

function timingSafeStringEqual(actual, expected) {
  const actualHash = crypto.createHash("sha256").update(String(actual)).digest();
  const expectedHash = crypto.createHash("sha256").update(String(expected)).digest();
  return crypto.timingSafeEqual(actualHash, expectedHash);
}

function requestIp(req) {
  const peerAddress = req.socket.remoteAddress || "";
  const forwarded = trustAdminProxy && trustedProxyIps.length && app.admin.isAdminIpAllowed(peerAddress, trustedProxyIps)
    ? String(req.headers["x-forwarded-for"] || "").split(",")[0].trim()
    : "";
  const address = forwarded || peerAddress;
  return address.startsWith("::ffff:") ? address.slice(7) : address;
}

function recordAdminLoginAttempt(ip) {
  const now = Date.now();
  const existing = adminLoginAttempts.get(ip);
  if (!existing || existing.windowExpiresAt <= now) {
    const entry = { count: 1, windowExpiresAt: now + adminLoginRateLimitWindowMs };
    adminLoginAttempts.set(ip, entry);
    return { limited: false, retryAfterSeconds: Math.ceil((entry.windowExpiresAt - now) / 1000) };
  }
  existing.count += 1;
  return {
    limited: existing.count > adminLoginRateLimitMaxAttempts,
    retryAfterSeconds: Math.ceil((existing.windowExpiresAt - now) / 1000)
  };
}

function signedSessionValue(sessionId) {
  const signature = crypto.createHmac("sha256", adminSessionSecret).update(sessionId).digest("hex");
  return `${sessionId}.${signature}`;
}

function parseCookies(req) {
  const header = req.headers.cookie;
  if (!header) return {};
  try {
    return Object.fromEntries(header.split(";").map((part) => {
      const [name, ...value] = part.trim().split("=");
      return [decodeURIComponent(name), decodeURIComponent(value.join("="))];
    }));
  } catch {
    return {};
  }
}

async function parseJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 64 * 1024) return null;
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return null;
  }
}

function sessionCookie(value, maxAgeSeconds = Math.floor(adminSessionTtlMs / 1000)) {
  return [
    `${adminSessionCookieName}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
    ...(isDev ? [] : ["Secure"])
  ].join("; ");
}

function activeAdminSession(req) {
  const cookieValue = parseCookies(req)[adminSessionCookieName];
  if (!cookieValue) return null;
  const [sessionId, providedSignature] = cookieValue.split(".");
  if (!sessionId || !providedSignature) return null;
  const expectedSignature = signedSessionValue(sessionId).split(".")[1];
  if (!timingSafeStringEqual(providedSignature, expectedSignature)) return null;
  const session = adminSessions.get(sessionId);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    adminSessions.delete(sessionId);
    return null;
  }
  const currentAccount = session.admin.bootstrap ? session.admin : app.admin.activeAdminAccount(app.db, session.admin.id);
  if (!currentAccount) return null;
  return {
    ...session,
    admin: currentAccount,
    ipAllowed: app.admin.isAdminIpAllowed(requestIp(req), currentAccount.ipAllowlist),
    sessionId
  };
}

function writeJson(res, status, body, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...headers });
  res.end(JSON.stringify(body, null, 2));
}

function sessionDto(session) {
  return {
    admin: adminDto(session.admin),
    csrf: session.csrf,
    expiresAt: new Date(session.expiresAt).toISOString(),
    roles: roleCatalog,
    permissionCatalog
  };
}

function writeAdminUnauthorized(res) {
  const body = { ok: false, error: { code: "ADMIN_TOKEN_REQUIRED", message: "관리자 인증 토큰이 필요합니다." } };
  writeJson(res, 401, body);
}

function writeNotFound(res) {
  writeJson(res, 404, { ok: false, error: { code: "NOT_FOUND", message: "요청한 페이지가 없습니다." } });
}

function permissionForAdminRequest(method, pathname) {
  return sessionRoutePermissions.find((route) => route.method === method && route.pattern.test(pathname))?.permission || null;
}

function requireSessionAdmin(req, res, pathname) {
  const session = activeAdminSession(req);
  if (!session) {
    writeAdminUnauthorized(res);
    return null;
  }
  if (!session.ipAllowed) {
    writeJson(res, 403, { ok: false, error: { code: "ADMIN_IP_DENIED", message: "현재 IP는 이 관리자 계정의 접근 허용 목록에 없습니다." } });
    return null;
  }
  if (req.method !== "GET") {
    const csrf = req.headers["x-tig-csrf"];
    if (csrf !== session.csrf) {
      writeJson(res, 403, { ok: false, error: { code: "CSRF_REQUIRED", message: "관리자 변경 요청에는 CSRF 토큰이 필요합니다." } });
      return null;
    }
  }
  const permission = permissionForAdminRequest(req.method, pathname);
  if (!permission) {
    writeJson(res, 403, { ok: false, error: { code: "ADMIN_ROUTE_DENIED", message: "관리자 라우트 권한 매핑이 필요합니다." } });
    return null;
  }
  const admin = adminDto(session.admin);
  if (!admin.permissions.includes(permission)) {
    writeJson(res, 403, { ok: false, error: { code: "ADMIN_PERMISSION_DENIED", message: "관리자 권한이 부족합니다.", detail: { permission } } });
    return null;
  }
  return session;
}

async function handleAdminSessionRoute(req, res, pathname) {
  if (req.method === "GET" && pathname === "/api/admin/session") {
    const session = activeAdminSession(req);
    if (!session) {
      writeJson(res, 401, { ok: false, error: { code: "ADMIN_SESSION_REQUIRED", message: "관리자 로그인이 필요합니다." } });
      return true;
    }
    if (!session.ipAllowed) {
      writeJson(res, 403, { ok: false, error: { code: "ADMIN_IP_DENIED", message: "현재 IP는 이 관리자 계정의 접근 허용 목록에 없습니다." } });
      return true;
    }
    writeJson(res, 200, { ok: true, data: sessionDto(session) });
    return true;
  }
  if (req.method === "POST" && pathname === "/api/admin/login") {
    const loginAttempt = recordAdminLoginAttempt(requestIp(req));
    if (loginAttempt.limited) {
      writeJson(res, 429, {
        ok: false,
        error: {
          code: "RATE_LIMITED",
          message: "관리자 로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요."
        }
      }, { "Retry-After": String(loginAttempt.retryAfterSeconds) });
      return true;
    }
    const body = await parseJsonBody(req);
    if (!body || typeof body.username !== "string" || typeof body.password !== "string") {
      writeJson(res, 400, { ok: false, error: { code: "BAD_LOGIN_BODY", message: "아이디와 비밀번호를 확인해주세요." } });
      return true;
    }
    const admin = app.admin.authenticateAdminAccount(app.db, body.username, body.password, {
      username: adminUsername,
      password: adminPassword,
      roleKeys: defaultAdminRoles,
      ipAllowlist: defaultAdminIpAllowlist
    });
    if (!admin) {
      writeJson(res, 401, { ok: false, error: { code: "ADMIN_LOGIN_FAILED", message: "관리자 인증에 실패했습니다." } });
      return true;
    }
    if (!app.admin.isAdminIpAllowed(requestIp(req), admin.ipAllowlist)) {
      writeJson(res, 403, { ok: false, error: { code: "ADMIN_IP_DENIED", message: "현재 IP는 이 관리자 계정의 접근 허용 목록에 없습니다." } });
      return true;
    }
    const sessionId = crypto.randomBytes(32).toString("hex");
    const session = {
      admin,
      csrf: crypto.randomBytes(24).toString("hex"),
      expiresAt: Date.now() + adminSessionTtlMs
    };
    adminSessions.set(sessionId, session);
    writeJson(res, 200, { ok: true, data: sessionDto(session) }, { "Set-Cookie": sessionCookie(signedSessionValue(sessionId)) });
    return true;
  }
  if (req.method === "POST" && pathname === "/api/admin/logout") {
    const session = requireSessionAdmin(req, res, pathname);
    if (!session) return true;
    adminSessions.delete(session.sessionId);
    writeJson(res, 200, { ok: true, data: { loggedOut: true } }, { "Set-Cookie": sessionCookie("", 0) });
    return true;
  }
  return false;
}

async function serveAdminUpload(res, pathname) {
  const prefix = "/uploads/admin/";
  if (!pathname.startsWith(prefix)) return false;
  let fileName;
  try {
    fileName = decodeURIComponent(pathname.slice(prefix.length));
  } catch {
    writeNotFound(res);
    return true;
  }
  if (!fileName || fileName !== path.basename(fileName)) {
    writeNotFound(res);
    return true;
  }
  try {
    const body = await readFile(path.join(adminUploadDir, fileName));
    const extension = path.extname(fileName).toLowerCase();
    const contentType = extension === ".png" ? "image/png" : extension === ".webp" ? "image/webp" : "image/jpeg";
    res.writeHead(200, { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000, immutable" });
    res.end(body);
  } catch {
    writeNotFound(res);
  }
  return true;
}

async function servePublic(req, res) {
  const requestUrl = req.url || "/";
  const { pathname } = new URL(requestUrl, `http://${req.headers.host}`);
  if (await serveAdminUpload(res, pathname)) return;
  if (pathname === "/console" || pathname.startsWith("/console/")) {
    writeNotFound(res);
    return;
  }
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
  const requestUrl = req.url || "/";
  const url = new URL(requestUrl, `http://${req.headers.host}`);
  if (url.pathname === "/") {
    res.writeHead(302, { Location: "/console" });
    res.end();
    return;
  }
  if (url.pathname === "/console" || url.pathname.startsWith("/console/")) {
    handleNextRequest(req, res).catch((error) => {
      console.error("Next admin console request failed", error);
      if (!res.headersSent) res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Internal Server Error");
    });
    return;
  }
  if (url.pathname.startsWith("/_next/") || url.pathname === "/favicon.ico" || url.pathname.startsWith("/seo/")) {
    handleNextRequest(req, res).catch((error) => {
      console.error("Next admin asset request failed", error);
      if (!res.headersSent) res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Internal Server Error");
    });
    return;
  }
  if (url.pathname === "/api/admin/login" || url.pathname === "/api/admin/logout" || url.pathname === "/api/admin/session") {
    handleAdminSessionRoute(req, res, url.pathname).catch((error) => {
      console.error("Admin session route failed", error);
      if (!res.headersSent) writeJson(res, 500, { ok: false, error: { code: "INTERNAL_ERROR", message: "관리자 세션 처리 중 오류가 발생했습니다." } });
    });
    return;
  }
  const tokenAuthorized = isAuthorizedAdmin(req);
  const session = tokenAuthorized ? null : requireSessionAdmin(req, res, url.pathname);
  if (!tokenAuthorized && !session) return;
  const bootstrapAdmin = {
    id: "bootstrap-admin",
    username: adminUsername,
    roleKeys: defaultAdminRoles,
    ipAllowlist: defaultAdminIpAllowlist,
    active: true,
    bootstrap: true
  };
  req.admin = tokenAuthorized
    ? { id: "token-admin", username: "token-admin", roleKeys: defaultAdminRoles, ipAllowlist: defaultAdminIpAllowlist, active: true, bootstrapAdmin }
    : { ...session.admin, bootstrapAdmin };
  if (!tokenAuthorized && url.pathname === "/api/admin/summary") {
    writeJson(res, 200, { ok: true, data: app.admin.adminWorkspace(app.db, "overview") });
    return;
  }
  app.handleRequest(req, res, app.db, "admin");
}

await nextApp.prepare();

if (isDev) {
  publicServer.on("upgrade", (req, socket, head) => {
    nextApp.upgradeHandler(req, socket, head);
  });
}

publicServer.listen(port, hostname, () => {
  console.log(`Ticketground public app running at http://${hostname}:${port}`);
});

adminServer.listen(adminPort, adminHostname, () => {
  console.log(`Ticketground admin API running at http://${adminHostname}:${adminPort}`);
});
