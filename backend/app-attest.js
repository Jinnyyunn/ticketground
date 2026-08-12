const PURPOSES = new Set(["TRUST_DEVICE", "ISSUE_QR"]);
const CHALLENGE_TTL_MS = 2 * 60 * 1000;

export function createAppAttestBackend({ currentTimeMs, httpError, id, now, randomHex, verifierURL, verifierToken }) {
  function issueChallenge(db, { userId, purpose, deviceId, ticketId = null }) {
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
      purpose: normalizedPurpose,
      deviceId: String(deviceId),
      ticketId: ticketId ? String(ticketId) : null,
      challenge: Buffer.from(randomHex(32), "hex").toString("base64"),
      createdAt,
      expiresAt: new Date(currentTimeMs() + CHALLENGE_TTL_MS).toISOString(),
      consumedAt: null
    };
    db.appAttestChallenges.push(challenge);
    return { id: challenge.id, challenge: challenge.challenge, expiresAt: challenge.expiresAt };
  }

  async function verifyProof(db, { userId, purpose, deviceId, ticketId = null, body, kind }) {
    const challenge = db.appAttestChallenges.find((item) => item.id === body.challengeId);
    const matches = challenge
      && challenge.userId === userId
      && challenge.purpose === purpose
      && challenge.deviceId === String(deviceId)
      && challenge.ticketId === (ticketId ? String(ticketId) : null)
      && !challenge.consumedAt
      && Date.parse(challenge.expiresAt) > currentTimeMs();
    if (!matches) throw httpError(403, "APP_ATTEST_CHALLENGE_INVALID", "만료되었거나 요청과 일치하지 않는 App Attest challenge입니다.");
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
          appId: "kr.ticketground.app",
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

  return { issueChallenge, verifyProof };
}
