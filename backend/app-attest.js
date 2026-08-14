const PURPOSES = new Set(["TRUST_DEVICE", "ISSUE_QR"]);
const PLATFORMS = new Set(["ios", "android"]);
const CHALLENGE_TTL_MS = 2 * 60 * 1000;
const IOS_APP_ID = "kr.ticketground.app";
const DEFAULT_ANDROID_PACKAGE_NAMES = ["kr.ticketground.app"];

export function createAppAttestBackend({
  currentTimeMs,
  httpError,
  id,
  now,
  androidPackageNames = DEFAULT_ANDROID_PACKAGE_NAMES,
  playIntegrityVerifierToken,
  playIntegrityVerifierURL,
  randomHex,
  verifierToken,
  verifierURL
}) {
  const allowedAndroidPackageNames = [...new Set(androidPackageNames.map((value) => String(value).trim()).filter(Boolean))];
  if (!allowedAndroidPackageNames.length) allowedAndroidPackageNames.push(...DEFAULT_ANDROID_PACKAGE_NAMES);
  function normalizePlatform(platform) {
    const normalized = String(platform || "ios").toLowerCase();
    if (!PLATFORMS.has(normalized)) {
      throw httpError(422, "INVALID_ATTESTATION_PLATFORM", "지원하지 않는 기기 증명 플랫폼입니다.");
    }
    return normalized;
  }

  function issueChallenge(db, { userId, platform, purpose, deviceId, ticketId = null }) {
    const normalizedPlatform = normalizePlatform(platform);
    const normalizedPurpose = String(purpose || "").toUpperCase();
    if (!PURPOSES.has(normalizedPurpose)) throw httpError(422, "INVALID_ATTESTATION_PURPOSE", "지원하지 않는 기기 증명 목적입니다.");
    if (!String(deviceId || "").trim()) throw httpError(400, "MISSING_FIELD", "deviceId 값이 필요합니다.");
    if (normalizedPurpose === "ISSUE_QR" && !String(ticketId || "").trim()) {
      throw httpError(400, "MISSING_FIELD", "ticketId 값이 필요합니다.");
    }
    const createdAt = now();
    db.appAttestChallenges = db.appAttestChallenges.filter((item) => !item.consumedAt && Date.parse(item.expiresAt) > currentTimeMs());
    const challenge = {
      id: id("app_attest_challenge"),
      userId,
      platform: normalizedPlatform,
      purpose: normalizedPurpose,
      deviceId: String(deviceId),
      ticketId: ticketId ? String(ticketId) : null,
      challenge: Buffer.from(randomHex(32), "hex").toString("base64"),
      createdAt,
      expiresAt: new Date(currentTimeMs() + CHALLENGE_TTL_MS).toISOString(),
      consumedAt: null
    };
    db.appAttestChallenges.push(challenge);
    return { id: challenge.id, platform: challenge.platform, challenge: challenge.challenge, expiresAt: challenge.expiresAt };
  }

  async function verifyProof(db, { userId, platform, purpose, deviceId, ticketId = null, body, kind }) {
    const normalizedPlatform = normalizePlatform(platform);
    const challenge = db.appAttestChallenges.find((item) => item.id === body.challengeId);
    const matches = challenge
      && challenge.userId === userId
      && (challenge.platform || "ios") === normalizedPlatform
      && challenge.purpose === purpose
      && challenge.deviceId === String(deviceId)
      && challenge.ticketId === (ticketId ? String(ticketId) : null)
      && !challenge.consumedAt
      && Date.parse(challenge.expiresAt) > currentTimeMs();
    if (!matches) throw httpError(403, "APP_ATTEST_CHALLENGE_INVALID", "만료되었거나 요청과 일치하지 않는 App Attest challenge입니다.");
    if (normalizedPlatform === "android") {
      return verifyPlayIntegrity(challenge, body);
    }
    return verifyAppleAppAttest(challenge, body, kind);
  }

  async function verifyAppleAppAttest(challenge, body, kind) {
    let resolvedVerifierURL;
    try {
      resolvedVerifierURL = new URL(verifierURL);
    } catch {
      throw httpError(503, "APP_ATTEST_VERIFIER_UNAVAILABLE", "App Attest 검증 서비스를 사용할 수 없습니다.");
    }
    if (resolvedVerifierURL.protocol !== "https:" || !verifierToken) throw httpError(503, "APP_ATTEST_VERIFIER_UNAVAILABLE", "App Attest 검증 서비스를 사용할 수 없습니다.");
    const proof = kind === "attestation" ? body.attestationObject : body.assertion;
    if (!body.keyId || !proof) throw httpError(400, "MISSING_FIELD", "App Attest 증명 값이 필요합니다.");
    let response;
    try {
      response = await fetch(resolvedVerifierURL, {
        method: "POST",
        signal: AbortSignal.timeout(5000),
        headers: { Authorization: `Bearer ${verifierToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          appId: IOS_APP_ID,
          challenge: challenge.challenge,
          keyId: body.keyId,
          proof
        })
      });
    } catch {
      throw httpError(503, "APP_ATTEST_VERIFIER_UNAVAILABLE", "App Attest 검증 서비스를 사용할 수 없습니다.");
    }
    if (!response.ok) throw httpError(403, "APP_ATTESTATION_REQUIRED", "Apple App Attest 증명을 확인할 수 없습니다.");
    const result = await response.json().catch(() => null);
    if (result?.verified !== true) throw httpError(403, "APP_ATTESTATION_REQUIRED", "Apple App Attest 증명을 확인할 수 없습니다.");
    challenge.consumedAt = now();
    return true;
  }

  async function verifyPlayIntegrity(challenge, body) {
    const requestedPackageName = allowedAndroidPackageNames.length === 1
      ? allowedAndroidPackageNames[0]
      : (body.packageName && allowedAndroidPackageNames.includes(String(body.packageName))
        ? String(body.packageName)
        : allowedAndroidPackageNames[0]);
    let resolvedVerifierURL;
    try {
      resolvedVerifierURL = new URL(playIntegrityVerifierURL);
    } catch {
      throw httpError(503, "PLAY_INTEGRITY_VERIFIER_UNAVAILABLE", "Play Integrity 검증 서비스를 사용할 수 없습니다.");
    }
    if (resolvedVerifierURL.protocol !== "https:" || !playIntegrityVerifierToken) {
      throw httpError(503, "PLAY_INTEGRITY_VERIFIER_UNAVAILABLE", "Play Integrity 검증 서비스를 사용할 수 없습니다.");
    }
    if (!body.integrityToken) throw httpError(400, "MISSING_FIELD", "Play Integrity 증명 값이 필요합니다.");
    let response;
    try {
      response = await fetch(resolvedVerifierURL, {
        method: "POST",
        signal: AbortSignal.timeout(5000),
        headers: { Authorization: `Bearer ${playIntegrityVerifierToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          packageName: requestedPackageName,
          challenge: challenge.challenge,
          purpose: challenge.purpose,
          deviceId: challenge.deviceId,
          ticketId: challenge.ticketId,
          integrityToken: body.integrityToken
        })
      });
    } catch {
      throw httpError(503, "PLAY_INTEGRITY_VERIFIER_UNAVAILABLE", "Play Integrity 검증 서비스를 사용할 수 없습니다.");
    }
    if (!response.ok) throw httpError(403, "PLAY_INTEGRITY_REQUIRED", "Google Play Integrity 증명을 확인할 수 없습니다.");
    const result = await response.json().catch(() => null);
    const verified = result?.verified === true
      && allowedAndroidPackageNames.includes(result.packageName)
      && result.packageName === requestedPackageName
      && result.challenge === challenge.challenge
      && result.purpose === challenge.purpose
      && result.deviceId === challenge.deviceId
      && (result.ticketId ?? null) === challenge.ticketId;
    if (!verified) throw httpError(403, "PLAY_INTEGRITY_REQUIRED", "Google Play Integrity 증명을 확인할 수 없습니다.");
    challenge.consumedAt = now();
    return true;
  }

  return { issueChallenge, verifyProof };
}
