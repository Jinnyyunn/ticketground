// Formats the QR 생성 및 스캐너 계획서.md's 4장 "동적 워터마크" text
// (예: "TG-8F3A · 19:02:20 · M-0421") from the traceCode the backend already
// generates in admission-qr.js's issueQr(). This is intentionally just the
// pure formatting function, not a mounted screen: the real admission QR is
// APP_CHANNEL_REQUIRED-gated (backend/admission-qr.js) and the web app never
// requests or displays it (channel: "APP" appears nowhere in src/), by
// design - showing the live, scannable QR in a browser would defeat the
// point of gating it to the native app. This utility exists so whichever
// native admission-QR screen gets built next (iOS today, Android later)
// has a single, tested source for the watermark text instead of
// reimplementing the formatting per platform.
export interface AdmissionQrWatermarkParts {
  readonly traceCode: string;
  readonly issuedAt: string;
  readonly ticketId: string;
}

const venueTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  hour12: false,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit"
});

export function formatAdmissionWatermark({ traceCode, issuedAt, ticketId }: AdmissionQrWatermarkParts): string {
  const shortTrace = traceCode.slice(0, 6).toUpperCase();
  const parts = venueTimeFormatter.formatToParts(new Date(issuedAt));
  const lookup = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  const venueTime = `${lookup("hour")}:${lookup("minute")}:${lookup("second")}`;
  const ticketSuffix = ticketId.replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase().padStart(4, "0");
  return `TG-${shortTrace} · ${venueTime} · M-${ticketSuffix}`;
}
