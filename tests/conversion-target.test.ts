import assert from "node:assert/strict";
import test from "node:test";
import { normalizeConversionTarget } from "../src/lib/public/conversion-target.ts";

test("keeps safe HTTP and HTTPS URLs", () => {
  assert.equal(normalizeConversionTarget({ type: "url", value: "https://example.com/path?q=1" }), "https://example.com/path?q=1");
  assert.equal(normalizeConversionTarget({ type: "url", value: "http://example.com" }), "http://example.com");
});

test("rejects unsafe URL schemes and credentials", () => {
  assert.equal(normalizeConversionTarget({ type: "url", value: "javascript:alert(1)" }), null);
  assert.equal(normalizeConversionTarget({ type: "url", value: "https://user:pass@example.com" }), null);
});

test("normalizes phone targets", () => {
  assert.equal(normalizeConversionTarget({ type: "phone", value: "+1 (212) 555-0100" }), "tel:+12125550100");
});

test("normalizes WhatsApp phone and URL targets", () => {
  assert.equal(normalizeConversionTarget({ type: "whatsapp", value: "+1 212 555 0100" }), "https://wa.me/12125550100");
  assert.equal(normalizeConversionTarget({ type: "whatsapp", value: "https://wa.me/12125550100" }), "https://wa.me/12125550100");
});

test("normalizes Telegram handles and URLs", () => {
  assert.equal(normalizeConversionTarget({ type: "telegram", value: "@example_user" }), "https://t.me/example_user");
  assert.equal(normalizeConversionTarget({ type: "telegram", value: "https://t.me/example_user" }), "https://t.me/example_user");
  assert.equal(normalizeConversionTarget({ type: "telegram", value: "bad handle" }), null);
});

test("normalizes email targets", () => {
  assert.equal(normalizeConversionTarget({ type: "email", value: "sales@example.com" }), "mailto:sales@example.com");
  assert.equal(normalizeConversionTarget({ type: "email", value: "not-an-email" }), null);
});
