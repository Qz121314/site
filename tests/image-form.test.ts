import assert from "node:assert/strict";
import test from "node:test";
import {
  inspectImage,
  normalizeOriginalName,
} from "../src/lib/admin/image-form.ts";

function writeUint32BigEndian(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}

function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  writeUint32BigEndian(bytes, 16, width);
  writeUint32BigEndian(bytes, 20, height);
  return bytes;
}

function jpeg(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(21);
  bytes.set([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08], 0);
  bytes[7] = (height >>> 8) & 0xff;
  bytes[8] = height & 0xff;
  bytes[9] = (width >>> 8) & 0xff;
  bytes[10] = width & 0xff;
  return bytes;
}

function webpExtended(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(30);
  bytes.set(Buffer.from("RIFF"), 0);
  bytes.set(Buffer.from("WEBP"), 8);
  bytes.set(Buffer.from("VP8X"), 12);
  const encodedWidth = width - 1;
  const encodedHeight = height - 1;
  bytes[24] = encodedWidth & 0xff;
  bytes[25] = (encodedWidth >>> 8) & 0xff;
  bytes[26] = (encodedWidth >>> 16) & 0xff;
  bytes[27] = encodedHeight & 0xff;
  bytes[28] = (encodedHeight >>> 8) & 0xff;
  bytes[29] = (encodedHeight >>> 16) & 0xff;
  return bytes;
}

test("inspects PNG dimensions", () => {
  assert.deepEqual(inspectImage(png(320, 240), "image/png"), {
    mimeType: "image/png",
    extension: "png",
    width: 320,
    height: 240,
  });
});

test("inspects JPEG dimensions", () => {
  assert.deepEqual(inspectImage(jpeg(640, 480), "image/jpeg"), {
    mimeType: "image/jpeg",
    extension: "jpg",
    width: 640,
    height: 480,
  });
});

test("inspects extended WebP dimensions", () => {
  assert.deepEqual(inspectImage(webpExtended(800, 600), "image/webp"), {
    mimeType: "image/webp",
    extension: "webp",
    width: 800,
    height: 600,
  });
});

test("rejects mismatched declared MIME type", () => {
  assert.equal(inspectImage(png(100, 100), "image/jpeg"), null);
});

test("rejects invalid or excessive dimensions", () => {
  assert.equal(inspectImage(png(0, 100), "image/png"), null);
  assert.equal(inspectImage(png(12_001, 100), "image/png"), null);
});

test("normalizes uploaded file names", () => {
  assert.equal(normalizeOriginalName("C:\\uploads\\  hero   image.webp  "), "hero image.webp");
  assert.equal(normalizeOriginalName("\u0000\u0001"), "image");
  assert.equal(normalizeOriginalName(`/${"a".repeat(200)}.png`).length, 180);
});
