import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeConversionResource,
  normalizeConversionTarget,
} from "../src/lib/public/conversion-target.ts";

test("keeps safe HTTP and HTTPS links", () => {
  assert.equal(normalizeConversionTarget({ type: "link", value: "https://example.com/path?q=1" }), "https://example.com/path?q=1");
  assert.equal(normalizeConversionTarget({ type: "link", value: "http://example.com" }), "http://example.com/");
});

test("supports mailto links", () => {
  assert.equal(normalizeConversionTarget({ type: "link", value: "mailto:sales@example.com" }), "mailto:sales@example.com");
  assert.equal(normalizeConversionResource({ type: "link", value: "mailto:sales@example.com" })?.display, "sales@example.com");
});

test("rejects unsafe link schemes and credentials", () => {
  assert.equal(normalizeConversionTarget({ type: "link", value: "javascript:alert(1)" }), null);
  assert.equal(normalizeConversionTarget({ type: "link", value: "https://user:pass@example.com" }), null);
});

test("normalizes SMS targets and preserves display value", () => {
  const contact = normalizeConversionResource({ type: "sms", value: "+1 (212) 555-0100" });
  assert.equal(contact?.target, "sms:+12125550100");
  assert.equal(contact?.display, "+1 (212) 555-0100");
});

test("rejects malformed SMS numbers", () => {
  assert.equal(normalizeConversionTarget({ type: "sms", value: "hello" }), null);
  assert.equal(normalizeConversionTarget({ type: "sms", value: "123" }), null);
});
