import { readFile } from "node:fs/promises";
import path from "node:path";

export function createHttpHandler({
  adminDir,
  fallbackAdmin,
  fallbackPublic,
  handleApi,
  httpError,
  jamsilOlympicSeatMapDir,
  MIME,
  projectDir,
  publicDir,
  saveDb,
  seatMapDir
}) {
async function serveStatic(req, res, rootDir, fallback = "/index.html") {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requested = url.pathname === "/" ? fallback : decodeURIComponent(url.pathname);
  if (requested === "/favicon.ico") {
    res.writeHead(204);
    res.end();
    return;
  }
  const dcStatic = rootDir === publicDir ? {
    "/좌석선택.dc.html": path.join(jamsilOlympicSeatMapDir, "좌석선택.dc.html"),
    "/support.js": path.join(jamsilOlympicSeatMapDir, "support.js"),
    "/좌석 도면/잠실 올림픽 경기장/좌석선택.dc.html": path.join(jamsilOlympicSeatMapDir, "좌석선택.dc.html"),
    "/좌석 도면/잠실 올림픽 경기장/support.js": path.join(jamsilOlympicSeatMapDir, "support.js")
  } : {};
  const safePath = path.normalize(requested).replace(/^(\.\.[/\\])+/, "");
  const relativeSafePath = safePath.replace(/^[/\\]+/, "");
  let specialPath = dcStatic[requested];
  if (!specialPath && rootDir === publicDir && requested.startsWith("/좌석 도면/")) {
    const seatMapPath = path.join(projectDir, relativeSafePath);
    if (!seatMapPath.startsWith(seatMapDir)) throw httpError(403, "FORBIDDEN", "잘못된 경로입니다.");
    specialPath = seatMapPath;
  }
  const filePath = specialPath || path.join(rootDir, safePath);
  if (!specialPath && !filePath.startsWith(rootDir)) throw httpError(403, "FORBIDDEN", "잘못된 경로입니다.");
  let file;
  try {
    file = await readFile(filePath);
  } catch (error) {
    if (error.code === "ENOENT") throw httpError(404, "NOT_FOUND", "파일을 찾을 수 없습니다.");
    throw error;
  }
  res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
  res.end(file);
}

async function handleRequest(req, res, db, surface) {
  const staticDir = surface === "admin" ? adminDir : publicDir;
  const fallback = surface === "admin" ? fallbackAdmin : fallbackPublic;
  try {
    if (req.url.startsWith("/api/")) {
      const result = await handleApi(req, res, db, surface);
      await saveDb(db);
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: true, data: result }, null, 2));
      return;
    }
    if (surface === "admin" && !fallbackAdmin) {
      throw httpError(404, "NOT_FOUND", "관리자 API 서버는 정적 관리자 페이지를 제공하지 않습니다.");
    }
    await serveStatic(req, res, staticDir, fallback);
  } catch (error) {
    const status = error.status || 500;
    if (surface === "public" && !req.url.startsWith("/api/") && status === 404) {
      res.writeHead(302, { Location: "/" });
      res.end();
      return;
    }
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({
      ok: false,
      error: {
        code: error.code || "INTERNAL_ERROR",
        message: error.message || "서버 오류가 발생했습니다.",
        detail: error.detail || {}
      }
    }, null, 2));
  }
}


  return { handleRequest };
}
