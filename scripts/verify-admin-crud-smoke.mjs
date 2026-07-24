import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, openSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ORIGIN = "http://127.0.0.1:8788";
const LOG_DIR = "ci-logs";
const ADMIN_PASSWORD = "browser-smoke-password";
const CHANNEL_NAME = "Browser Smoke Channel";
const UPDATED_CHANNEL_NAME = "Browser Smoke Channel Updated";

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0" },
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
  }
}

async function waitForServer() {
  let lastError = null;
  for (let attempt = 0; attempt < 45; attempt += 1) {
    try {
      const response = await fetch(`${ORIGIN}/robots.txt`, {
        signal: AbortSignal.timeout(2_000),
      });
      if (response.ok) return;
      lastError = new Error(`Server returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`Local Worker did not become ready: ${String(lastError)}`);
}

async function request(pathname, options = {}) {
  const method = options.method ?? "GET";
  const headers = new Headers({ Accept: options.accept ?? "text/html" });
  if (method !== "GET" && method !== "HEAD") headers.set("Origin", ORIGIN);
  if (options.cookie) headers.set("Cookie", options.cookie);
  if (options.body instanceof URLSearchParams) {
    headers.set("Content-Type", "application/x-www-form-urlencoded;charset=UTF-8");
  }

  const response = await fetch(`${ORIGIN}${pathname}`, {
    method,
    headers,
    body: options.body,
    redirect: "manual",
    signal: AbortSignal.timeout(8_000),
  });
  return { response, body: await response.text() };
}

function expectStatus(result, status, label) {
  if (result.response.status !== status) {
    throw new Error(`${label} returned ${result.response.status}; expected ${status}: ${result.body.slice(0, 300)}`);
  }
}

function redirectUrl(result, expectedPathname, label) {
  expectStatus(result, 303, label);
  const location = result.response.headers.get("location");
  if (!location) throw new Error(`${label} did not return a Location header.`);
  const url = new URL(location, ORIGIN);
  if (url.pathname !== expectedPathname) {
    throw new Error(`${label} redirected to ${url.pathname}; expected ${expectedPathname}.`);
  }
  return url;
}

function sessionCookie(result) {
  const value = result.response.headers.get("set-cookie");
  const cookie = value?.split(";", 1)[0]?.trim();
  if (!cookie) throw new Error("Admin login did not return a session cookie.");
  return cookie;
}

function channelSlugFromList(html, channelName) {
  const title = `<strong class="admin-entity-title" title="${channelName}">${channelName}</strong>`;
  const position = html.indexOf(title);
  if (position < 0) throw new Error(`Admin channel list did not include ${channelName}.`);
  const match = html.slice(position, position + 700).match(/<span class="admin-entity-subtitle">\/([^<]+)<\/span>/u);
  if (!match?.[1]) throw new Error(`Admin channel list did not expose the slug for ${channelName}.`);
  return match[1];
}

mkdirSync(LOG_DIR, { recursive: true });
const persistDir = join(tmpdir(), `site-admin-smoke-d1-${process.pid}`);
mkdirSync(persistDir, { recursive: true });
runCommand("pnpm", ["exec", "wrangler", "d1", "migrations", "apply", "DB", "--local", "--persist-to", persistDir]);
runCommand("pnpm", ["exec", "wrangler", "d1", "execute", "DB", "--local", "--persist-to", persistDir, "--file", "scripts/fixtures/browser-smoke.sql"]);

const serverStdout = openSync(`${LOG_DIR}/admin-smoke-worker.log`, "w");
const serverStderr = openSync(`${LOG_DIR}/admin-smoke-worker-error.log`, "w");
const server = spawn("pnpm", [
  "exec",
  "wrangler",
  "dev",
  "--local",
  "--port",
  "8788",
  "--persist-to",
  persistDir,
  "--var",
  `ADMIN_PASSWORD:${ADMIN_PASSWORD}`,
  "--var",
  "SESSION_SECRET:browser-smoke-session-secret-0123456789",
], {
  env: { ...process.env, FORCE_COLOR: "0" },
  stdio: ["ignore", serverStdout, serverStderr],
});

try {
  await waitForServer();

  const unauthenticated = await request("/api/admin/channels/create", {
    method: "POST",
    accept: "application/json",
    body: new URLSearchParams({ name: CHANNEL_NAME, status: "draft" }),
  });
  expectStatus(unauthenticated, 401, "Unauthenticated admin create");
  if (!unauthenticated.body.includes("UNAUTHORIZED")) {
    throw new Error("Unauthenticated admin create did not return the expected error payload.");
  }

  const login = await request("/api/admin/login", {
    method: "POST",
    body: new URLSearchParams({ password: ADMIN_PASSWORD }),
  });
  redirectUrl(login, "/admin/channels", "Admin login");
  const cookie = sessionCookie(login);

  const initialList = await request("/admin/channels", { cookie });
  expectStatus(initialList, 200, "Authenticated channel list");

  const create = await request("/api/admin/channels/create", {
    method: "POST",
    cookie,
    body: new URLSearchParams({
      name: CHANNEL_NAME,
      icon: "S",
      sortOrder: "321",
      status: "draft",
    }),
  });
  const createLocation = redirectUrl(create, "/admin/channels", "Admin channel create");
  if (createLocation.searchParams.get("saved") !== "created") {
    throw new Error("Admin channel create did not report a successful save.");
  }
  const channelId = createLocation.searchParams.get("channel");
  if (!channelId) throw new Error("Admin channel create did not return the created channel id.");

  const createdList = await request("/admin/channels", { cookie });
  expectStatus(createdList, 200, "Created channel list");
  const channelSlug = channelSlugFromList(createdList.body, CHANNEL_NAME);

  const draftPublicPage = await request(`/${encodeURIComponent(channelSlug)}`);
  expectStatus(draftPublicPage, 404, "Draft channel public route");

  const update = await request(`/api/admin/channels/${encodeURIComponent(channelId)}/update`, {
    method: "POST",
    cookie,
    body: new URLSearchParams({
      name: UPDATED_CHANNEL_NAME,
      icon: "U",
      sortOrder: "322",
      status: "published",
    }),
  });
  const updateLocation = redirectUrl(
    update,
    `/admin/channels/${encodeURIComponent(channelId)}`,
    "Admin channel update",
  );
  if (updateLocation.searchParams.get("saved") !== "updated") {
    throw new Error("Admin channel update did not report a successful save.");
  }

  const settings = await request(`/admin/channels/${encodeURIComponent(channelId)}`, { cookie });
  expectStatus(settings, 200, "Updated channel settings");
  if (!settings.body.includes(`value="${UPDATED_CHANNEL_NAME}"`) || !settings.body.includes('value="322"')) {
    throw new Error("Updated channel settings were not persisted after navigation.");
  }

  const publishedPublicPage = await request(`/${encodeURIComponent(channelSlug)}`);
  expectStatus(publishedPublicPage, 200, "Published channel public route");
  if (!publishedPublicPage.body.includes(UPDATED_CHANNEL_NAME)) {
    throw new Error("Published channel page did not reflect the updated channel name.");
  }

  const remove = await request(`/api/admin/channels/${encodeURIComponent(channelId)}/delete`, {
    method: "POST",
    cookie,
    body: new URLSearchParams(),
  });
  const deleteLocation = redirectUrl(remove, "/admin/channels", "Admin channel delete");
  if (deleteLocation.searchParams.get("saved") !== "deleted") {
    throw new Error("Admin channel delete did not report a successful save.");
  }

  const finalList = await request("/admin/channels", { cookie });
  expectStatus(finalList, 200, "Final channel list");
  if (finalList.body.includes(UPDATED_CHANNEL_NAME)) {
    throw new Error("Deleted channel remained visible after refreshing the channel list.");
  }

  const deletedPublicPage = await request(`/${encodeURIComponent(channelSlug)}`);
  expectStatus(deletedPublicPage, 404, "Deleted channel public route");

  console.log("Authenticated admin login, channel create, update, publish, refresh, and delete flows verified.");
} finally {
  server.kill("SIGTERM");
  await new Promise((resolve) => setTimeout(resolve, 500));
  if (server.exitCode === null) server.kill("SIGKILL");
  rmSync(persistDir, { recursive: true, force: true });
}
