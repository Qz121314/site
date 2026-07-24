import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, openSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ORIGIN = "http://127.0.0.1:8788";
const LOG_DIR = "ci-logs";
const ADMIN_PASSWORD = "browser-smoke-password";
const CHANNEL_NAME = "Browser Smoke Channel";
const UPDATED_CHANNEL_NAME = "Browser Smoke Channel Updated";
const PRODUCT_NAME = "Browser Smoke Product";
const UPDATED_PRODUCT_NAME = "Browser Smoke Product Updated";
const SMOKE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZBmwAAAAASUVORK5CYII=",
  "base64",
);

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

function channelSlugFromSettings(html) {
  const match = html.match(/<div class="readonly-value"[^>]*>\/([^<]+)<\/div>/u);
  if (!match?.[1]) throw new Error("Admin channel settings did not expose the automatic slug.");
  return match[1];
}

async function refreshPublicCache(cookie, label) {
  const result = await request("/api/admin/cache/purge", {
    method: "POST",
    cookie,
    body: new URLSearchParams(),
  });
  const location = redirectUrl(result, "/admin/settings", label);
  if (!new Set(["refreshed", "error"]).has(location.searchParams.get("cache"))) {
    throw new Error(`${label} did not report a cache refresh result.`);
  }
}

function productContentForm(overrides = {}) {
  const form = new URLSearchParams({
    returnTo: overrides.returnTo ?? "",
    title: overrides.title ?? PRODUCT_NAME,
    categoryName: overrides.categoryName ?? "Browser Smoke Category",
    tags: overrides.tags ?? "integration, smoke",
    ctaLabel: overrides.ctaLabel ?? "View Details",
    conversionGroupId: "",
    bodySource: overrides.bodySource ?? "Browser smoke product body.",
  });
  for (const imageId of overrides.galleryAssetIds ?? []) form.append("galleryAssetIds", imageId);
  return form;
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

  const uploadForm = new FormData();
  uploadForm.set("file", new File([SMOKE_PNG], "browser-smoke.png", { type: "image/png" }));
  uploadForm.set("originalName", "Browser Smoke Upload.png");
  const upload = await request("/api/admin/images/upload", {
    method: "POST",
    cookie,
    accept: "application/json",
    body: uploadForm,
  });
  expectStatus(upload, 200, "Admin image upload");
  const uploadPayload = JSON.parse(upload.body);
  const imageId = uploadPayload?.ok === true && typeof uploadPayload.image?.id === "string"
    ? uploadPayload.image.id
    : null;
  if (!imageId || uploadPayload.image?.mimeType !== "image/png" || uploadPayload.image?.width !== 1 || uploadPayload.image?.height !== 1) {
    throw new Error(`Admin image upload returned an invalid payload: ${upload.body.slice(0, 300)}`);
  }

  const imageContent = await request(`/api/admin/images/${encodeURIComponent(imageId)}/content`, {
    cookie,
    accept: "image/png",
  });
  expectStatus(imageContent, 200, "Admin image content");
  if (!(imageContent.response.headers.get("content-type") ?? "").includes("image/png") || imageContent.body.length === 0) {
    throw new Error("Uploaded R2 image content could not be read through the admin preview route.");
  }

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
  if (!createdList.body.includes(CHANNEL_NAME)) {
    throw new Error("Created channel did not appear after refreshing the channel list.");
  }
  const createdSettings = await request(`/admin/channels/${encodeURIComponent(channelId)}`, { cookie });
  expectStatus(createdSettings, 200, "Created channel settings");
  const channelSlug = channelSlugFromSettings(createdSettings.body);

  const draftPublicPage = await request(`/${encodeURIComponent(channelSlug)}`);
  expectStatus(draftPublicPage, 404, "Draft channel public route");

  const productsPath = `/admin/channels/${encodeURIComponent(channelId)}/products`;
  const createProduct = await request(`/api/admin/channels/${encodeURIComponent(channelId)}/products/create`, {
    method: "POST",
    cookie,
    body: productContentForm({ returnTo: productsPath, galleryAssetIds: [imageId] }),
  });
  const createProductLocation = redirectUrl(createProduct, productsPath, "Admin product create");
  if (createProductLocation.searchParams.get("saved") !== "created") {
    throw new Error("Admin product create did not report a successful save.");
  }
  const productId = createProductLocation.searchParams.get("edit");
  if (!productId) throw new Error("Admin product create did not return the created product id.");

  const createdProductPage = await request(`${productsPath}?edit=${encodeURIComponent(productId)}`, { cookie });
  expectStatus(createdProductPage, 200, "Created product editor");
  if (
    !createdProductPage.body.includes(PRODUCT_NAME)
    || !createdProductPage.body.includes("Browser smoke product body.")
    || !createdProductPage.body.includes(imageId)
  ) {
    throw new Error("Created product content or image binding was not persisted after navigation.");
  }

  const productReturnTo = `${productsPath}?edit=${encodeURIComponent(productId)}`;
  const updateProduct = await request(
    `/api/admin/channels/${encodeURIComponent(channelId)}/products/${encodeURIComponent(productId)}/update`,
    {
      method: "POST",
      cookie,
      body: productContentForm({
        returnTo: productReturnTo,
        title: UPDATED_PRODUCT_NAME,
        categoryName: "Browser Smoke Category Updated",
        tags: "integration, updated",
        ctaLabel: "Open Updated",
        bodySource: "Browser smoke product body updated.",
        galleryAssetIds: [imageId],
      }),
    },
  );
  const updateProductLocation = redirectUrl(updateProduct, productsPath, "Admin product update");
  if (
    updateProductLocation.searchParams.get("saved") !== "updated"
    || updateProductLocation.searchParams.get("edit") !== productId
  ) {
    throw new Error("Admin product update did not preserve the edited product and save status.");
  }

  const manageProduct = await request(
    `/api/admin/channels/${encodeURIComponent(channelId)}/products/${encodeURIComponent(productId)}/manage`,
    {
      method: "POST",
      cookie,
      body: new URLSearchParams({
        returnTo: productReturnTo,
        status: "disabled",
        sortOrder: "654",
      }),
    },
  );
  const manageProductLocation = redirectUrl(manageProduct, productsPath, "Admin product manage");
  if (
    manageProductLocation.searchParams.get("saved") !== "managed"
    || manageProductLocation.searchParams.get("edit") !== productId
  ) {
    throw new Error("Admin product management did not preserve the edited product and save status.");
  }

  const managedProductPage = await request(productReturnTo, { cookie });
  expectStatus(managedProductPage, 200, "Managed product editor");
  if (
    !managedProductPage.body.includes(UPDATED_PRODUCT_NAME)
    || !managedProductPage.body.includes("Browser smoke product body updated.")
    || !managedProductPage.body.includes('value="654"')
    || !managedProductPage.body.includes(imageId)
  ) {
    throw new Error("Updated product content, image, status, or sort order was not persisted after refresh.");
  }

  const deleteProduct = await request(
    `/api/admin/channels/${encodeURIComponent(channelId)}/products/${encodeURIComponent(productId)}/delete`,
    {
      method: "POST",
      cookie,
      body: new URLSearchParams({ returnTo: productReturnTo }),
    },
  );
  const deleteProductLocation = redirectUrl(deleteProduct, productsPath, "Admin product delete");
  if (deleteProductLocation.searchParams.get("saved") !== "deleted") {
    throw new Error("Admin product delete did not report a successful save.");
  }

  const finalProductPage = await request(productsPath, { cookie });
  expectStatus(finalProductPage, 200, "Final product management page");
  if (finalProductPage.body.includes(UPDATED_PRODUCT_NAME) || finalProductPage.body.includes("Browser Smoke Category Updated")) {
    throw new Error("Deleted product or its empty generated category remained visible after refresh.");
  }

  const deleteImage = await request(`/api/admin/images/${encodeURIComponent(imageId)}/delete`, {
    method: "POST",
    cookie,
    body: new URLSearchParams(),
  });
  const deleteImageLocation = redirectUrl(deleteImage, "/admin/images", "Admin image delete");
  if (!new Set(["deleted", "delete-pending"]).has(deleteImageLocation.searchParams.get("saved"))) {
    throw new Error("Admin image delete did not report a successful or queued R2 cleanup.");
  }

  const deletedImageContent = await request(`/api/admin/images/${encodeURIComponent(imageId)}/content`, {
    cookie,
    accept: "image/png",
  });
  expectStatus(deletedImageContent, 404, "Deleted admin image content");

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

  await refreshPublicCache(cookie, "Published channel cache refresh");
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

  await refreshPublicCache(cookie, "Deleted channel cache refresh");
  const deletedPublicPage = await request(`/${encodeURIComponent(channelSlug)}`);
  expectStatus(deletedPublicPage, 404, "Deleted channel public route");

  console.log("Authenticated admin channel, product, image/R2, cache refresh, and propagation flows verified.");
} finally {
  server.kill("SIGTERM");
  await new Promise((resolve) => setTimeout(resolve, 500));
  if (server.exitCode === null) server.kill("SIGKILL");
  rmSync(persistDir, { recursive: true, force: true });
}
