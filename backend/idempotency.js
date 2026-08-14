function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = canonicalJson(value[key]);
      return result;
    }, {});
  }
  return value;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createIdempotencyBackend({ hash, httpError, now }) {
  function executeIdempotent(db, request, mutate, responseCodec = {}) {
    const keyHash = hash(request.key);
    const requestHash = hash(JSON.stringify(canonicalJson(request.payload)));
    const existing = db.idempotencyRecords.find((record) => (
      record.actorId === request.actorId
      && record.operation === request.operation
      && record.keyHash === keyHash
    ));
    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw httpError(409, "IDEMPOTENCY_CONFLICT", "같은 Idempotency-Key를 다른 요청에 사용할 수 없습니다.");
      }
      const replayed = responseCodec.decode ? responseCodec.decode(clone(existing.response)) : existing.response;
      return clone(replayed);
    }

    const response = mutate();
    db.idempotencyRecords.push({
      actorId: request.actorId,
      operation: request.operation,
      keyHash,
      requestHash,
      response: clone(responseCodec.encode ? responseCodec.encode(response) : response),
      createdAt: now()
    });
    return response;
  }

  return { executeIdempotent };
}
