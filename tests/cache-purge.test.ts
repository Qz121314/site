import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const endpointPath = new URL("../src/pages/api/admin/cache/purge.ts", import.meta.url);
const layoutPath = new URL("../src/layouts/AdminLayout.astro", import.meta.url);
const publicDbPath = new URL("../src/lib/db/public.ts", import.meta.url);

test("admin cache refresh is authenticated, same-origin, and globally purges Workers Cache", async () => {
  const [endpoint, layout, publicDb] = await Promise.all([
    readFile(endpointPath, "utf8"),
    readFile(layoutPath, "utf8"),
    readFile(publicDbPath, "utf8"),
  ]);

  assert.match(endpoint, /isSameOriginPost\(request\)/u);
  assert.match(endpoint, /cache\.purge\(\{ purgeEverything: true \}\)/u);
  assert.match(endpoint, /if \(!result\.success\)/u);
  assert.match(endpoint, /clearPublicSiteShellCache\(\)/u);
  assert.match(publicDb, /export function clearPublicSiteShellCache\(\): void/u);
  assert.match(publicDb, /siteShellCache\.clear\(\)/u);
  assert.match(layout, /action="\/api\/admin\/cache\/purge" method="post"/u);
  assert.match(layout, />刷新前台缓存</u);
});
