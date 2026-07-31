import assert from "node:assert/strict";
import { chmod, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createPersistence } from "../backend/persistence.js";

test("database saves are serialized and atomically promote the newest snapshot", async () => {
  const writes = [];
  const releases = [];
  const persistence = createPersistence({
    dbPath: "/tmp/ticketground-persistence-test/db.json",
    hash: () => "",
    now: () => "",
    sortJson: (value) => value,
    chmodImpl: async () => {},
    writeFileImpl: async (filePath, snapshot) => {
      writes.push({ filePath, snapshot });
      await new Promise((resolve) => releases.push(resolve));
    },
    renameImpl: async () => {}
  });

  const firstSave = persistence.saveDb({ revision: 1 });
  await new Promise((resolve) => setImmediate(resolve));
  const secondSave = persistence.saveDb({ revision: 2 });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(writes.length, 1);
  assert.match(writes[0].filePath, /\.pending$/);
  releases.shift()();
  await firstSave;
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(writes.length, 2);
  assert.equal(JSON.parse(writes[1].snapshot).revision, 2);
  releases.shift()();
  await secondSave;
});

test("database snapshot promotion preserves restrictive file permissions", async (t) => {
  // Given: an operator-protected database file.
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "ticketground-persistence-mode-"));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  const dbPath = path.join(dataDir, "db.json");
  await writeFile(dbPath, "{}", { mode: 0o600 });
  await chmod(dbPath, 0o600);
  const persistence = createPersistence({
    dbPath,
    hash: () => "",
    now: () => "",
    sortJson: (value) => value
  });

  // When: a new snapshot replaces the protected inode.
  await persistence.saveDb({ revision: 1 });

  // Then: account and payment metadata remain owner-readable only.
  assert.equal((await stat(dbPath)).mode & 0o777, 0o600);
});
