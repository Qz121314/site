import { readFileSync, writeFileSync } from "node:fs";

function replaceRequired(source, pattern, replacement, label) {
  const next = source.replace(pattern, replacement);
  if (next === source) throw new Error(`Expected ${label} pattern was not found.`);
  return next;
}

const middlewarePath = "src/middleware.ts";
let middleware = readFileSync(middlewarePath, "utf8");
middleware = replaceRequired(
  middleware,
  '  if (request.method !== "GET" && request.method !== "HEAD") return false;\n',
  '  if (request.method !== "GET" && request.method !== "HEAD") return false;\n  if (readCookie(request.headers.get("Cookie"), SESSION_COOKIE)) return false;\n',
  "admin preview cache bypass",
);
middleware = replaceRequired(
  middleware,
  '`public, max-age=${PUBLIC_EDGE_CACHE_SECONDS}, stale-while-revalidate=${PUBLIC_EDGE_CACHE_SECONDS * 2}`',
  '`public, max-age=${PUBLIC_EDGE_CACHE_SECONDS}, must-revalidate`',
  "middleware stale-while-revalidate",
);
writeFileSync(middlewarePath, middleware);

const apiPath = "src/pages/api/public/channels/[channel]/products.ts";
let api = readFileSync(apiPath, "utf8");
api = replaceRequired(
  api,
  '`public, max-age=${PUBLIC_EDGE_CACHE_SECONDS}, stale-while-revalidate=${PUBLIC_EDGE_CACHE_SECONDS * 2}`',
  '`public, max-age=${PUBLIC_EDGE_CACHE_SECONDS}, must-revalidate`',
  "public API stale-while-revalidate",
);
writeFileSync(apiPath, api);

const settingsPath = "src/pages/admin/settings.astro";
let settings = readFileSync(settingsPath, "utf8");
const freshnessText = "公共页面缓存最长约 30 秒；登录后台的当前浏览器打开前台预览时不使用公共缓存。";
const patterns = [
  /[^<>\n]*前台刷新后立即生效[^<>\n]*/u,
  /[^<>\n]*保存后[^<>\n]*前台刷新[^<>\n]*生效[^<>\n]*/u,
  /[^<>\n]*立即生效[^<>\n]*/u,
];
let replaced = false;
for (const pattern of patterns) {
  if (!pattern.test(settings)) continue;
  settings = settings.replace(pattern, freshnessText);
  replaced = true;
  break;
}
if (!replaced) throw new Error("Expected admin cache freshness text was not found.");
writeFileSync(settingsPath, settings);
