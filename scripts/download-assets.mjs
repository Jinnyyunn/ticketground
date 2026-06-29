// Downloads all extracted assets from nol.interpark.com/ticket into public/
import fs from "node:fs/promises";
import path from "node:path";

const groups = JSON.parse(await fs.readFile("/tmp/dlurls.json", "utf8"));
const all = [
  ...groups.header.map((u) => ["header", u]),
  ...groups.heroG.map((u) => ["hero", u]),
  ...groups.posters.map((u) => ["posters", u]),
  ...groups.other.map((u) => ["misc", u]),
];

function destFor(folder, url) {
  const clean = url.split("?")[0];
  let name = path.basename(clean);
  if (!name || !name.includes(".")) name = encodeURIComponent(url).slice(-40) + ".bin";
  // route by url hints
  let sub = folder;
  if (/MiniBanner/.test(url)) sub = "mini";
  else if (/PromBanner/.test(url)) sub = "promo";
  else if (/profiles/.test(url)) sub = "profiles";
  else if (/emoji/.test(url)) sub = "emoji";
  else if (/favicon/.test(url)) sub = "../seo";
  return path.join("public/images", sub, name);
}

async function dl([folder, url]) {
  const dest = destFor(folder, url);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", Referer: "https://nol.interpark.com/" } });
    if (!res.ok) return `FAIL ${res.status} ${url}`;
    await fs.writeFile(dest, Buffer.from(await res.arrayBuffer()));
    return `ok ${dest}`;
  } catch (e) {
    return `ERR ${e.message} ${url}`;
  }
}

const results = [];
for (let i = 0; i < all.length; i += 6) {
  const batch = all.slice(i, i + 6);
  results.push(...(await Promise.all(batch.map(dl))));
}
const fails = results.filter((r) => !r.startsWith("ok"));
console.log(`Downloaded ${results.length - fails.length}/${results.length}`);
fails.forEach((f) => console.log(f));
