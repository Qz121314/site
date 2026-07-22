import { readFileSync } from "node:fs";

const publicLayout = readFileSync("src/layouts/PublicLayout.astro", "utf8");
const adminLayout = readFileSync("src/layouts/AdminLayout.astro", "utf8");
const publicSystem = readFileSync("src/styles/public-system.css", "utf8");
const adminSystem = readFileSync("src/styles/admin-system.css", "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(publicLayout.includes('import "@/styles/public-system.css";'), "PublicLayout must import public-system.css.");
assert(!publicLayout.includes("public-base.css") && !publicLayout.includes('import "@/styles/public.css";') && !publicLayout.includes("public-premium.css"), "PublicLayout must not import internal public style layers directly.");

assert(adminLayout.includes('import "@/styles/admin-system.css";'), "AdminLayout must import admin-system.css.");
for (const directImport of [
  "global.css",
  "admin-workflow.css",
  "admin-layout-v2.css",
  "admin-collections.css",
  "admin-collection-workspace.css",
  "admin-popover.css",
  "admin-premium.css",
  "admin-premium-details.css",
]) {
  assert(!adminLayout.includes(`import \"@/styles/${directImport}\";`), `AdminLayout must not import ${directImport} directly.`);
}

const expectedPublicOrder = ["public-base.css", "public.css", "public-premium.css"];
let previousIndex = -1;
for (const stylesheet of expectedPublicOrder) {
  const index = publicSystem.indexOf(stylesheet);
  assert(index > previousIndex, `public-system.css must load ${stylesheet} in the documented order.`);
  previousIndex = index;
}

const expectedAdminOrder = [
  "global.css",
  "admin-workflow.css",
  "admin-layout-v2.css",
  "admin-collections.css",
  "admin-collection-workspace.css",
  "admin-popover.css",
  "admin-premium.css",
  "admin-premium-details.css",
];
previousIndex = -1;
for (const stylesheet of expectedAdminOrder) {
  const index = adminSystem.indexOf(stylesheet);
  assert(index > previousIndex, `admin-system.css must load ${stylesheet} in the documented order.`);
  previousIndex = index;
}

console.log("Visual style entrypoints are centralized and ordered.");
