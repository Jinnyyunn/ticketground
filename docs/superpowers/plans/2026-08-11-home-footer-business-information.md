# Homepage Footer Business Information Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the approved Ticketground business and customer-center information block to the homepage footer without changing shared footer output on other public routes.

**Architecture:** Extend `SiteFooter` with an explicit `showBusinessInformation` boolean prop that defaults to `false`, and enable it only from the homepage. Render a semantic, token-driven responsive information block between the existing footer navigation and copyright sections.

**Tech Stack:** Next.js 16 App Router, React 19 server components, TypeScript strict, Tailwind CSS v4, Node test runner, Playwright with Chrome.

## Global Constraints

- Display the exact approved Korean business and customer-center copy.
- Limit the new block to homepage `/`; shared footer output on other routes remains unchanged.
- Preserve existing footer brand, policy links, navigation columns, and copyright.
- Use only existing `DESIGN.md` semantic tokens and 4px-based spacing; add no card, shadow, color, motion, or dependency.
- Do not modify protected social-login code, configuration, tests, or provider console settings.
- Verify mobile 375px, tablet 768px, and desktop 1280px with real Chrome.

---

### Task 1: Protect homepage-only footer behavior with a browser regression test

**Files:**
- Create: `tests/home-footer-business-information.test.mjs`

**Interfaces:**
- Consumes: the production `/` homepage and `/contents/search` route through `startServer(t)`.
- Produces: a browser contract proving exact copy, email behavior, homepage-only scope, and no mobile overflow.

- [ ] **Step 1: Write the failing test**

```javascript
import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

test("homepage footer exposes Ticketground business contact details without changing shared footers", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 375, height: 812 }, isMobile: true });
  t.after(() => page.close());
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  const footer = page.locator("footer");
  await footer.scrollIntoViewIfNeeded();
  await footer.getByRole("heading", { name: "티켓그라운드 사업자 정보" }).waitFor();
  await footer.getByText("주소 : 경기도 고양시 주교동 독곶이길 117", { exact: true }).waitFor();
  await footer.getByText("대표이사 : 윤진영", { exact: true }).waitFor();
  await footer.getByText("사업자등록번호 : 527-44-01245", { exact: true }).waitFor();
  const email = footer.getByRole("link", { name: "이메일 : tigmaster@ticketground.co.kr" });
  assert.equal(await email.getAttribute("href"), "mailto:tigmaster@ticketground.co.kr");
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));

  await page.goto(`${baseUrl}/contents/search`, { waitUntil: "networkidle" });
  assert.equal(await page.getByRole("heading", { name: "티켓그라운드 사업자 정보" }).count(), 0);
});
```

- [ ] **Step 2: Build the unchanged app and run the test to verify RED**

Run: `npm run build && node --test --experimental-strip-types tests/home-footer-business-information.test.mjs`

Expected: FAIL because the homepage footer has no `티켓그라운드 사업자 정보` heading.

### Task 2: Add the responsive business information block

**Files:**
- Modify: `src/components/site-footer.tsx`
- Modify: `src/app/page.tsx`
- Test: `tests/home-footer-business-information.test.mjs`

**Interfaces:**
- Consumes: `SiteFooterProps.showBusinessInformation?: boolean`.
- Produces: `SiteFooter({ dict, showBusinessInformation })` rendering the approved block only when the flag is true.

- [ ] **Step 1: Add the minimal prop and conditional block**

```tsx
type SiteFooterProps = {
  readonly dict?: Dictionary["footer"];
  readonly showBusinessInformation?: boolean;
};

export function SiteFooter({
  dict = koDictionary.footer,
  showBusinessInformation = false,
}: SiteFooterProps) {
```

The conditional block uses:

```tsx
{showBusinessInformation ? (
  <section className="border-t border-line" aria-labelledby="footer-business-information-title">
    <div className="ticketground-container grid gap-6 py-8 text-sm text-ink-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] md:gap-10">
      <div>
        <h2 id="footer-business-information-title" className="font-black text-ink">티켓그라운드 사업자 정보</h2>
        <address className="mt-3 not-italic leading-loose">
          <p>주소 : 경기도 고양시 주교동 독곶이길 117</p>
          <p>대표이사 : 윤진영</p>
          <p>사업자등록번호 : 527-44-01245</p>
        </address>
      </div>
      <div>
        <h2 className="font-black text-ink">고객센터</h2>
        <a className="mt-3 inline-block break-all leading-loose text-ink-3 hover:text-ticketground focus-visible:ring-3 focus-visible:ring-ring/50" href="mailto:tigmaster@ticketground.co.kr">
          이메일 : tigmaster@ticketground.co.kr
        </a>
      </div>
    </div>
  </section>
) : null}
```

- [ ] **Step 2: Enable the block only on the homepage**

Change the homepage call to:

```tsx
<SiteFooter dict={dict.footer} showBusinessInformation />
```

- [ ] **Step 3: Run focused tests to verify GREEN**

Run: `node --test --experimental-strip-types tests/home-footer-business-information.test.mjs tests/mobile-footer-sections.test.mjs tests/footer-routes.test.mjs`

Expected: all tests PASS; the new block exists only on `/`, the existing footer columns remain usable, and mobile has no horizontal overflow.

- [ ] **Step 4: Run static and production checks**

Run: `npx eslint src/components/site-footer.tsx src/app/page.tsx tests/home-footer-business-information.test.mjs && npm run typecheck && npm run build`

Expected: exit 0 for every command.

- [ ] **Step 5: Commit the implementation and direct test**

```bash
git add src/components/site-footer.tsx src/app/page.tsx tests/home-footer-business-information.test.mjs
git commit -m "feat(ui): add homepage footer business details"
```

### Task 3: Verify the rendered footer and complete the PR

**Files:**
- Evidence only: fresh screenshots outside the repository for 375px, 768px, and 1280px.

**Interfaces:**
- Consumes: the production build from Task 2.
- Produces: visual QA evidence, clean review state, and a merged PR.

- [ ] **Step 1: Capture fresh homepage footer screenshots in real Chrome**

At 375px, 768px, and 1280px, navigate to `/`, scroll the footer into view, and capture the complete footer. Confirm mobile stacks the two information groups, tablet/desktop uses two columns, Korean lines do not orphan unnaturally, and no viewport has horizontal overflow.

- [ ] **Step 2: Run independent visual and code review**

Provide the reference image, current source, all three fresh captures, and the exact viewport list to the read-only reviewers. Fix every product blocker and re-capture after any rendered-source change.

- [ ] **Step 3: Push and open the PR**

```bash
git push -u origin agent/footer-business-information
gh pr create --base main --head agent/footer-business-information --title "feat(ui): 홈페이지 푸터 사업자 정보 추가" --body $'## 변경 사항\n- 홈페이지 푸터에 사업자 및 고객센터 정보 추가\n- 공유 푸터의 다른 페이지 출력 유지\n\n## 검증\n- 관련 Playwright 테스트\n- lint, typecheck, production build\n- 375px, 768px, 1280px 시각 검증'
```

- [ ] **Step 4: Resolve review feedback and wait for CI**

Require the latest head SHA, all required checks successful, `mergeStateStatus: CLEAN`, and zero unresolved review threads.

- [ ] **Step 5: Squash merge and verify remote main**

```bash
pr_number=$(gh pr view --json number --jq .number)
gh pr merge "$pr_number" --squash
gh pr view "$pr_number" --json state,mergedAt,mergeCommit,url
git ls-remote origin refs/heads/main
```

Expected: PR state `MERGED` and remote `main` at the reported merge commit.
