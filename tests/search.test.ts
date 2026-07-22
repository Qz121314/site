import assert from "node:assert/strict";
import test from "node:test";
import { normalizePublicSearchQuery } from "../src/lib/search/query.ts";
import { rankSearchResults } from "../src/lib/search/ranking.ts";

test("normalizePublicSearchQuery removes SQL LIKE wildcard characters", () => {
  assert.equal(normalizePublicSearchQuery("  premium%__service  "), "premium service");
});

test("normalizePublicSearchQuery respects the UTF-8 byte limit", () => {
  assert.equal(new TextEncoder().encode(normalizePublicSearchQuery("你".repeat(30))).byteLength <= 48, true);
});

test("rankSearchResults prioritizes exact and prefix title matches", () => {
  const items = [
    { title: "Luxury Example", tags: ["premium"] },
    { title: "Example", tags: ["luxury"] },
    { title: "Other", tags: ["example"] },
  ];

  assert.deepEqual(
    rankSearchResults(items, "example", (item) => [item.title, ...item.tags]).map((item) => item.title),
    ["Example", "Luxury Example", "Other"],
  );
});
