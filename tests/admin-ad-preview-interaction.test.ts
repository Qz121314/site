import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("only the latest advertisement preview may update the form", async () => {
  const source = await readFile(
    new URL("../src/scripts/admin-ad-form.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /const previewVersions = new WeakMap/u);
  assert.match(source, /function invalidatePreview/u);
  assert.match(source, /resetPreview\(form[\s\S]*invalidatePreview\(form\)/u);
  assert.match(source, /const version = invalidatePreview\(form\)/u);
  assert.ok((source.match(/previewIsCurrent\(form, version\)/gu) ?? []).length >= 5);
  assert.match(source, /image\.onerror = \(\) => \{[\s\S]*previewIsCurrent[\s\S]*stage\.replaceChildren/u);
});
