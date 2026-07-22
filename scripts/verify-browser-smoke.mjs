import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ORIGIN = "http://127.0.0.1:8787";
const LOG_DIR = "ci-logs";

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

function runChrome(chrome, args, outputPath = null) {
  const result = spawnSync(chrome, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--hide-scrollbars",
    "--run-all-compositor-stages-before-draw",
    "--virtual-time-budget=3000",
    ...args,
  ], {
    encoding: outputPath ? "utf8" : undefined,
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.status !== 0) {
    throw new Error(`Chrome failed with status ${result.status}: ${result.stderr?.toString() ?? ""}`);
  }
  if (outputPath) writeFileSync(outputPath, result.stdout ?? "");
}

function assertDocument(path, requirements) {
  const html = readFileSync(path, "utf8");
  for (const requirement of requirements) {
    if (!html.includes(requirement)) throw new Error(`${path} is missing ${requirement}`);
  }
  for (const forbidden of ["Temporarily unavailable", "数据服务暂不可用", "SERVICE_UNAVAILABLE"]) {
    if (html.includes(forbidden)) throw new Error(`${path} contains service unavailable output.`);
  }
}

function assertHeroInteractionContract() {
  const source = readFileSync("src/components/public/HeroCarousel.astro", "utf8");
  const requirements = [
    'href={advertisement.targetUrl}',
    'draggable="false"',
    'const DRAG_START_THRESHOLD = 6',
    'if (!dragging && Math.abs(distance) >= DRAG_START_THRESHOLD)',
    "track.setPointerCapture(event.pointerId)",
    "if (!suppressClick) return",
  ];

  for (const requirement of requirements) {
    if (!source.includes(requirement)) throw new Error(`Hero carousel interaction contract is missing: ${requirement}`);
  }
}

function assertRenderedHeroLinks(path) {
  const html = readFileSync(path, "utf8");
  const slideTags = html.match(/<a\b[^>]*data-hero-slide[^>]*>/g) ?? [];
  for (const tag of slideTags) {
    const href = tag.match(/\shref="([^"]*)"/)?.[1]?.trim() ?? "";
    if (!href || href === "#") throw new Error(`${path} contains a hero slide without a valid href.`);
  }
}

mkdirSync(LOG_DIR, { recursive: true });
assertHeroInteractionContract();
const chrome = findChrome();
const userDataDir = join(tmpdir(), `site-browser-smoke-${process.pid}`);
const serverStdout = openSync(`${LOG_DIR}/browser-worker.log`, "w");
const serverStderr = openSync(`${LOG_DIR}/browser-worker-error.log`, "w");
const server = spawn("pnpm", [
  "exec",
  "wrangler",
  "dev",
  "--local",
  "--port",
  "8787",
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

  runChrome(chrome, [
    `--user-data-dir=${userDataDir}`,
    "--window-size=390,844",
    `--screenshot=${LOG_DIR}/public-mobile.png`,
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
    `${ORIGIN}/`,
  ], `${LOG_DIR}/public-browser-dom.html`);
  runChrome(chrome, [
    `--user-data-dir=${userDataDir}`,
    "--window-size=1440,1000",
    "--dump-dom",
    `${ORIGIN}/`,
  ], `${LOG_DIR}/public-desktop-browser-dom.html`);
  runChrome(chrome, [
    `--user-data-dir=${userDataDir}`,
    "--window-size=390,844",
    "--dump-dom",
    `${ORIGIN}/admin/login`,
  ], `${LOG_DIR}/admin-login-browser-dom.html`);

  assertDocument(`${LOG_DIR}/public-browser-dom.html`, ["<html", "<main"]);
  assertDocument(`${LOG_DIR}/public-desktop-browser-dom.html`, ["<html", "<main"]);
  assertRenderedHeroLinks(`${LOG_DIR}/public-desktop-browser-dom.html`);
  assertDocument(`${LOG_DIR}/admin-login-browser-dom.html`, ["<html", "<form"]);
  console.log("Headless Chrome verified public and admin entry pages, including the desktop hero link contract.");
} finally {
  server.kill("SIGTERM");
  await new Promise((resolve) => setTimeout(resolve, 500));
  if (server.exitCode === null) server.kill("SIGKILL");
  rmSync(userDataDir, { recursive: true, force: true });
}
