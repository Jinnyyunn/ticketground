import assert from "node:assert/strict";
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
