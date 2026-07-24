import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  normalizePublicAbsoluteUrl,
  resolvePublicOrigin,
} from "../src/lib/public/origin.ts";

const internalUrl = new URL("http://site.fcqz121314.workers.dev/demo?page=2");

test("public origin prefers Cloudflare forwarded HTTPS", () => {
  assert.equal(
    resolvePublicOrigin(internalUrl, new Headers({ "X-Forwarded-Proto": "https" })),
    "https://site.fcqz121314.workers.dev",
  );

  assert.equal(
    resolvePublicOrigin(internalUrl, new Headers({ "CF-Visitor": '{"scheme":"https"}' })),
    "https://site.fcqz121314.workers.dev",
  );
});

test("public origin preserves local HTTP without forwarding metadata", () => {
  assert.equal(
    resolvePublicOrigin(new URL("http://127.0.0.1:8787/demo"), new Headers()),
    "http://127.0.0.1:8787",
  );
});

test("same-origin metadata URLs inherit the forwarded protocol", () => {
  assert.equal(
    normalizePublicAbsoluteUrl(
      "http://site.fcqz121314.workers.dev/demo?category=people#results",
      internalUrl,
      new Headers({ "X-Forwarded-Proto": "https" }),
    ),
    "https://site.fcqz121314.workers.dev/demo?category=people#results",
  );
  assert.equal(
    normalizePublicAbsoluteUrl(
      "https://media.example.com/image.webp",
      internalUrl,
      new Headers({ "X-Forwarded-Proto": "https" }),
    ),
    "https://media.example.com/image.webp",
  );
});

test("middleware forwards the normalized GET request after auth and readiness checks", async () => {
  const source = await readFile(new URL("../src/middleware.ts", import.meta.url), "utf8");
  const readinessPosition = source.indexOf("requiresApplicationData(context.request, pathname)");
  const normalizedRequestPosition = source.indexOf("const request = downstreamRequest(context)");

  assert.ok(readinessPosition >= 0);
  assert.ok(normalizedRequestPosition > readinessPosition);
  assert.match(source, /context\.request\.method !== "GET" && context\.request\.method !== "HEAD"/u);
  assert.match(source, /return addSecurityHeaders\(await next\(request\), request, pathname\)/u);
});
