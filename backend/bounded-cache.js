export function createBoundedTtlCache({ maxEntries, now = Date.now }) {
  if (!Number.isInteger(maxEntries) || maxEntries < 1) {
    throw new RangeError("maxEntries must be a positive integer");
  }

  const entries = new Map();

  return {
    get(key, ttlMs) {
      const entry = entries.get(key);
      if (!entry) return null;
      if (now() - entry.createdAt > ttlMs) {
        entries.delete(key);
        return null;
      }
      entries.delete(key);
      entries.set(key, entry);
      return entry.value;
    },
    set(key, value) {
      entries.delete(key);
      while (entries.size >= maxEntries) {
        const oldestKey = entries.keys().next().value;
        if (oldestKey === undefined) break;
        entries.delete(oldestKey);
      }
      entries.set(key, { createdAt: now(), value });
      return value;
    },
    size() {
      return entries.size;
    }
  };
}
