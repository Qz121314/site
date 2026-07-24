import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ORIGIN = "http://127.0.0.1:8787";
const LOG_DIR = "ci-logs";
const CHROME_TIMEOUT_MS = 45_000;
const CHROME_ATTEMPTS = 2;
let chromeRunSequence = 0;

function findChrome() {
  for (const candidate of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
    const result = spawnSync("which", [candidate], { encoding: "utf8" });
    if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();
  }
  throw new Error("Headless Chrome was not found on this runner.");
}

async function waitForServer() {
  let lastError = null;
  for (let attempt = 0; attempt < 45; attempt += 1) {
    try {
      const response = await fetch(`${ORIGIN}/robots.txt`, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) return;
      lastError = new Error(`Server returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`Local Worker did not become ready: ${String(lastError)}`);
}

async function requestText(pathname, accept = "text/html") {
  const response = await fetch(`${ORIGIN}${pathname}`, {
    headers: { Accept: accept },
    signal: AbortSignal.timeout(5_000),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`${pathname} returned ${response.status}: ${body.slice(0, 300)}`);
  return { response, body };
}

async function requestJson(pathname) {
  const { response, body } = await requestText(pathname, "application/json");
  try {
    return { response, payload: JSON.parse(body) };
  } catch {
    throw new Error(`${pathname} did not return valid JSON.`);
  }
}

function runChrome(chrome, args, outputPath = null) {
  const profileArgument = args.find((argument) => argument.startsWith("--user-data-dir="));
  const profileRoot = profileArgument?.slice("--user-data-dir=".length) ?? null;
  const stableArgs = args.filter((argument) => argument !== profileArgument);
  const runSequence = ++chromeRunSequence;
  let lastFailure = "unknown Chrome failure";

  for (let attempt = 1; attempt <= CHROME_ATTEMPTS; attempt += 1) {
    const attemptArgs = profileRoot
      ? [`--user-data-dir=${join(profileRoot, `run-${runSequence}-attempt-${attempt}`)}`, ...stableArgs]
      : stableArgs;
    const result = spawnSync(chrome, [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--disable-background-networking",
      "--disable-component-update",
      "--no-first-run",
      "--hide-scrollbars",
      "--run-all-compositor-stages-before-draw",
      "--virtual-time-budget=7000",
      ...attemptArgs,
    ], {
      encoding: outputPath ? "utf8" : undefined,
      maxBuffer: 10 * 1024 * 1024,
      timeout: CHROME_TIMEOUT_MS,
      killSignal: "SIGKILL",
    });

    if (!result.error && result.status === 0) {
      if (outputPath) writeFileSync(outputPath, result.stdout ?? "");
      return;
    }

    lastFailure = result.error
      ? result.error.message
      : `status ${result.status}: ${result.stderr?.toString() ?? ""}`;
  }

  throw new Error(`Chrome process failed after ${CHROME_ATTEMPTS} attempts: ${lastFailure}`);
}

function runCommand(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", env: { ...process.env, FORCE_COLOR: "0" } });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
  }
}

function assertDocument(path, requirements) {
  const html = readFileSync(path, "utf8");
  const visibleHtml = html.replace(/<script\b[\s\S]*?<\/script>/giu, "");
  for (const requirement of requirements) {
    if (!html.includes(requirement)) throw new Error(`${path} is missing ${requirement}`);
  }
  for (const forbidden of ["Temporarily unavailable", "数据服务暂不可用", "SERVICE_UNAVAILABLE"]) {
    if (visibleHtml.includes(forbidden)) throw new Error(`${path} contains service unavailable output.`);
  }
}

function assertAffiliateAdContract() {
  const componentSource = readFileSync("src/components/public/AffiliateAds.astro", "utf8");
  const interactionSource = readFileSync("src/scripts/public-affiliate-ads.ts", "utf8");
  const candidateSource = readFileSync("src/lib/db/public-ads.ts", "utf8");
  const productSource = readFileSync("src/pages/[channel]/product/[product].astro", "utf8");
  const gallerySource = readFileSync("src/components/public/ProductGallery.astro", "utf8");
  const productAdComponentSource = readFileSync("src/components/public/DesktopProductAd.astro", "utf8");
  const productAdInteractionSource = readFileSync("src/scripts/public-product-detail-ad.ts", "utf8");

  for (const requirement of [
    "data-affiliate-ad-context",
    "AFFILIATE_AD_REQUEST_DELAY_MS = 2500",
    'import("@/scripts/public-affiliate-ads")',
    "DOMContentLoaded",
  ]) {
    if (!componentSource.includes(requirement)) throw new Error(`Affiliate ad component contract is missing: ${requirement}`);
  }
  for (const requirement of [
    "waitForAdvertisementStart",
    "public:products-appended",
    "affiliate-ad-modal-dismissed",
    "allow-popups-to-escape-sandbox",
  ]) {
    if (!interactionSource.includes(requirement)) throw new Error(`Affiliate ad interaction contract is missing: ${requirement}`);
  }
  if (!candidateSource.includes("Math.random()")) {
    throw new Error("Affiliate ad candidate resolution must randomize in Worker code.");
  }
  if (/ORDER BY RANDOM\(\)|\.sort\(/u.test(candidateSource)) {
    throw new Error("Affiliate ad candidate resolution must not use random SQL ordering or full array sorting.");
  }
  if (/AffiliateAds|data-affiliate-ad-context/u.test(productSource)) {
    throw new Error("Product detail must not use the generic catalog advertising bootstrap.");
  }
  for (const requirement of [
    "DesktopProductAd",
    "PRODUCT_DETAIL_AD_MIN_WIDTH = 1400",
    'import("@/scripts/public-product-detail-ad")',
    "ads?device=desktop",
  ]) {
    const sources = [gallerySource, productAdComponentSource, productAdInteractionSource];
    if (!sources.some((source) => source.includes(requirement))) {
      throw new Error(`Desktop product advertisement contract is missing: ${requirement}`);
    }
  }
}

function assertChannelNavigationCount(path, expectedCount) {
  const html = readFileSync(path, "utf8");
  const itemCount = (html.match(/class="public-nav-item"/g) ?? []).length;
  if (itemCount !== expectedCount) {
    throw new Error(`${path} rendered ${itemCount} channel navigation items; expected ${expectedCount}.`);
  }
}

mkdirSync(LOG_DIR, { recursive: true });
assertAffiliateAdContract();
const chrome = findChrome();
const userDataDir = join(tmpdir(), `site-browser-smoke-${process.pid}`);
const persistDir = join(tmpdir(), `site-browser-smoke-d1-${process.pid}`);
mkdirSync(userDataDir, { recursive: true });
mkdirSync(persistDir, { recursive: true });
runCommand("pnpm", ["exec", "wrangler", "d1", "migrations", "apply", "DB", "--local", "--persist-to", persistDir]);
runCommand("pnpm", ["exec", "wrangler", "d1", "execute", "DB", "--local", "--persist-to", persistDir, "--file", "scripts/fixtures/browser-smoke.sql"]);
const serverStdout = openSync(`${LOG_DIR}/browser-worker.log`, "w");
const serverStderr = openSync(`${LOG_DIR}/browser-worker-error.log`, "w");
const server = spawn("pnpm", [
  "exec",
  "wrangler",
  "dev",
  "--local",
  "--port",
  "8787",
  "--persist-to",
  persistDir,
  "--var",
  "ADMIN_PASSWORD:browser-smoke-password",
  "--var",
  "SESSION_SECRET:browser-smoke-session-secret-0123456789",
], {
  env: { ...process.env, FORCE_COLOR: "0" },
  stdio: ["ignore", serverStdout, serverStderr],
});

try {
  await waitForServer();

  const searchResult = await requestText("/demo/search?q=Smoke");
  if (!searchResult.body.includes("Smoke Product")) {
    throw new Error("Public search did not return the fixture product.");
  }

  const productApi = await requestJson("/api/public/channels/demo/products?page=1");
  if (
    !Array.isArray(productApi.payload?.products)
    || productApi.payload.products[0]?.slug !== "smoke-product"
  ) {
    throw new Error("Public product API did not return the fixture product.");
  }

  const mobileAds = await requestJson("/api/public/channels/demo/ads?device=mobile");
  const desktopAds = await requestJson("/api/public/channels/demo/ads?device=desktop");
  if (
    mobileAds.payload?.ok !== true
    || mobileAds.payload?.candidates?.banners?.[0]?.name !== "Mobile Smoke Banner"
    || desktopAds.payload?.ok !== true
    || desktopAds.payload?.candidates?.banners?.[0]?.name !== "Desktop Smoke Banner"
  ) {
    throw new Error("Affiliate ad resolver did not return device-scoped fixture candidates.");
  }

  const contact = await requestJson("/go/smoke-product?channel=demo");
  if (
    contact.payload?.ok !== true
    || contact.payload.contact?.type !== "link"
    || contact.payload.contact?.target !== "https://example.com/contact"
  ) {
    throw new Error("Conversion resolver did not return the configured fixture target.");
  }

  runChrome(chrome, [
    `--user-data-dir=${userDataDir}`,
    "--window-size=390,844",
    `--screenshot=${LOG_DIR}/public-mobile.png`,
    `${ORIGIN}/`,
  ]);
  runChrome(chrome, [
    `--user-data-dir=${userDataDir}`,
    "--window-size=834,1112",
    `--screenshot=${LOG_DIR}/public-tablet.png`,
    `${ORIGIN}/`,
  ]);
  runChrome(chrome, [
    `--user-data-dir=${userDataDir}`,
    "--window-size=1440,1000",
    `--screenshot=${LOG_DIR}/public-desktop.png`,
    `${ORIGIN}/`,
  ]);
  runChrome(chrome, [
    `--user-data-dir=${userDataDir}`,
    "--window-size=390,844",
    "--dump-dom",
    `${ORIGIN}/demo?category=people`,
  ], `${LOG_DIR}/public-browser-dom.html`);
  runChrome(chrome, [
    `--user-data-dir=${userDataDir}`,
    "--window-size=834,1112",
    "--dump-dom",
    `${ORIGIN}/demo?category=people`,
  ], `${LOG_DIR}/public-tablet-browser-dom.html`);
  runChrome(chrome, [
    `--user-data-dir=${userDataDir}`,
    "--window-size=1440,1000",
    "--dump-dom",
    `${ORIGIN}/demo?category=people`,
  ], `${LOG_DIR}/public-desktop-browser-dom.html`);
  runChrome(chrome, [
    `--user-data-dir=${userDataDir}`,
    "--window-size=390,844",
    "--dump-dom",
    `${ORIGIN}/demo/product/smoke-product`,
  ], `${LOG_DIR}/public-product-mobile-browser-dom.html`);
  runChrome(chrome, [
    `--user-data-dir=${userDataDir}`,
    "--window-size=1440,1000",
    "--dump-dom",
    `${ORIGIN}/demo/product/smoke-product`,
  ], `${LOG_DIR}/public-product-browser-dom.html`);
  runChrome(chrome, [
    `--user-data-dir=${userDataDir}`,
    "--window-size=390,844",
    "--dump-dom",
    `${ORIGIN}/admin/login`,
  ], `${LOG_DIR}/admin-login-browser-dom.html`);

  assertDocument(`${LOG_DIR}/public-browser-dom.html`, ["<html", "Smoke Product", "People", "aria-current=\"page\"", "data-affiliate-ad"]);
  assertDocument(`${LOG_DIR}/public-tablet-browser-dom.html`, ["<html", "Smoke Product", "data-affiliate-ad", "public-footer"]);
  assertDocument(`${LOG_DIR}/public-desktop-browser-dom.html`, ["<html", "Smoke Product", "data-affiliate-ad", "public-footer"]);
  assertChannelNavigationCount(`${LOG_DIR}/public-browser-dom.html`, 4);
  assertChannelNavigationCount(`${LOG_DIR}/public-tablet-browser-dom.html`, 4);
  assertChannelNavigationCount(`${LOG_DIR}/public-desktop-browser-dom.html`, 4);
  assertDocument(`${LOG_DIR}/public-product-mobile-browser-dom.html`, [
    "Smoke Product",
    "Smoke product body",
    "data-contact-cta",
    "href=\"/demo?category=people\"",
  ]);
  const mobileProductHtml = readFileSync(`${LOG_DIR}/public-product-mobile-browser-dom.html`, "utf8");
  if (
    mobileProductHtml.includes("data-affiliate-ad-type=\"product-detail\"")
    || mobileProductHtml.includes("<aside class=\"product-detail-ad-slot\"")
  ) {
    throw new Error("Mobile product detail mounted a desktop advertisement.");
  }
  assertDocument(`${LOG_DIR}/public-product-browser-dom.html`, [
    "Smoke Product",
    "Smoke product body",
    "data-contact-cta",
    "href=\"/demo?category=people\"",
    "data-product-detail-ad-slot",
    "data-affiliate-ad-type=\"product-detail\"",
  ]);
  assertDocument(`${LOG_DIR}/admin-login-browser-dom.html`, ["<html", "<form"]);
  console.log("Headless Chrome and local Worker routes verified search, pagination, catalog ads, desktop-only product ads, conversion, and mobile/tablet/desktop rendering.");
} finally {
  server.kill("SIGTERM");
  await new Promise((resolve) => setTimeout(resolve, 500));
  if (server.exitCode === null) server.kill("SIGKILL");
  rmSync(userDataDir, { recursive: true, force: true });
  rmSync(persistDir, { recursive: true, force: true });
}
