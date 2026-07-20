import { readFile } from "node:fs/promises";

const configPath = new URL("../dist/server/wrangler.json", import.meta.url);
const config = JSON.parse(await readFile(configPath, "utf8"));

function bindings(entries) {
  return Array.isArray(entries) ? entries.map((entry) => entry?.binding).filter(Boolean) : [];
}

const kvBindings = bindings(config.kv_namespaces);
const d1Bindings = bindings(config.d1_databases);
const r2Bindings = bindings(config.r2_buckets);

if (kvBindings.length > 0) {
  throw new Error(`Unexpected KV bindings in generated deploy config: ${kvBindings.join(", ")}`);
}
if (!d1Bindings.includes("DB")) {
  throw new Error("Generated deploy config is missing the DB D1 binding.");
}
if (!r2Bindings.includes("MEDIA_BUCKET")) {
  throw new Error("Generated deploy config is missing the MEDIA_BUCKET R2 binding.");
}

console.log(JSON.stringify({ event: "deploy_config_verified", kvBindings, d1Bindings, r2Bindings }));
