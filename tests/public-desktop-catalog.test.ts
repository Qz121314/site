import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("desktop catalog integrates sections, active filters, categories, and products without changing mobile navigation", async () => {
  const [
    channel,
    category,
    sidebar,
    row,
    interaction,
    desktopQueries,
    integratedStyles,
    hierarchyStyles,
    consistencyStyles,
    mobileStyles,
    productCard,
    productLinks,
    productDirectory,
    baseStyles,
    system,
  ] = await Promise.all([
    readFile(new URL("../src/pages/[channel]/index.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/[channel]/category/[category].astro", import.meta.url), "utf8"),
    readFile(new URL("../src/components/public/DesktopCatalogSidebarV2.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/components/public/DesktopCatalogRow.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/scripts/public-desktop-workspace.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/db/public-desktop.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-desktop-ui-polish.css", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-desktop-navigation-hierarchy.css", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-product-card-consistency.css", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-category-navigation.css", import.meta.url), "utf8"),
    readFile(new URL("../src/components/public/ProductCard.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/scripts/public-product-links.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/scripts/public-product-directory.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-base.css", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-system.css", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(channel, /loadPublicDesktopFilterMap/u);
  assert.match(channel, /loadPublicProductPreviewGroups/u);
  assert.doesNotMatch(channel, /Promise\.all\(desktopGroupInputs\.map/u);
  assert.match(channel, /integrated-desktop-catalog/u);
  assert.match(channel, /<DesktopCatalogSidebarV2/u);
  assert.match(channel, /<DesktopCatalogRow/u);
  assert.match(channel, /desktop-direct-catalog-panel/u);

  assert.doesNotMatch(category, /loadPublicDesktopFilterMap/u);
  assert.match(category, /<DesktopCatalogSidebarV2/u);
  assert.match(category, /class="desktop-catalog-heading"/u);
  assert.match(category, /desktop-catalog-panel/u);
  assert.match(category, /active=\{item\.id === category\.id\}/u);

  assert.match(sidebar, /site\.channels\.map/u);
  assert.match(sidebar, /const expanded = active && filters\.length > 0/u);
  assert.match(sidebar, /aria-expanded=\{expanded \? "true" : undefined\}/u);
  assert.match(sidebar, /data-desktop-filter-link/u);
  assert.match(row, /class="desktop-density-category-panel"/u);
  assert.match(row, /class="desktop-density-product-panel"/u);
  assert.match(row, /data-desktop-filter-panel/u);
  assert.match(interaction, /panel\.hidden = !active/u);
  assert.doesNotMatch(interaction, /scrollIntoView|IntersectionObserver/u);

  assert.match(desktopQueries, /EXISTS \([\s\S]*category_filter_relations/u);
  assert.match(desktopQueries, /export async function loadPublicProductPreviewGroups/u);
  assert.match(desktopQueries, /const limitParameter = parameter\(group\.limit\)/u);
  assert.match(desktopQueries, /LIMIT \$\{limitParameter\}/u);
  assert.match(desktopQueries, /queries\.join\(" UNION ALL "\)/u);
  assert.match(desktopQueries, /\.bind\(\.\.\.bindings\)[\s\S]*\.all<PublicProductPreviewRow>/u);

  assert.match(integratedStyles, /--desktop-nav-width: 12rem/u);
  assert.match(integratedStyles, /--desktop-category-width: 11rem/u);
  assert.match(integratedStyles, /grid-template-columns: var\(--desktop-nav-width\) minmax\(0, 1fr\)/u);
  assert.match(integratedStyles, /\.desktop-catalog-panel/u);
  assert.match(integratedStyles, /grid-template-columns: var\(--desktop-category-width\) minmax\(0, 1fr\)/u);
  assert.match(integratedStyles, /repeat\(auto-fill, minmax\(12\.5rem, 13\.75rem\)\)/u);
  assert.match(integratedStyles, /\.product-card \{[\s\S]*?max-width: 13\.75rem/u);
  assert.match(integratedStyles, /\.product-card \.visual-card-overlay \{[\s\S]*?position: absolute/u);
  assert.match(integratedStyles, /--desktop-accent: #b69058/u);
  assert.match(hierarchyStyles, /\.desktop-nav-section-link::after[\s\S]*?content: "›"/u);
  assert.match(hierarchyStyles, /\.desktop-nav-filter-link\.is-active[\s\S]*?border-left-color: rgb\(var\(--section-accent\)\)/u);
  assert.match(hierarchyStyles, /\.desktop-catalog-heading \{[\s\S]*?clip: rect\(0 0 0 0\)/u);

  assert.match(productCard, /class="visual-card-media-frame"/u);
  assert.match(productCard, /public-product-links/u);
  assert.match(productDirectory, /frame\.className = "visual-card-media-frame"/u);
  assert.match(productDirectory, /frame\.appendChild\(image\)/u);
  assert.match(productDirectory, /frame\.appendChild\(placeholder\)/u);
  assert.doesNotMatch(productLinks, /visual-card-media-frame/u);
  assert.match(consistencyStyles, /aspect-ratio: 4 \/ 5/u);
  assert.match(consistencyStyles, /height: 100%/u);
  assert.match(consistencyStyles, /object-fit: cover/u);
  assert.match(productLinks, /link\.target = "_blank"/u);
  assert.match(productLinks, /link\.rel = "noopener"/u);
  assert.match(productLinks, /desktopMedia\.matches/u);

  assert.match(mobileStyles, /@media \(max-width: 767px\)/u);
  assert.match(mobileStyles, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/u);
  assert.match(mobileStyles, /height: 3\.25rem/u);
  assert.match(system, /@import "\.\/public-desktop-catalog\.css";/u);
  assert.match(system, /@import "\.\/public-desktop-ui-polish\.css";/u);
  assert.match(system, /@import "\.\/public-desktop-navigation-hierarchy\.css";/u);
  assert.match(system, /@import "\.\/public-product-card-consistency\.css";/u);
  assert.doesNotMatch(system, /public-desktop-density-finish/u);

  assert.match(baseStyles, /-webkit-tap-highlight-color: transparent/u);
  assert.match(baseStyles, /-webkit-user-drag: none/u);
  assert.doesNotMatch(baseStyles, /outline:\s*none/u);
});
