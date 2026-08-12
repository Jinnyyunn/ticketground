const DEFAULT_MAX_RECEIPTS = 1000;

export function createIdempotentMutationRunner({
  hash,
  httpError,
  id,
  maxReceipts = DEFAULT_MAX_RECEIPTS,
  now,
  sortJson
}) {
  return function idempotentMutation(db, { kind, userId, key, payload }, mutate) {
    if (!key) return mutate();
    const keyDigest = hash(`api-mutation:${kind}:${userId}:${key}`);
    const requestDigest = hash(`api-mutation:${kind}:payload:${JSON.stringify(sortJson(payload))}`);
    const existing = db.apiMutationReceipts.find((receipt) => receipt.keyDigest === keyDigest);
    if (existing) {
      if (existing.requestDigest !== requestDigest) {
        throw httpError(409, "IDEMPOTENCY_CONFLICT", "같은 재시도 키에 다른 요청이 전달되었습니다.");
      }
      return structuredClone(existing.response);
    }

    const response = structuredClone(mutate());
    db.apiMutationReceipts.push({
      id: id("api_mutation_receipt"),
      kind,
      userId,
      keyDigest,
      requestDigest,
      response,
      createdAt: now()
    });
    if (db.apiMutationReceipts.length > maxReceipts) {
      db.apiMutationReceipts.splice(0, db.apiMutationReceipts.length - maxReceipts);
    }
    return structuredClone(response);
  };
}
