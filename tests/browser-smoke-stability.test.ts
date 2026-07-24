import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("browser smoke retries only the deferred desktop ad timing failure", async () => {
  const [packageJson, wrapper] = await Promise.all([
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../scripts/verify-browser-smoke-stable.mjs", import.meta.url), "utf8"),
  ]);

  const packageData = JSON.parse(packageJson) as { scripts?: Record<string, string> };
  assert.equal(
    packageData.scripts?.["verify:browser-smoke"],
    "node scripts/verify-browser-smoke-stable.mjs && node scripts/verify-admin-crud-smoke-stable.mjs && node scripts/verify-admin-pools-smoke.mjs",
  );

  assert.match(wrapper, /MAX_ATTEMPTS = 2/u);
  assert.match(wrapper, /verify-browser-smoke\.mjs/u);
  assert.match(wrapper, /public-product-browser-dom\\\.html is missing data-affiliate-ad-type/u);
  assert.match(wrapper, /if \(!retryable \|\| attempt === MAX_ATTEMPTS\) process\.exit/u);
  assert.doesNotMatch(wrapper, /business|database|migration|binding/iu);
});
