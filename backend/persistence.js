import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export function createPersistence({ dbPath, hash, now, sortJson }) {
  const dataDir = path.dirname(dbPath);

  async function saveDb(db) {
    await writeFile(dbPath, JSON.stringify(db, null, 2), "utf8");
  }

  async function loadDb({ normalizeDb, seedDb }) {
    await mkdir(dataDir, { recursive: true });
    if (!existsSync(dbPath)) {
      const db = seedDb();
      await saveDb(db);
      return db;
    }
    const db = JSON.parse(await readFile(dbPath, "utf8"));
    if (normalizeDb(db)) await saveDb(db);
    return db;
  }

  function appendLedger(db, actorId, action, payload) {
    const previousHash = db.ledger.at(-1)?.hash || "GENESIS";
    const entry = {
      index: db.ledger.length,
      at: now(),
      actorId,
      action,
      payload: sortJson(payload),
      previousHash
    };
    entry.hash = hash(JSON.stringify(entry));
    db.ledger.push(entry);
    return entry;
  }

  function verifyLedger(db) {
    let previousHash = "GENESIS";
    for (const entry of db.ledger) {
      const copy = { ...entry };
      delete copy.hash;
      if (entry.previousHash !== previousHash) {
        return { ok: false, reason: `Broken previousHash at ledger index ${entry.index}` };
      }
      if (hash(JSON.stringify(copy)) !== entry.hash) {
        return { ok: false, reason: `Hash mismatch at ledger index ${entry.index}` };
      }
      previousHash = entry.hash;
    }
    return { ok: true };
  }

  return { appendLedger, loadDb, saveDb, verifyLedger };
}
