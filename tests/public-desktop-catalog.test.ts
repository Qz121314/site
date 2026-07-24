import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("desktop catalog presents section filters, categories, and products without changing mobile navigation", async () => {
  const [
    channel,
    category,
    sidebar,
    row,
    desktopQueries,
    desktopStyles,
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
    readFile(new URL("../src/components/public/DesktopCatalogSidebar.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/components/public/DesktopCatalogRow.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/db/public-desktop.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-desktop-catalog.css", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-product-card-consistency.css", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-category-navigation.css", import.meta.url), "utf8"),
    readFile(new URL("../src/components/public/ProductCard.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/scripts/public-product-links.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/scripts/public-product-directory.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-base.css", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-system.css", import.meta.url), "utf8"),
  ]);

  assert.match(channel, /loadPublicDesktopFilterMap\(desktopFilterChannelIds\)/u);
  assert.match(channel, /loadPublicProductPreviewGroups/u);
  assert.doesNotMatch(channel, /Promise\.all\(desktopGroupInputs\.map/u);
  assert.match(channel, /class="desktop-density-workspace desktop-channel-catalog"/u);
  assert.match(channel, /<DesktopCatalogRow/u);
  assert.doesNotMatch(channel, /<h1>\{channel\.name\}<\/h1>/u);

  assert.match(category, /filtersByChannel=\{filtersByChannel\}/u);
  assert.match(category, /class="directory-page-title desktop-directory-title"/u);
  assert.match(category, /class="desktop-density-row desktop-density-row-focus"/u);
  assert.match(category, /active=\{item\.id === category\.id\}/u);

  const sectionPosition = sidebar.indexOf('class="desktop-density-section-link"');
  const filterPosition = sidebar.indexOf('class="desktop-density-filter-list"');
  assert.ok(sectionPosition >= 0);
  assert.ok(filterPosition > sectionPosition);
  assert.match(sidebar, /site\.channels\.map/u);
  assert.match(sidebar, /#filter-\$\{encodeURIComponent\(filter\.slug\)\}/u);
  assert.match(row, /class="desktop-density-category-panel"/u);
  assert.match(row, /class="desktop-density-product-panel"/u);
  assert.match(row, /data-desktop-filter-row/u);

  assert.match(desktopQueries, /EXISTS \([\s\S]*category_filter_relations/u);
  assert.match(desktopQueries, /export async function loadPublicProductPreviewGroups/u);
  assert.match(desktopQueries, /const limitParameter = parameter\(group\.limit\)/u);
  assert.match(desktopQueries, /LIMIT \$\{limitParameter\}/u);
  assert.match(desktopQueries, /queries\.join\(" UNION ALL "\)/u);
  assert.match(desktopQueries, /\.bind\(\.\.\.bindings\)[\s\S]*\.all<PublicProductPreviewRow>/u);

  assert.match(desktopStyles, /grid-template-columns: clamp\(14\.5rem, 16vw, 17rem\) minmax\(0, 1fr\)/u);
  assert.match(desktopStyles, /grid-template-columns: clamp\(12\.5rem, 15vw, 15\.5rem\) minmax\(0, 1fr\)/u);
  assert.match(desktopStyles, /\.desktop-density-category-grid \{[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/u);
  assert.match(desktopStyles, /\.desktop-density-product-grid,[\s\S]*repeat\(3, minmax\(0, 1fr\)\)/u);
  assert.match(desktopStyles, /@media \(min-width: 1360px\)[\s\S]*repeat\(4, minmax\(0, 1fr\)\)/u);
  assert.match(desktopStyles, /@media \(min-width: 1760px\)[\s\S]*repeat\(5, minmax\(0, 1fr\)\)/u);
  assert.doesNotMatch(desktopStyles, /repeat\(auto-fill/u);

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
  assert.match(system, /@import "\.\/public-product-card-consistency\.css";/u);

  assert.match(baseStyles, /-webkit-tap-highlight-color: transparent/u);
  assert.match(baseStyles, /-webkit-user-drag: none/u);
  assert.doesNotMatch(baseStyles, /outline:\s*none/u);
});
