import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateSitemapResponse } from "../scripts/lib/sitemap-smoke.mjs";

const origin = "https://example.com";

function response(status = 200, contentType = "application/xml; charset=utf-8"): Response {
  return new Response(null, { status, headers: { "Content-Type": contentType } });
}

test("production sitemap validation accepts canonical same-origin entries", () => {
  const result = validateSitemapResponse(response(), `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url><loc>https://example.com/demo</loc><lastmod>2026-07-24T05:00:00.000Z</lastmod></url>
      <url><loc>https://example.com/demo?category=people&amp;page=2</loc></url>
    </urlset>`, origin);

  assert.deepEqual(result, { ok: true, detail: "2 sitemap URLs" });
});

test("production sitemap validation rejects malformed metadata and foreign origins", () => {
  assert.equal(validateSitemapResponse(response(), `
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url><loc>https://other.example/demo</loc></url>
    </urlset>`, origin).ok, false);

  assert.equal(validateSitemapResponse(response(), `
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url><loc>https://example.com/demo</loc><lastmod>2026-07-24T07:00:00+02:00Z</lastmod></url>
    </urlset>`, origin).ok, false);

  assert.equal(validateSitemapResponse(response(200, "text/html"), "<html></html>", origin).ok, false);
});

test("production deployment smoke invokes sitemap validation", async () => {
  const source = await readFile(
    new URL("../scripts/verify-production-smoke.mjs", import.meta.url),
    "utf8",
  );

  assert.match(source, /import \{ validateSitemapResponse \} from "\.\/lib\/sitemap-smoke\.mjs"/u);
  assert.match(source, /requestWithRetries\(\s*"\/sitemap\.xml"[\s\S]*validateSitemapResponse\(response, body, origin\)/u);
});
