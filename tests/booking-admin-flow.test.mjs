import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const appSource = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const serverSource = await readFile(new URL("../server.js", import.meta.url), "utf8");
const admissionSource = await readFile(new URL("../backend/admission.js", import.meta.url), "utf8");
const admissionQrSource = await readFile(new URL("../backend/admission-qr.js", import.meta.url), "utf8");
const indexSource = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const stylesSource = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
const adminSource = await readFile(new URL("../admin/admin.html", import.meta.url), "utf8");
const adminStyles = await readFile(new URL("../admin/admin.css", import.meta.url), "utf8");
const designSource = await readFile(new URL("../DESIGN.md", import.meta.url), "utf8");

test("booking flow is date-first before seat selection", () => {
  assert.match(appSource, /selectedDateId/);
  assert.match(appSource, /bookingStep: "date"/);
  assert.match(appSource, /renderDateSelection/);
  assert.match(appSource, /data-booking-date/);
  assert.match(appSource, /data-open-seat-selector/);
  assert.match(appSource, /renderSeatStep/);
  assert.match(stylesSource, /\.booking-progress/);
  assert.match(stylesSource, /\.booking-date-grid/);
});

test("seat selection requires payment step before purchase", () => {
  assert.match(appSource, /data-booking-step="payment"/);
  assert.match(appSource, /결제 단계로/);
  assert.match(appSource, /renderPaymentStep/);
  assert.match(appSource, /data-buy-selected/);
  assert.doesNotMatch(appSource, /await buyTicket\(appState\.selectedSeatId\);\n\s*}\n\s*return;\n\s*}\n\s*\n\s*try/);
});

test("admin sale settings flow into public ticket cards", () => {
  assert.match(adminSource, /id="saleStateSelect"/);
  assert.match(adminSource, /id="saleNoteInput"/);
  assert.match(adminSource, /id="discountRateInput"/);
  assert.match(appSource, /eventSale/);
  assert.match(appSource, /saleBadge/);
  assert.match(appSource, /salePriceCopy/);
  assert.match(appSource, /event-cta \${sale\.bookable/);
  assert.match(stylesSource, /\.sale-state/);
  assert.match(stylesSource, /\.event-cta\.disabled/);
});

test("admin account status uses selectable batch edit with confirmation", () => {
  assert.match(adminSource, /id="accountSaveBtn"/);
  assert.match(adminSource, /data-account-status/);
  assert.match(adminSource, /수정하시겠습니까/);
  assert.match(adminSource, /\/api\/admin\/users\/statuses/);
  assert.match(adminStyles, /\.account-status-select/);
});

test("ticket QR separates virtual ticket from admission QR", () => {
  assert.match(appSource, /data-virtual-qr/);
  assert.match(appSource, /\/api\/tickets\/virtual-qr/);
  assert.match(admissionSource, /VIRTUAL_TICKET/);
  assert.match(admissionQrSource, /ADMISSION/);
  assert.match(admissionQrSource, /20_000/);
  assert.match(admissionQrSource, /REAL_QR_NOT_READY/);
  assert.match(serverSource, /createAdmissionBackend/);
  assert.match(appSource, /가상 티켓 QR/);
  assert.match(stylesSource, /\.qr-token\.virtual/);
  assert.match(stylesSource, /data-watermark/);
});

test("admin console points operators to the live booking page", () => {
  assert.match(adminSource, /http:\/\/localhost:4273\/#booking/);
  assert.match(adminSource, /사용자 예매 화면에서 확인/);
  assert.match(adminSource, /판매 정보 저장/);
  assert.match(adminStyles, /\.console-link/);
});

test("mobile layout avoids horizontal overflow-prone grids", () => {
  assert.match(stylesSource, /@media \(max-width: 760px\)/);
  assert.match(stylesSource, /\.ticket-action-grid/);
  assert.match(stylesSource, /\.event-card\s*\{\s*grid-template-columns: 1fr/s);
  assert.match(stylesSource, /\.support-chat/);
});

test("design system contract describes Ticketground public and admin surfaces", () => {
  assert.match(designSource, /# Ticketground Design System/);
  assert.match(designSource, /public ticketing surface/);
  assert.match(designSource, /operations console/);
  assert.match(designSource, /Open Design/);
  assert.match(designSource, /8px/);
  assert.match(designSource, /#ffd400/);
  assert.doesNotMatch(designSource, /Sublime/);
});
