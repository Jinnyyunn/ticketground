import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const appSource = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const indexSource = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const stylesSource = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
const adminSource = await readFile(new URL("../admin/admin.html", import.meta.url), "utf8");
const adminStyles = await readFile(new URL("../admin/admin.css", import.meta.url), "utf8");

test("booking flow is date-first before seat selection", () => {
  assert.match(appSource, /selectedPerformanceDate/);
  assert.match(appSource, /bookingStarted/);
  assert.match(appSource, /renderBookingCalendar/);
  assert.match(appSource, /data-booking-date/);
  assert.match(appSource, /data-start-booking/);
  assert.match(appSource, /bookingStarted\s+\?\s+renderSeatMap/);
  assert.match(stylesSource, /\.booking-date-panel/);
  assert.match(stylesSource, /\.booking-standby/);
});

test("seat selection requires explicit completion after selecting a seat", () => {
  assert.match(appSource, /좌석선택완료/);
  assert.match(appSource, /selected-seat-table/);
  assert.match(appSource, /data-previous-booking-step/);
  assert.match(appSource, /data-reset-seat/);
  assert.doesNotMatch(appSource, /await buyTicket\(appState\.selectedSeatId\);\n\s*}\n\s*return;\n\s*}\n\s*\n\s*try/);
});

test("product detail follows the admin-selected venue and prices", () => {
  assert.match(indexSource, /id="productVenue"/);
  assert.match(indexSource, /id="productPlaceCopy"/);
  assert.match(appSource, /renderProductDetails/);
  assert.match(appSource, /event\.venue/);
  assert.match(appSource, /productVipPrice/);
});

test("admin console points operators to the live booking page", () => {
  assert.match(adminSource, /http:\/\/localhost:4273\/#booking/);
  assert.match(adminSource, /사용자 예매 화면에서 확인/);
  assert.match(adminSource, /사용자 예매 페이지에 즉시 반영/);
  assert.match(adminStyles, /\.console-link/);
});
