import assert from "node:assert/strict";
import test from "node:test";
import { commitHistory, createHistory, redoHistory, undoHistory } from "../src/lib/seat-designer/history.ts";

test("one pointer transaction produces one undo step and redo restores selection", () => {
  const initial = { document: { value: 1 }, selection: ["a"] };
  const committed = commitHistory(createHistory(initial), { document: { value: 2 }, selection: ["b"] });
  assert.equal(committed.past.length, 1);
  const undone = undoHistory(committed);
  assert.deepEqual(undone.present, initial);
  assert.deepEqual(redoHistory(undone).present, { document: { value: 2 }, selection: ["b"] });
});

test("history is bounded and preview updates do not create entries", () => {
  let history = createHistory({ document: { value: 0 }, selection: [] }, 3);
  for (let value = 1; value <= 5; value += 1) history = commitHistory(history, { document: { value }, selection: [] });
  assert.equal(history.past.length, 3);
  assert.equal(history.present.document.value, 5);
});
