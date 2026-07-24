import { spawnSync } from "node:child_process";

const RETRYABLE_PATTERNS = [
  /worker restarted mid-request/iu,
  /local worker did not become ready/iu,
];
const MAX_ATTEMPTS = 2;

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
  const result = spawnSync(process.execPath, ["scripts/verify-admin-crud-smoke.mjs"], {
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0" },
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status === 0) process.exit(0);

  const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const retryable = RETRYABLE_PATTERNS.some((pattern) => pattern.test(combined));
  if (!retryable || attempt === MAX_ATTEMPTS) process.exit(result.status ?? 1);

  console.warn(`Local Worker restarted during admin smoke attempt ${attempt}; retrying once with a fresh temporary database.`);
}

process.exit(1);
