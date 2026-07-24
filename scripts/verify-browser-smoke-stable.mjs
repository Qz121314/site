import { spawnSync } from "node:child_process";

const RETRYABLE_PATTERNS = [
  /public-product-browser-dom\.html is missing data-affiliate-ad-type="product-detail"/iu,
];
const MAX_ATTEMPTS = 2;

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
  const result = spawnSync(process.execPath, ["scripts/verify-browser-smoke.mjs"], {
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0" },
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status === 0) process.exit(0);

  const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const retryable = RETRYABLE_PATTERNS.some((pattern) => pattern.test(combined));
  if (!retryable || attempt === MAX_ATTEMPTS) process.exit(result.status ?? 1);

  console.warn(
    `Desktop product advertisement was still loading during browser smoke attempt ${attempt}; retrying once with a fresh browser session.`,
  );
}

process.exit(1);
