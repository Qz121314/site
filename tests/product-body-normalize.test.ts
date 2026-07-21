import assert from "node:assert/strict";
import test from "node:test";
import { normalizeProductBodyLists } from "../src/lib/admin/product-body-normalize.ts";

test("separates unordered and ordered list runs", () => {
  assert.equal(
    normalizeProductBodyLists("1. First\n2. Second\n- Third\n- Fourth"),
    "1. First\n2. Second\n\n- Third\n- Fourth",
  );
});

test("keeps markers inside code blocks unchanged", () => {
  const source = "```\n1. code\n- code\n```\n- real";
  assert.equal(normalizeProductBodyLists(source), source);
});
