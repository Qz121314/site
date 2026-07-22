import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const DEPLOY_LOG = "ci-logs/deploy.log";
const OUTPUT_PATH = "ci-logs/production-smoke.json";
const RETRY_DELAYS_MS = [0, 2_000, 4_000, 7_000, 10_000];

function normalizeOrigin(value) {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.origin;
  } catch {
    return null;
  }
}

function readDeployOrigin() {
  try {
    const content = readFileSync(DEPLOY_LOG, "utf8");
    const candidates = [...content.matchAll(/https:\/\/[^\s)\]}>'"]+/gu)].map((match) => match[0]);
    const preferred = candidates.find((value) => value.includes(".workers.dev")) ?? candidates[0];
    return normalizeOrigin(preferred);
  } catch {
    return null;
  }
}

function resolveOrigin() {
  return normalizeOrigin(process.env.PRODUCTION_ORIGIN) ?? readDeployOrigin();
}

async function pause(milliseconds) {
  if (milliseconds <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function requestWithRetries(pathname, validate) {
  let lastError = null;

  for (const delay of RETRY_DELAYS_MS) {
    await pause(delay);
    try {
      const response = await fetch(new URL(pathname, origin), {
        redirect: "follow",
        headers: {
          Accept: pathname === "/api/health" ? "application/json" : "*/*",
          "User-Agent": "site-deployment-smoke/1.0",
        },
        signal: AbortSignal.timeout(12_000),
      });
      const body = await response.text();
      const result = validate(response, body);
      if (result.ok) {
        return {
          pathname,
          url: response.url,
          status: response.status,
          contentType: response.headers.get("content-type"),
          detail: result.detail ?? null,
        };
      }
      lastError = new Error(result.error);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw new Error(`${pathname}: ${lastError?.message ?? "smoke verification failed"}`);
}

const origin = resolveOrigin();
if (!origin) {
  throw new Error("Unable to determine production origin. Set the optional PRODUCTION_ORIGIN GitHub Secret or keep the workers.dev URL in Wrangler deploy output.");
}

const checks = [
  requestWithRetries("/api/health", (response, body) => {
    if (response.status !== 200) return { ok: false, error: `expected 200, received ${response.status}` };
    try {
      const payload = JSON.parse(body);
      if (!payload || !["ok", "degraded"].includes(payload.status)) {
        return { ok: false, error: `unexpected health payload: ${body.slice(0, 300)}` };
      }
      return { ok: true, detail: payload.status };
    } catch {
      return { ok: false, error: "health endpoint did not return valid JSON" };
    }
  }),
  requestWithRetries("/robots.txt", (response, body) => {
    if (response.status !== 200) return { ok: false, error: `expected 200, received ${response.status}` };
    if (!body.includes("Sitemap:") || !body.includes("Disallow: /admin")) {
      return { ok: false, error: "robots.txt is missing required directives" };
    }
    return { ok: true };
  }),
  requestWithRetries("/", (response) => {
    if (response.status !== 200) return { ok: false, error: `expected final 200 response, received ${response.status}` };
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return { ok: false, error: `unexpected content type: ${contentType}` };
    return { ok: true };
  }),
];

const startedAt = new Date().toISOString();
mkdirSync("ci-logs", { recursive: true });

try {
  const results = await Promise.all(checks);
  writeFileSync(OUTPUT_PATH, JSON.stringify({ ok: true, origin, startedAt, completedAt: new Date().toISOString(), results }, null, 2));
  console.log(`Production smoke verification passed for ${origin}`);
  for (const result of results) console.log(`- ${result.pathname}: ${result.status} ${result.detail ?? ""}`.trim());
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  writeFileSync(OUTPUT_PATH, JSON.stringify({ ok: false, origin, startedAt, completedAt: new Date().toISOString(), error: message }, null, 2));
  throw error;
}
