import test from "node:test";
import assert from "node:assert/strict";
import { formatAdmissionWatermark } from "../src/lib/admission-watermark.ts";

test("formats trace code, venue-local time, and a ticket suffix into the watermark string", () => {
  const watermark = formatAdmissionWatermark({
    traceCode: "8f3a91cd22",
    issuedAt: "2026-09-19T10:02:20.000Z", // 19:02:20 in Asia/Seoul (UTC+9)
    ticketId: "ticket_dd1e615d7e14"
  });
  assert.equal(watermark, "TG-8F3A91 · 19:02:20 · M-7E14");
});

test("pads a short ticket suffix instead of producing a malformed code", () => {
  const watermark = formatAdmissionWatermark({
    traceCode: "aa11",
    issuedAt: "2026-01-01T00:00:00.000Z",
    ticketId: "t1"
  });
  assert.match(watermark, /M-00T1$/);
});

test("is deterministic for the same inputs (no hidden randomness in the display)", () => {
  const params = { traceCode: "5c2f0b8e91", issuedAt: "2026-05-01T05:00:00.000Z", ticketId: "ticket_abcdef123456" };
  assert.equal(formatAdmissionWatermark(params), formatAdmissionWatermark(params));
});
