import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("admin history entries preserve and restore scroll positions", async () => {
  const [layout, navigationState, collection] = await Promise.all([
    readFile(new URL("../src/layouts/AdminLayout.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/scripts/admin-navigation-state.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/scripts/admin-collection-workspace.ts", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /admin-navigation-state";\s*import "@\/scripts\/admin-router/u);
  assert.match(navigationState, /history\.scrollRestoration = "manual"/u);
  assert.match(navigationState, /adminScrollX/u);
  assert.match(navigationState, /adminScrollY/u);
  assert.match(navigationState, /addEventListener\("popstate"/u);
  assert.match(navigationState, /addEventListener\("admin:navigation"[\s\S]*requestAnimationFrame[\s\S]*scrollTo/u);
  assert.match(navigationState, /canonicalUrl\(window\.location\.href\) !== targetUrl/u);
  assert.match(collection, /adminUrl: url\.href/u);
  assert.match(collection, /adminScrollY: Math\.max\(0, window\.scrollY\)/u);
});
