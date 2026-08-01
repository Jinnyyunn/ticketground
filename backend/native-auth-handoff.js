import crypto from "node:crypto";

const HANDOFF_MAX_AGE_MS = 5 * 60 * 1000;

function timestamp(now) {
  return typeof now === "function" ? now() : now;
}

function codeHash(rawCode) {
  return crypto.createHash("sha256").update(rawCode).digest("hex");
}

function hashesMatch(left, right) {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function issueNativeAuthHandoff(db, provider, userID, now) {
  const code = crypto.randomBytes(32).toString("base64url");
  const issuedAt = timestamp(now);
  const hash = codeHash(code);
  db.nativeAuthHandoffs ||= [];
  db.nativeAuthHandoffs.push({
    id: `native_handoff_${hash.slice(0, 16)}`,
    provider,
    userId: userID,
    codeHash: hash,
    issuedAt,
    expiresAt: new Date(Date.parse(issuedAt) + HANDOFF_MAX_AGE_MS).toISOString(),
    consumedAt: null,
  });
  return code;
}

export function consumeNativeAuthHandoff(db, provider, rawCode, now) {
  const candidateHash = codeHash(String(rawCode || ""));
  const currentTimestamp = timestamp(now);
  const record = (db.nativeAuthHandoffs || []).find((handoff) => (
    handoff.provider === provider
    && hashesMatch(String(handoff.codeHash || ""), candidateHash)
  ));
  if (!record || record.consumedAt || Date.parse(currentTimestamp) >= Date.parse(record.expiresAt)) {
    return null;
  }
  record.consumedAt = currentTimestamp;
  return record.userId;
}
