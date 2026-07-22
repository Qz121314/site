import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("public entry redirects to a configured or first published channel", async () => {
  const [home, layout, navigation] = await Promise.all([
    readFile(new URL("../src/pages/index.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/layouts/PublicLayout.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/components/public/ChannelNavigation.astro", import.meta.url), "utf8"),
  ]);

  assert.match(home, /site\.defaultChannelSlug \?\? site\.channels\[0\]\?\.slug/u);
  assert.match(home, /Astro\.redirect\(`\/\$\{encodeURIComponent\(entryChannelSlug\)\}`/u);
  assert.match(home, /showChannelNavigation=\{false\}/u);
  assert.match(layout, /site\.logoUrl \? \(/u);
  assert.match(layout, /class="public-brand-logo"/u);
  assert.match(navigation, /channels\.length > 1/u);
});

test("only pages with a parent route provide back navigation", async () => {
  const [channel, category, product, search, privacy, disclaimer] = await Promise.all([
    readFile(new URL("../src/pages/[channel]/index.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/[channel]/category/[category].astro", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/[channel]/product/[product].astro", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/[channel]/search.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/privacy.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/disclaimer.astro", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(channel, /backHref=/u);
  assert.match(category, /backHref=\{returnUrl\}/u);
  assert.match(product, /backHref=\{product \? returnUrl : null\}/u);
  assert.match(search, /<PublicPageHeader[\s\S]*?href=\{`\/\$\{encodeURIComponent\(channel\.slug\)\}`\}/u);
  assert.match(privacy, /backHref="\/"/u);
  assert.match(disclaimer, /backHref="\/"/u);
});
