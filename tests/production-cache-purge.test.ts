import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("production smoke purges public edge caches before verification", async () => {
  const [packageJson, purgeScript] = await Promise.all([
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../scripts/purge-production-cache.mjs", import.meta.url), "utf8"),
  ]);

  const packageData = JSON.parse(packageJson) as { scripts?: Record<string, string> };
  assert.equal(
    packageData.scripts?.["verify:production-smoke"],
    "node scripts/purge-production-cache.mjs && node scripts/verify-production-smoke.mjs",
  );

  assert.match(purgeScript, /new URL\("\/api\/admin\/login", origin\)/u);
  assert.match(purgeScript, /login\.headers\.get\("set-cookie"\)/u);
  assert.match(purgeScript, /new URL\("\/api\/admin\/cache\/purge", origin\)/u);
  assert.match(purgeScript, /location\.searchParams\.get\("cache"\) !== "refreshed"/u);
  assert.match(purgeScript, /production-cache-purge\.json/u);
});

test("discovery documents use the bounded edge cache duration", async () => {
  const [cachePolicy, sitemap, robots] = await Promise.all([
    readFile(new URL("../src/lib/public/cache-policy.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/sitemap.xml.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/robots.txt.ts", import.meta.url), "utf8"),
  ]);

  assert.match(cachePolicy, /PUBLIC_DISCOVERY_EDGE_CACHE_SECONDS = 3_600/u);
  assert.match(sitemap, /PUBLIC_DISCOVERY_EDGE_CACHE_SECONDS/u);
  assert.doesNotMatch(sitemap, /PUBLIC_EDGE_CACHE_SECONDS/u);
  assert.match(robots, /PUBLIC_DISCOVERY_EDGE_CACHE_SECONDS/u);
  assert.doesNotMatch(robots, /PUBLIC_EDGE_CACHE_SECONDS/u);
});
