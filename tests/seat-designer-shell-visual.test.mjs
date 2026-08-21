import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the replacement shell owns its visual structure and stable controls without legacy editor imports", async () => {
  const [page, shell, tools, inspector, start] = await Promise.all([
    readFile("src/app/admin/seat-designer/page.tsx", "utf8"),
    readFile("src/components/seat-designer-v2/seat-designer-v2.tsx", "utf8"),
    readFile("src/components/seat-designer-v2/toolbar.tsx", "utf8"),
    readFile("src/components/seat-designer-v2/inspector.tsx", "utf8"),
    readFile("src/components/seat-designer-v2/reference-start.tsx", "utf8"),
  ]);
  assert.match(page, /seat-designer-v2\/seat-designer-v2/);
  assert.doesNotMatch(page, /components\/seat-designer\/seat-designer/);
  assert.match(shell, /seat-designer-v2-shell/);
  assert.match(shell, /seat-designer-v2-canvas/);
  assert.match(shell, /aria-label="좌석 배치도 이름"/);
  assert.match(shell, />\s*게시\s*</);
  assert.match(tools, /aria-label="좌석 배치 도구"/);
  assert.match(tools, /data-testid={`seat-designer-v2-tool-\$\{primary\}`}/);
  assert.match(inspector, /seat-designer-v2-inspector/);
  assert.match(start, /공연장 좌석 배치도 불러오기/);
  assert.match(start, /적용 공연장/);
  assert.match(start, /application\/pdf/);
  assert.doesNotMatch(`${shell}\n${tools}\n${inspector}\n${start}`, /@\/components\/seat-designer\//);
  assert.doesNotMatch(`${shell}\n${tools}\n${inspector}\n${start}`, /@\/lib\/seat-designer\//);
});
