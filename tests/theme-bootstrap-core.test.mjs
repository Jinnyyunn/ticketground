import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const layoutPath = new URL("../src/app/layout.tsx", import.meta.url);
const globalsPath = new URL("../src/app/globals.css", import.meta.url);
const themeVarsPath = new URL("../src/app/theme-vars.css", import.meta.url);
const designPath = new URL("../DESIGN.md", import.meta.url);

test("P6 theme bootstrap synchronously resolves the stored or system theme", async () => {
  const layout = await readFile(layoutPath, "utf8");

  assert.match(layout, /<html[^>]*suppressHydrationWarning/, "root html must suppress hydration warnings for client-applied theme attributes");
  assert.match(layout, /ticketground:theme/, "bootstrap must read the Ticketground theme storage key");
  assert.match(layout, /storedTheme === "light" \|\| storedTheme === "dark" \|\| storedTheme === "system"/, "bootstrap must accept only light/dark/system preferences");
  assert.match(layout, /prefers-color-scheme: dark/, "system preference must use prefers-color-scheme");
  assert.match(layout, /classList\.toggle\("dark", resolvedTheme === "dark"\)/, "bootstrap must synchronously toggle the dark class");
  assert.match(layout, /dataset\.theme = resolvedTheme/, "bootstrap must expose the resolved theme on data-theme");
  assert.ok(layout.indexOf("<script") < layout.indexOf("{children}"), "theme bootstrap script must run before route children render");
});

test("P6 theme CSS exposes class dark variant, tint, and contrast tokens", async () => {
  const globals = await readFile(globalsPath, "utf8");
  const themeVars = await readFile(themeVarsPath, "utf8");

  assert.match(globals, /@custom-variant dark \(&:is\(\.dark \*\)\);/, "Tailwind dark variant must be class based");
  assert.match(globals, /--color-tint-blue: color-mix\(in srgb, var\(--link\) 8%, var\(--bg\)\);/);
  assert.match(globals, /--color-tint-red: color-mix\(in srgb, var\(--accent\) 10%, var\(--bg\)\);/);
  assert.match(globals, /--color-tint-yellow: color-mix\(in srgb, var\(--accent-2\) 35%, var\(--bg\)\);/);

  for (const token of ["on-ink", "on-ink-2", "on-tier-vip", "on-tier-r", "on-tier-s", "on-tier-a", "on-tier-b", "on-accent-2", "on-scrim"]) {
    assert.match(themeVars, new RegExp(`--${token}:`), `theme-vars.css must define --${token}`);
    assert.match(globals, new RegExp(`--color-${token}: var\\(--${token}\\);`), `globals.css must map --color-${token}`);
  }
  assert.match(themeVars, /--scrim: #000000;/, "image scrims must use a fixed dark token");
  assert.match(globals, /--color-scrim: var\(--scrim\);/, "globals.css must expose the fixed scrim token");

  assert.match(themeVars, /\.dark\s*{[\s\S]*--bg: #1b1b1e;/, "dark theme must define the tuned gray background");
  assert.match(themeVars, /\.dark\s*{[\s\S]*--bg-2: #202024;/, "dark theme must keep a visible second surface step");
  assert.match(themeVars, /\.dark\s*{[\s\S]*--bg-4: #27272c;/, "dark theme must keep a visible fourth surface step");
  assert.match(themeVars, /\.dark\s*{[\s\S]*--tier-vip: #f6df8f;/, "dark VIP tier must be bright gold/cream, not a dark brightness adjustment");
  assert.match(themeVars, /\.dark\s*{[\s\S]*--on-tier-vip: #1a1a1d;/, "bright VIP tier must use a dark foreground");
});

test("DESIGN.md documents the light dark system theme policy and queue exception", async () => {
  const design = await readFile(designPath, "utf8");

  assert.match(design, /light\/dark\/system/i);
  assert.match(design, /ticketground:theme/);
  assert.doesNotMatch(design, /Light-only policy/);
  assert.match(design, /queue-waiting-room\.tsx/);
});
