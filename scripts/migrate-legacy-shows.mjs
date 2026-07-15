import { readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { legacyCategoryToAdminCategory, legacyShows, legacyVenueIdByName } from "../backend/legacy-show-seed-data.js";

const execFileAsync = promisify(execFile);
const repoRoot = "/Users/jinny/Downloads/claude(Ticketground_User)/repo-pr82-managepage";
const baseUrl = "http://127.0.0.1:50085";
const venueIdByName = legacyVenueIdByName;
const categoryKo2en = legacyCategoryToAdminCategory;
const shows = legacyShows;

function toSchedules(schedules) {
  return schedules.map((s) => ({ label: s.label, date: s.date.replaceAll(".", "-"), times: s.times }));
}

const maxRawBytes = 3 * 1024 * 1024;

async function shrinkToJpeg(absolute) {
  const jpegPath = absolute.replace(/\.[^.]+$/, ".migrated-small.jpg");
  await execFileAsync("sips", ["-Z", "1400", "-s", "format", "jpeg", "-s", "formatOptions", "70", absolute, "--out", jpegPath]);
  return jpegPath;
}

async function posterDataUrl(relativePath) {
  const absolute = path.join(repoRoot, relativePath);
  const ext = path.extname(absolute).toLowerCase();
  let sourcePath = absolute;
  if (ext === ".gif") {
    const pngPath = absolute.replace(/\.gif$/, ".migrated.png");
    await execFileAsync("sips", ["-s", "format", "png", absolute, "--out", pngPath]);
    sourcePath = pngPath;
  }
  let buffer = await readFile(sourcePath);
  if (buffer.length > maxRawBytes) {
    const shrunkPath = await shrinkToJpeg(sourcePath);
    buffer = await readFile(shrunkPath);
    sourcePath = shrunkPath;
  }
  const finalExt = path.extname(sourcePath).toLowerCase();
  const mime = finalExt === ".png" ? "image/png" : finalExt === ".jpg" || finalExt === ".jpeg" ? "image/jpeg" : "image/webp";
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

async function login() {
  const response = await fetch(`${baseUrl}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "admin" }),
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(`login failed: ${JSON.stringify(payload)}`);
  return { csrf: payload.data.csrf, cookie: response.headers.get("set-cookie") };
}

async function createEvent(session, show) {
  const imageDataUrl = await posterDataUrl(show.poster);
  const venueId = venueIdByName[show.venue];
  if (!venueId) throw new Error(`no venueId mapping for venue: ${show.venue}`);
  const body = {
    title: show.title,
    shortTitle: show.shortTitle,
    category: categoryKo2en[show.category],
    venueId,
    startsAt: show.startsAt,
    saleState: "ON_SALE",
    saleNote: "레거시 카탈로그 이관",
    period: show.period,
    runtime: show.runtime,
    ageLimit: show.ageLimit,
    badge: show.badge,
    artistSlug: show.artistSlug,
    slug: show.slug,
    summary: show.summary,
    prices: show.prices,
    schedules: toSchedules(show.schedules),
    casts: show.casts,
    notices: show.notices,
    imageDataUrl,
  };
  const response = await fetch(`${baseUrl}/api/admin/events/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-tig-csrf": session.csrf, cookie: session.cookie },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  return { slug: show.slug, ok: response.ok && payload.ok, status: response.status, payload };
}

const results = [];
const session = await login();
for (const show of shows) {
  try {
    const result = await createEvent(session, show);
    results.push(result);
    console.log(`${result.ok ? "OK" : "FAIL"} ${show.slug} (${result.status})`);
    if (!result.ok) console.log(JSON.stringify(result.payload));
  } catch (error) {
    results.push({ slug: show.slug, ok: false, error: String(error) });
    console.log(`FAIL ${show.slug} ${error}`);
  }
}

await writeFile("/private/tmp/claude-501/homepage-concepts/migration-results.json", JSON.stringify(results, null, 2));
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} succeeded`);
