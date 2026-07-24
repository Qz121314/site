import { readFileSync, writeFileSync } from "node:fs";

const DEPLOY_LOG = "ci-logs/deploy.log";
const OUTPUT_PATH = "ci-logs/production-cache-purge.json";

function normalizeOrigin(value) {
  if (!value) return null;
  try {
    return new URL(value.trim()).origin;
  } catch {
    return null;
  }
}

function readDeployOrigin() {
  try {
    const content = readFileSync(DEPLOY_LOG, "utf8");
    const candidates = [...content.matchAll(/https:\/\/[^\s)\]}>'"]+/gu)].map((match) => match[0]);
    return normalizeOrigin(candidates.find((value) => value.includes(".workers.dev")) ?? candidates[0]);
  } catch {
    return null;
  }
}

function readAdminPassword() {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  try {
    const payload = JSON.parse(readFileSync(".secrets.production.json", "utf8"));
    return typeof payload.ADMIN_PASSWORD === "string" ? payload.ADMIN_PASSWORD : "";
  } catch {
    return "";
  }
}

const origin = normalizeOrigin(process.env.PRODUCTION_ORIGIN) ?? readDeployOrigin();
const password = readAdminPassword();
if (!origin) throw new Error("Unable to determine production origin before cache purge.");
if (!password) throw new Error("Unable to read ADMIN_PASSWORD before cache purge.");

const startedAt = new Date().toISOString();
try {
  const login = await fetch(new URL("/api/admin/login", origin), {
    method: "POST",
    headers: {
      Accept: "text/html",
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      Origin: origin,
      "User-Agent": "site-deployment-cache-purge/1.0",
    },
    body: new URLSearchParams({ password }),
    redirect: "manual",
    signal: AbortSignal.timeout(12_000),
  });
  if (login.status !== 303) throw new Error(`Admin login returned ${login.status}.`);
  const cookie = login.headers.get("set-cookie")?.split(";", 1)[0]?.trim();
  if (!cookie) throw new Error("Admin login did not return a session cookie.");

  const purge = await fetch(new URL("/api/admin/cache/purge", origin), {
    method: "POST",
    headers: {
      Accept: "text/html",
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      Cookie: cookie,
      Origin: origin,
      "User-Agent": "site-deployment-cache-purge/1.0",
    },
    body: new URLSearchParams(),
    redirect: "manual",
    signal: AbortSignal.timeout(20_000),
  });
  if (purge.status !== 303) throw new Error(`Public cache purge returned ${purge.status}.`);
  const location = new URL(purge.headers.get("location") ?? "/admin/settings?cache=error", origin);
  if (location.searchParams.get("cache") !== "refreshed") {
    throw new Error("Cloudflare public cache purge did not report success.");
  }

  writeFileSync(OUTPUT_PATH, JSON.stringify({ ok: true, origin, startedAt, completedAt: new Date().toISOString() }, null, 2));
  console.log(`Production public cache purged for ${origin}`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  writeFileSync(OUTPUT_PATH, JSON.stringify({ ok: false, origin, startedAt, completedAt: new Date().toISOString(), error: message }, null, 2));
  throw error;
}
