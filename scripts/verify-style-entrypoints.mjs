import { readFileSync } from "node:fs";

const publicLayout = readFileSync("src/layouts/PublicLayout.astro", "utf8");
const adminLayout = readFileSync("src/layouts/AdminLayout.astro", "utf8");
const publicSystem = readFileSync("src/styles/public-system.css", "utf8");
const publicCommerce = readFileSync("src/styles/public-commerce.css", "utf8");
const publicAds = readFileSync("src/styles/public-ads.css", "utf8");
const publicDesktop = readFileSync("src/styles/public-desktop.css", "utf8");
const adminSystem = readFileSync("src/styles/admin-system.css", "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(publicLayout.includes('import "@/styles/public-system.css";'), "PublicLayout must import public-system.css.");
for (const directImport of ["public-base.css", "public.css", "public-commerce.css", "public-ads.css", "public-desktop.css"]) {
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
  "public-loading.css",
  "public-header-refinement.css",
  "public-commerce.css",
  "public-ads.css",
  "public-desktop.css",
];
let previousIndex = -1;
for (const stylesheet of expectedPublicOrder) {
  const index = publicSystem.indexOf(stylesheet);
  assert(index > previousIndex, `public-system.css must load ${stylesheet} in the documented order.`);
  previousIndex = index;
}

for (const supersededPublicLayer of [
  "public-design-system.css",
  "public-detail-cta.css",
  "public-layout-refresh.css",
  "public-gallery-rail.css",
  "public-category-polish.css",
  "public-premium.css",
  "public-image-first.css",
  "public-interface-polish.css",
  "public-bright-motion.css",
  "public-glass-system.css",
  "public-sculpted-controls.css",
]) {
  assert(!publicSystem.includes(supersededPublicLayer), `public-system.css must not load superseded layer ${supersededPublicLayer}.`);
}

assert(!publicDesktop.includes(".hero-"), "Desktop styles must not retain selectors for the removed Hero carousel.");
assert(!publicDesktop.includes(".category-group-label"), "Desktop styles must not retain the removed category group button label.");
assert(!publicDesktop.includes(".category-group-filter"), "Desktop styles must not retain the removed category group button wrapper.");

assert(publicCommerce.includes("--canvas-0: #ffffff"), "The public commerce theme must use the neutral light canvas.");
assert(publicCommerce.includes("position: fixed !important"), "The mobile detail CTA must remain attached to the viewport.");
assert(publicAds.includes(".affiliate-ad-modal-backdrop"), "The public ad layer must include an isolated modal presentation.");
assert(publicAds.includes(".affiliate-ad-inline"), "The public ad layer must support full-row catalog ads.");
assert(
  publicDesktop.includes("@media (min-width: 768px) and (max-width: 1099px)")
    && publicDesktop.includes("@media (min-width: 1100px)")
    && publicDesktop.includes("@media (min-width: 1400px)"),
  "Tablet, desktop, and wide desktop layouts must use distinct breakpoints.",
);

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
