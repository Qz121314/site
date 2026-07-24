import type { APIRoute } from "astro";
import { loadPublicSitemapEntries } from "@/lib/db/sitemap";
import { PUBLIC_DISCOVERY_EDGE_CACHE_SECONDS } from "@/lib/public/cache-policy";
import { resolvePublicOrigin } from "@/lib/public/origin";
import { normalizeSitemapLastModified } from "@/lib/public/sitemap";

export const prerender = false;

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export const GET: APIRoute = async ({ request, url }) => {
  const entries = await loadPublicSitemapEntries();
  const origin = resolvePublicOrigin(url, request.headers);

  const records: Array<{ location: string; updatedAt: string }> = [
    ...(entries.hasPrivacy
      ? [{ location: new URL("/privacy", origin).href, updatedAt: entries.siteUpdatedAt }]
      : []),
    ...(entries.hasDisclaimer
      ? [{ location: new URL("/disclaimer", origin).href, updatedAt: entries.siteUpdatedAt }]
      : []),
    ...entries.channels.map((entry) => ({
      location: new URL(`/${encodeURIComponent(entry.slug)}`, origin).href,
      updatedAt: entry.updatedAt,
    })),
    ...entries.categories.map((entry) => ({
      location: entry.hasCategoryNavigation
        ? new URL(`/${encodeURIComponent(entry.channelSlug)}/category/${encodeURIComponent(entry.slug)}`, origin).href
        : new URL(`/${encodeURIComponent(entry.channelSlug)}?category=${encodeURIComponent(entry.slug)}`, origin).href,
      updatedAt: entry.updatedAt,
    })),
    ...entries.products.map((entry) => ({
      location: new URL(`/${encodeURIComponent(entry.channelSlug)}/product/${encodeURIComponent(entry.slug)}`, origin).href,
      updatedAt: entry.updatedAt,
    })),
  ];

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...records.map((record) => {
      const lastModified = normalizeSitemapLastModified(record.updatedAt);
      return `  <url><loc>${escapeXml(record.location)}</loc>${lastModified ? `<lastmod>${escapeXml(lastModified)}</lastmod>` : ""}</url>`;
    }),
    "</urlset>",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Cloudflare-CDN-Cache-Control": `public, max-age=${PUBLIC_DISCOVERY_EDGE_CACHE_SECONDS}, must-revalidate`,
    },
  });
};
