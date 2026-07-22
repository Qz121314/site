import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const BOOKMARK_PATH = "ci-logs/d1-pre-migration-bookmark.json";
const OUTPUT_PATH = "ci-logs/recovery.md";

function findBookmark(value) {
  if (typeof value === "string" && /^[0-9a-f]{8,}(?:-[0-9a-f]{8,}){2,}$/iu.test(value)) return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const bookmark = findBookmark(item);
      if (bookmark) return bookmark;
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (key.toLowerCase().includes("bookmark") && typeof item === "string") return item;
      const bookmark = findBookmark(item);
      if (bookmark) return bookmark;
    }
  }
  return null;
}

function readBookmark() {
  if (!existsSync(BOOKMARK_PATH)) return null;
  const content = readFileSync(BOOKMARK_PATH, "utf8").trim();
  if (!content) return null;

  try {
    return findBookmark(JSON.parse(content));
  } catch {
    const match = content.match(/[0-9a-f]{8,}(?:-[0-9a-f]{8,}){2,}/iu);
    return match?.[0] ?? null;
  }
}

const bookmark = readBookmark();
const commit = process.env.GITHUB_SHA || "<commit>";
const runUrl = process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
  ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
  : "<actions-run-url>";

const lines = [
  "# Production recovery guide",
  "",
  `- Commit: \`${commit}\``,
  `- Actions run: ${runUrl}`,
  "",
  "## Worker rollback",
  "",
  "The workflow attempts an automatic Worker rollback when deployment completed but the production smoke test failed.",
  "To roll back manually to the version deployed immediately before the current version:",
  "",
  "```bash",
  `pnpm exec wrangler rollback --message \"Manual rollback after ${commit}\"`,
  "```",
  "",
  "## D1 recovery",
  "",
  "D1 recovery is intentionally not automatic because Time Travel restore overwrites the production database and cancels in-flight queries.",
  bookmark
    ? `Pre-migration bookmark: \`${bookmark}\``
    : "No pre-migration bookmark could be extracted. Inspect `d1-pre-migration-bookmark.json` in this artifact.",
  "",
  ...(bookmark ? [
    "```bash",
    `pnpm exec wrangler d1 time-travel restore DB --bookmark=${bookmark}`,
    "```",
    "",
  ] : []),
  "Run the D1 restore only after confirming that the migration caused the incident and that restoring production data is acceptable.",
  "",
  "## Verification",
  "",
  "After recovery, verify:",
  "",
  "```bash",
  "curl --fail --show-error --location https://<production-origin>/api/health",
  "curl --fail --show-error --location https://<production-origin>/robots.txt",
  "curl --fail --show-error --location https://<production-origin>/",
  "```",
  "",
];

mkdirSync("ci-logs", { recursive: true });
writeFileSync(OUTPUT_PATH, lines.join("\n"));
console.log(`Wrote ${OUTPUT_PATH}${bookmark ? ` with bookmark ${bookmark}` : " without an extracted bookmark"}.`);
