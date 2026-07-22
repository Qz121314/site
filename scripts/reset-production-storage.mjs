import { execFileSync } from "node:child_process";

const workerName = "site";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function wranglerJson(args) {
  const output = execFileSync("pnpm", ["exec", "wrangler", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  return JSON.parse(output);
}

function visit(value, callback) {
  if (Array.isArray(value)) {
    for (const entry of value) visit(entry, callback);
    return;
  }
  if (!value || typeof value !== "object") return;
  callback(value);
  for (const entry of Object.values(value)) visit(entry, callback);
}

const versions = wranglerJson(["versions", "list", "--name", workerName, "--json"]);
const versionCandidates = [];
visit(versions, (entry) => {
  if (typeof entry.id === "string" && uuidPattern.test(entry.id)) versionCandidates.push(entry);
});
versionCandidates.sort((a, b) => String(b.metadata?.created_on ?? b.created_on ?? "").localeCompare(String(a.metadata?.created_on ?? a.created_on ?? "")));
const versionId = versionCandidates[0]?.id;
if (!versionId) throw new Error(`Could not resolve the current ${workerName} Worker version.`);

const version = wranglerJson(["versions", "view", versionId, "--name", workerName, "--json"]);
let bucketName = "";
visit(version, (entry) => {
  if (entry.type === "r2_bucket" && entry.name === "MEDIA_BUCKET" && typeof entry.bucket_name === "string") {
    bucketName = entry.bucket_name;
  }
});
if (!bucketName) throw new Error("Could not resolve the R2 bucket backing MEDIA_BUCKET.");

const keyQuery = [
  "SELECT object_key AS key FROM image_assets",
  "UNION SELECT thumbnail_object_key AS key FROM image_assets WHERE thumbnail_object_key IS NOT NULL",
  "UNION SELECT object_key AS key FROM image_deletion_queue",
].join(" ");
const d1Result = wranglerJson(["d1", "execute", "DB", "--remote", "--command", keyQuery, "--json", "--yes"]);
const objectKeys = new Set();
visit(d1Result, (entry) => {
  if (typeof entry.key === "string" && entry.key.length > 0) objectKeys.add(entry.key);
});

for (const key of objectKeys) {
  execFileSync("pnpm", ["exec", "wrangler", "r2", "object", "delete", `${bucketName}/${key}`, "--remote", "--force"], {
    stdio: "inherit",
  });
}

execFileSync("pnpm", ["exec", "wrangler", "d1", "execute", "DB", "--remote", "--file", "scripts/reset-production.sql", "--yes"], {
  stdio: "inherit",
});

console.log(JSON.stringify({ event: "template_storage_reset", deletedR2Objects: objectKeys.size, databaseBinding: "DB", bucketBinding: "MEDIA_BUCKET" }));
