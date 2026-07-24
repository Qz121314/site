import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, openSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ORIGIN = "http://127.0.0.1:8789";
const LOG_DIR = "ci-logs";
const ADMIN_PASSWORD = "browser-smoke-password";
const CHANNEL_NAME = "Pool Smoke Channel";

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0" },
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
  }
}

async function waitForStableServer() {
  let consecutiveSuccesses = 0;
  let lastError = null;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${ORIGIN}/robots.txt`, {
        signal: AbortSignal.timeout(2_000),
      });
      if (response.ok) {
        consecutiveSuccesses += 1;
        if (consecutiveSuccesses >= 3) return;
      } else {
        consecutiveSuccesses = 0;
        lastError = new Error(`Server returned ${response.status}`);
      }
    } catch (error) {
      consecutiveSuccesses = 0;
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error(`Local Worker did not become stable: ${String(lastError)}`);
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

function firstIdFromAction(html, expression, label) {
  const match = html.match(expression);
  if (!match?.[1]) throw new Error(`${label} did not expose its update action id.`);
  return match[1];
}

function expectSaved(url, value, label) {
  if (url.searchParams.get("saved") !== value) {
    throw new Error(`${label} did not report saved=${value}: ${url.search}`);
  }
}

mkdirSync(LOG_DIR, { recursive: true });
const persistDir = join(tmpdir(), `site-admin-pools-smoke-${process.pid}`);
mkdirSync(persistDir, { recursive: true });
runCommand("pnpm", ["exec", "wrangler", "d1", "migrations", "apply", "DB", "--local", "--persist-to", persistDir]);
runCommand("pnpm", ["exec", "wrangler", "d1", "execute", "DB", "--local", "--persist-to", persistDir, "--file", "scripts/fixtures/browser-smoke.sql"]);

const serverStdout = openSync(`${LOG_DIR}/admin-pools-smoke-worker.log`, "w");
const serverStderr = openSync(`${LOG_DIR}/admin-pools-smoke-worker-error.log`, "w");
const server = spawn("pnpm", [
  "exec",
  "wrangler",
  "dev",
  "--local",
  "--port",
  "8789",
  "--persist-to",
  persistDir,
  "--var",
  `ADMIN_PASSWORD:${ADMIN_PASSWORD}`,
  "--var",
  "SESSION_SECRET:browser-pools-session-secret-0123456789",
], {
  env: { ...process.env, FORCE_COLOR: "0" },
  stdio: ["ignore", serverStdout, serverStderr],
});

try {
  await waitForStableServer();

  const login = await request("/api/admin/login", {
    method: "POST",
    body: new URLSearchParams({ password: ADMIN_PASSWORD }),
  });
  redirectUrl(login, "/admin/channels", "Admin pools login");
  const cookie = sessionCookie(login);

  const channelCreate = await request("/api/admin/channels/create", {
    method: "POST",
    cookie,
    body: new URLSearchParams({
      name: CHANNEL_NAME,
      icon: "P",
      sortOrder: "900",
      status: "draft",
    }),
  });
  const channelCreateUrl = redirectUrl(channelCreate, "/admin/channels", "Pool smoke channel create");
  expectSaved(channelCreateUrl, "created", "Pool smoke channel create");
  const channelId = channelCreateUrl.searchParams.get("channel");
  if (!channelId) throw new Error("Pool smoke channel create did not return an id.");
  const encodedChannelId = encodeURIComponent(channelId);

  const filtersPath = `/admin/channels/${encodedChannelId}/filters`;
  const filterCreate = await request(`/api/admin/channels/${encodedChannelId}/filters/create`, {
    method: "POST",
    cookie,
    body: new URLSearchParams({
      name: "Smoke Filter",
      sortOrder: "10",
      status: "enabled",
    }),
  });
  expectSaved(redirectUrl(filterCreate, filtersPath, "Filter create"), "created", "Filter create");

  const filterPage = await request(filtersPath, { cookie });
  expectStatus(filterPage, 200, "Filter page after create");
  if (!filterPage.body.includes("Smoke Filter")) throw new Error("Created filter was not visible after refresh.");
  const filterId = firstIdFromAction(
    filterPage.body,
    new RegExp(`/api/admin/channels/${channelId}/filters/([0-9a-f-]{36})/update`, "iu"),
    "Created filter",
  );

  const filterUpdate = await request(
    `/api/admin/channels/${encodedChannelId}/filters/${encodeURIComponent(filterId)}/update`,
    {
      method: "POST",
      cookie,
      body: new URLSearchParams({
        name: "Smoke Filter Updated",
        sortOrder: "45",
        status: "disabled",
      }),
    },
  );
  expectSaved(redirectUrl(filterUpdate, filtersPath, "Filter update"), "updated", "Filter update");

  const updatedFilterPage = await request(filtersPath, { cookie });
  expectStatus(updatedFilterPage, 200, "Filter page after update");
  if (!updatedFilterPage.body.includes("Smoke Filter Updated") || !updatedFilterPage.body.includes('value="45"')) {
    throw new Error("Filter name, status, or sort order did not persist after refresh.");
  }

  const filterDelete = await request(
    `/api/admin/channels/${encodedChannelId}/filters/${encodeURIComponent(filterId)}/delete`,
    { method: "POST", cookie, body: new URLSearchParams() },
  );
  expectSaved(redirectUrl(filterDelete, filtersPath, "Filter delete"), "deleted", "Filter delete");
  const deletedFilterPage = await request(filtersPath, { cookie });
  expectStatus(deletedFilterPage, 200, "Filter page after delete");
  if (deletedFilterPage.body.includes("Smoke Filter Updated")) {
    throw new Error("Deleted filter remained visible after refresh.");
  }

  const conversionsPath = `/admin/channels/${encodedChannelId}/conversions`;
  const groupCreate = await request(`/api/admin/channels/${encodedChannelId}/conversions/create`, {
    method: "POST",
    cookie,
    body: new URLSearchParams({ name: "Smoke Conversion", status: "enabled" }),
  });
  const groupCreateUrl = redirectUrl(groupCreate, conversionsPath, "Conversion group create");
  expectSaved(groupCreateUrl, "group-created", "Conversion group create");
  const groupId = groupCreateUrl.searchParams.get("group");
  if (!groupId) throw new Error("Conversion group create did not return an id.");
  const encodedGroupId = encodeURIComponent(groupId);

  const resourceCreate = await request(
    `/api/admin/channels/${encodedChannelId}/conversions/${encodedGroupId}/resources/create`,
    {
      method: "POST",
      cookie,
      body: new URLSearchParams({
        type: "sms",
        value: "+1 555 123 4567",
        sortOrder: "10",
        status: "enabled",
      }),
    },
  );
  const resourceCreateUrl = redirectUrl(resourceCreate, conversionsPath, "Conversion resource create");
  expectSaved(resourceCreateUrl, "resource-created", "Conversion resource create");

  const conversionPage = await request(`${conversionsPath}?group=${encodedGroupId}`, { cookie });
  expectStatus(conversionPage, 200, "Conversion page after create");
  if (!conversionPage.body.includes("Smoke Conversion") || !conversionPage.body.includes("+1 555 123 4567")) {
    throw new Error("Created conversion group or CTA was not visible after refresh.");
  }
  const resourceId = firstIdFromAction(
    conversionPage.body,
    new RegExp(`/api/admin/channels/${channelId}/conversions/${groupId}/resources/([0-9a-f-]{36})/update`, "iu"),
    "Created conversion resource",
  );
  const encodedResourceId = encodeURIComponent(resourceId);

  const resourceUpdate = await request(
    `/api/admin/channels/${encodedChannelId}/conversions/${encodedGroupId}/resources/${encodedResourceId}/update`,
    {
      method: "POST",
      cookie,
      body: new URLSearchParams({
        type: "link",
        value: "https://example.com/contact",
        sortOrder: "45",
        status: "disabled",
      }),
    },
  );
  const resourceUpdateUrl = redirectUrl(resourceUpdate, conversionsPath, "Conversion resource update");
  expectSaved(resourceUpdateUrl, "resource-updated", "Conversion resource update");

  const groupUpdate = await request(
    `/api/admin/channels/${encodedChannelId}/conversions/${encodedGroupId}/update`,
    {
      method: "POST",
      cookie,
      body: new URLSearchParams({ name: "Smoke Conversion Updated", status: "disabled" }),
    },
  );
  const groupUpdateUrl = redirectUrl(groupUpdate, conversionsPath, "Conversion group update");
  expectSaved(groupUpdateUrl, "group-updated", "Conversion group update");

  const updatedConversionPage = await request(`${conversionsPath}?group=${encodedGroupId}`, { cookie });
  expectStatus(updatedConversionPage, 200, "Conversion page after update");
  if (
    !updatedConversionPage.body.includes("Smoke Conversion Updated")
    || !updatedConversionPage.body.includes("https://example.com/contact")
    || !updatedConversionPage.body.includes('data-record-sort-order="45"')
    || !updatedConversionPage.body.includes('data-record-status="disabled"')
  ) {
    throw new Error("Conversion group or CTA changes did not persist after refresh.");
  }

  const resourceDelete = await request(
    `/api/admin/channels/${encodedChannelId}/conversions/${encodedGroupId}/resources/${encodedResourceId}/delete`,
    { method: "POST", cookie, body: new URLSearchParams() },
  );
  expectSaved(
    redirectUrl(resourceDelete, conversionsPath, "Conversion resource delete"),
    "resource-deleted",
    "Conversion resource delete",
  );

  const groupDelete = await request(
    `/api/admin/channels/${encodedChannelId}/conversions/${encodedGroupId}/delete`,
    { method: "POST", cookie, body: new URLSearchParams() },
  );
  expectSaved(
    redirectUrl(groupDelete, conversionsPath, "Conversion group delete"),
    "group-deleted",
    "Conversion group delete",
  );
  const deletedConversionPage = await request(conversionsPath, { cookie });
  expectStatus(deletedConversionPage, 200, "Conversion page after delete");
  if (deletedConversionPage.body.includes("Smoke Conversion Updated")) {
    throw new Error("Deleted conversion group remained visible after refresh.");
  }

  const adsPath = `/admin/channels/${encodedChannelId}/ads`;
  const poolCreate = await request(`/api/admin/channels/${encodedChannelId}/ads/pools/create`, {
    method: "POST",
    cookie,
    body: new URLSearchParams({
      name: "Smoke Ad Pool",
      deviceType: "mobile",
      status: "enabled",
    }),
  });
  const poolCreateUrl = redirectUrl(poolCreate, adsPath, "Ad pool create");
  expectSaved(poolCreateUrl, "pool-created", "Ad pool create");
  const poolId = poolCreateUrl.searchParams.get("pool");
  if (!poolId) throw new Error("Ad pool create did not return an id.");
  const encodedPoolId = encodeURIComponent(poolId);

  const adCreate = await request(
    `/api/admin/channels/${encodedChannelId}/ads/pools/${encodedPoolId}/items/create`,
    {
      method: "POST",
      cookie,
      body: new URLSearchParams({
        name: "Smoke Embed Ad",
        displayType: "banner",
        creativeType: "embed_code",
        imageAssetId: "",
        mediaUrl: "",
        embedCode: "<div>Smoke ad</div>",
        targetUrl: "",
        declaredWidth: "320",
        declaredHeight: "50",
        openMode: "new",
        status: "enabled",
      }),
    },
  );
  const adCreateUrl = redirectUrl(adCreate, adsPath, "Advertisement create");
  expectSaved(adCreateUrl, "ad-created", "Advertisement create");
  const adId = adCreateUrl.searchParams.get("ad");
  if (!adId) throw new Error("Advertisement create did not return an id.");
  const encodedAdId = encodeURIComponent(adId);

  const adUpdate = await request(
    `/api/admin/channels/${encodedChannelId}/ads/pools/${encodedPoolId}/items/${encodedAdId}/update`,
    {
      method: "POST",
      cookie,
      body: new URLSearchParams({
        name: "Smoke External Ad Updated",
        displayType: "vertical",
        creativeType: "external_media",
        imageAssetId: "",
        mediaUrl: "https://example.com/ad.gif",
        embedCode: "",
        targetUrl: "https://example.com/landing",
        declaredWidth: "300",
        declaredHeight: "600",
        openMode: "same",
        status: "disabled",
      }),
    },
  );
  expectSaved(redirectUrl(adUpdate, adsPath, "Advertisement update"), "ad-updated", "Advertisement update");

  const poolUpdate = await request(
    `/api/admin/channels/${encodedChannelId}/ads/pools/${encodedPoolId}/update`,
    {
      method: "POST",
      cookie,
      body: new URLSearchParams({
        name: "Smoke Ad Pool Updated",
        deviceType: "desktop",
        status: "disabled",
      }),
    },
  );
  expectSaved(redirectUrl(poolUpdate, adsPath, "Ad pool update"), "pool-updated", "Ad pool update");

  const updatedAdsPage = await request(`${adsPath}?pool=${encodedPoolId}`, { cookie });
  expectStatus(updatedAdsPage, 200, "Ads page after update");
  if (
    !updatedAdsPage.body.includes("Smoke Ad Pool Updated")
    || !updatedAdsPage.body.includes("Smoke External Ad Updated")
    || !updatedAdsPage.body.includes("https://example.com/ad.gif")
    || !updatedAdsPage.body.includes('data-record-device-type="desktop"')
    || !updatedAdsPage.body.includes('data-record-display-type="vertical"')
    || !updatedAdsPage.body.includes('data-record-status="disabled"')
  ) {
    throw new Error("Ad pool or advertisement changes did not persist after refresh.");
  }

  const adDelete = await request(
    `/api/admin/channels/${encodedChannelId}/ads/pools/${encodedPoolId}/items/${encodedAdId}/delete`,
    { method: "POST", cookie, body: new URLSearchParams() },
  );
  expectSaved(redirectUrl(adDelete, adsPath, "Advertisement delete"), "ad-deleted", "Advertisement delete");

  const poolDelete = await request(
    `/api/admin/channels/${encodedChannelId}/ads/pools/${encodedPoolId}/delete`,
    { method: "POST", cookie, body: new URLSearchParams() },
  );
  expectSaved(redirectUrl(poolDelete, adsPath, "Ad pool delete"), "pool-deleted", "Ad pool delete");
  const deletedAdsPage = await request(adsPath, { cookie });
  expectStatus(deletedAdsPage, 200, "Ads page after delete");
  if (deletedAdsPage.body.includes("Smoke Ad Pool Updated") || deletedAdsPage.body.includes("Smoke External Ad Updated")) {
    throw new Error("Deleted ad pool or advertisement remained visible after refresh.");
  }

  const channelDelete = await request(`/api/admin/channels/${encodedChannelId}/delete`, {
    method: "POST",
    cookie,
    body: new URLSearchParams(),
  });
  expectSaved(redirectUrl(channelDelete, "/admin/channels", "Pool smoke channel delete"), "deleted", "Pool smoke channel delete");

  console.log("Admin filter, conversion, CTA, ad pool, and advertisement CRUD flows verified.");
} finally {
  server.kill("SIGTERM");
  await new Promise((resolve) => setTimeout(resolve, 500));
  if (server.exitCode === null) server.kill("SIGKILL");
  rmSync(persistDir, { recursive: true, force: true });
}
