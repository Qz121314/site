import { readFileSync, writeFileSync } from "node:fs";

function replaceRequired(source, pattern, replacement, label) {
  const next = source.replace(pattern, replacement);
  if (next === source) throw new Error(`Expected ${label} pattern was not found.`);
  return next;
}

function update(path, transform) {
  const source = readFileSync(path, "utf8");
  const next = transform(source);
  if (next === source) throw new Error(`No changes generated for ${path}`);
  writeFileSync(path, next);
}

update("src/pages/admin/channels/[channelId]/products.astro", (source) => replaceRequired(
  source,
  "{ products: [], total: 0, page: 1, pageCount: 1, pageSize: 50, r2PublicBaseUrl: \"\" }",
  "{ products: [], total: 0, page: 1, pageCount: 1, pageSize: 30, r2PublicBaseUrl: \"\" }",
  "product fallback page size",
));

update("src/pages/admin/channels/[channelId]/conversions.astro", (source) => replaceRequired(
  source,
  "grid-template-columns: repeat(auto-fill, minmax(min(100%, 30rem), 34rem));",
  "grid-template-columns: repeat(auto-fill, minmax(min(100%, 29rem), 33rem));",
  "conversion resource multi-column tracks",
));
