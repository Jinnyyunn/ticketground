import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

test("mypage searches reservation and canceled performance history by range", async (t) => {
  const server = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  try {
    await page.goto(`${server.baseUrl}/cancel?reservation=CTI-26007169-001`, { waitUntil: "networkidle" });
    await page.getByLabel("일정 변경").check();
    await page.getByLabel(/취소 수수료와 환불 예정 금액을 확인했습니다/).check();
    await page.getByRole("button", { name: /mock 취소 요청 완료/ }).click();
    await page.getByRole("heading", { name: "취소·환불 요청이 기록되었습니다" }).waitFor();

    await page.goto(`${server.baseUrl}/mypage`, { waitUntil: "networkidle" });

    const searchPanel = page.locator("[data-history-search-panel]");
    await searchPanel.getByRole("heading", { name: "내 예매 및 취소공연 검색" }).waitFor();
    assert.equal(await page.getByText("결제 완료 후 이 영역에 백엔드 티켓이 표시됩니다.").count(), 0);

    await searchPanel.getByLabel("내역 검색어").fill("베를린필");
    await searchPanel.getByRole("button", { name: "검색" }).click();
    await searchPanel.getByRole("heading", { name: "베를린필 내한공연" }).first().waitFor();
    await searchPanel.getByText("취소요청 완료").waitFor();
    assert.equal(await searchPanel.getByRole("heading", { name: "베를린필 내한공연" }).count(), 2);
    assert.equal(await searchPanel.getByRole("heading", { name: "레미제라블 40주년" }).count(), 0);

    const todayIsoDate = isoDateFromDate(new Date());
    await searchPanel.getByLabel("조회 기간").selectOption("3m");
    await searchPanel.getByText(`${shiftIsoDate(todayIsoDate, 3)} ~ ${todayIsoDate}`).waitFor();
    assert.equal(await searchPanel.getByRole("heading", { name: "베를린필 내한공연" }).count(), 2);

    await searchPanel.getByLabel("조회 기간").selectOption("custom");
    await searchPanel.getByLabel("시작일").fill(todayIsoDate);
    await searchPanel.getByLabel("종료일").fill(todayIsoDate);
    await searchPanel.getByRole("heading", { name: "베를린필 내한공연" }).first().waitFor();

    await searchPanel.getByLabel("시작일").fill("2026-10-01");
    await searchPanel.getByLabel("종료일").fill("2026-10-31");
    await searchPanel.getByText("조건에 맞는 예매 또는 취소 내역이 없습니다.").waitFor();
  } finally {
    await page.close();
  }
});

function shiftIsoDate(value, monthsBack) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  assert.ok(match);
  const shiftedDate = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1 - monthsBack, Number(match[3])));
  return isoDateFromDate(shiftedDate);
}

function isoDateFromDate(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
