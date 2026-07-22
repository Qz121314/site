import { readFileSync } from "node:fs";

const publicLayout = readFileSync("src/layouts/PublicLayout.astro", "utf8");
const adminLayout = readFileSync("src/layouts/AdminLayout.astro", "utf8");
const publicSystem = readFileSync("src/styles/public-system.css", "utf8");
const publicDetailCta = readFileSync("src/styles/public-detail-cta.css", "utf8");
const adminSystem = readFileSync("src/styles/admin-system.css", "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(publicLayout.includes('import "@/styles/public-system.css";'), "PublicLayout must import public-system.css.");
for (const directImport of ["public-base.css", "public.css", "public-design-system.css"]) {
  assert(!publicLayout.includes(`import "@/styles/${directImport}";`), `PublicLayout must not import ${directImport} directly.`);
}

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
  assert(!adminLayout.includes(`import "@/styles/${directImport}";`), `AdminLayout must not import ${directImport} directly.`);
}

const expectedPublicOrder = [
  "public-base.css",
  "public.css",
  "public-design-system.css",
  "public-loading.css",
  "public-desktop.css",
  "public-detail-cta.css",
];
let previousIndex = -1;
for (const stylesheet of expectedPublicOrder) {
  const index = publicSystem.indexOf(stylesheet);
  assert(index > previousIndex, `public-system.css must load ${stylesheet} in the documented order.`);
  previousIndex = index;
}

assert(
  publicDetailCta.includes("position: fixed !important"),
  "The detail CTA must remain fixed to the viewport.",
);
assert(
  publicDetailCta.includes(".public-main > .product-detail") && publicDetailCta.includes("transform: none !important"),
  "The detail page must not create a transformed containing block around the fixed CTA.",
);

for (const legacyPublicLayer of [
  "public-premium.css",
  "public-image-first.css",
  "public-interface-polish.css",
  "public-bright-motion.css",
  "public-glass-system.css",
  "public-sculpted-controls.css",
]) {
  assert(!publicSystem.includes(legacyPublicLayer), `public-system.css must not load superseded layer ${legacyPublicLayer}.`);
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
