# Shared Footer Business Information Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the approved Ticketground business information in the shared Korean footer, including `/company`, while keeping translated homepages free of Korean-only labels.

**Architecture:** Keep the existing `SiteFooter` component and business-information DOM. Change only its optional display prop default so shared Korean page shells opt in automatically, while the localized homepage keeps its existing explicit locale boolean.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Node test runner, Playwright

## Global Constraints

- Do not modify simple-login UI, OAuth routes, authentication tests, `.env` files, or provider console settings.
- Preserve the exact approved business-information copy from PR #179.
- Use the existing `SiteFooter` component; do not move footer ownership into a new layout.
- Run build and browser validation serially.

---

### Task 1: Display business information on shared Korean routes

**Files:**
- Modify: `tests/home-footer-business-information.test.mjs`
- Modify: `src/components/site-footer.tsx`

**Interfaces:**
- Consumes: `SiteFooterProps.showBusinessInformation?: boolean`
- Produces: `SiteFooter` renders the existing business-information section by default; explicit `false` still suppresses it.

- [ ] **Step 1: Write the failing browser regression test**

Replace the shared-route absence assertion with a `/company` scenario that waits for the exact business heading and verifies the email link:

```js
test("shared Korean footer routes expose the approved business information block", async (t) => {
  // Given
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 375, height: 812 }, isMobile: true });
  t.after(() => page.close());

  // When
  await page.goto(`${baseUrl}/company`, { waitUntil: "networkidle" });
  const footer = page.locator("footer");

  // Then
  await footer.getByRole("heading", { name: "티켓그라운드 사업자 정보" }).waitFor();
  const email = footer.getByRole("link", { name: "이메일 : tigmaster@ticketground.co.kr" });
  assert.equal(await email.getAttribute("href"), "mailto:tigmaster@ticketground.co.kr");
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
NODE_ENV=production node --test --test-concurrency=1 tests/home-footer-business-information.test.mjs
```

Expected: the shared Korean footer test fails because `/company` cannot find the business-information heading.

- [ ] **Step 3: Apply the minimal implementation**

Change the existing prop default in `src/components/site-footer.tsx`:

```tsx
export function SiteFooter({
  dict = koDictionary.footer,
  showBusinessInformation = true,
}: SiteFooterProps) {
```

- [ ] **Step 4: Verify GREEN and regressions**

Run:

```bash
npm run build
NODE_ENV=production node --test --test-concurrency=1 tests/home-footer-business-information.test.mjs
npm run lint
npm run typecheck
```

Expected: every command exits 0; homepage, shared Korean route, mobile copyright, and translated homepage assertions all pass.

- [ ] **Step 5: Verify the rendered surface**

Deploy the current PR head to the existing dev runtime without changing protected authentication configuration. Open `https://dev.ticketground.co.kr/company` at desktop and 375px mobile widths, scroll to the footer, and capture screenshots proving the business block is visible and readable.

- [ ] **Step 6: Commit and publish**

```bash
git add src/components/site-footer.tsx tests/home-footer-business-information.test.mjs docs/superpowers/plans/2026-08-12-shared-footer-business-information.md
git commit -m "fix(ui): 공통 푸터에 사업자 정보 표시"
git push -u origin agent/footer-business-info-all-pages
```

Open a ready-for-review PR against `main`, include the RED/GREEN/build/browser evidence, resolve actionable review findings, and merge only when required checks and independent review are green.
