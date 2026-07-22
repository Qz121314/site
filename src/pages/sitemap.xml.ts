import type { APIRoute } from "astro";
import { loadPublicSitemapEntries } from "@/lib/db/sitemap";
import { PUBLIC_EDGE_CACHE_SECONDS } from "@/lib/public/cache-policy";

export const prerender = false;

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function normalizeLastModified(value: string): string {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  return normalized.endsWith("Z") ? normalized : `${normalized}Z`;
}

export const GET: APIRoute = async ({ url }) => {
  const entries = await loadPublicSitemapEntries();

  const records: Array<{ location: string; updatedAt: string }> = [
    ...(!entries.hasDefaultChannel && entries.channels.length > 0
      ? [{ location: new URL("/", url.origin).href, updatedAt: entries.siteUpdatedAt }]
      : []),
    ...(entries.hasPrivacy
      ? [{ location: new URL("/privacy", url.origin).href, updatedAt: entries.siteUpdatedAt }]
      : []),
    ...(entries.hasDisclaimer
      ? [{ location: new URL("/disclaimer", url.origin).href, updatedAt: entries.siteUpdatedAt }]
      : []),
    ...entries.channels.map((entry) => ({
      location: new URL(`/${encodeURIComponent(entry.slug)}`, url.origin).href,
      updatedAt: entry.updatedAt,
    })),
    ...entries.categories.map((entry) => ({
      location: new URL(`/${encodeURIComponent(entry.channelSlug)}/category/${encodeURIComponent(entry.slug)}`, url.origin).href,
      updatedAt: entry.updatedAt,
    })),
    ...entries.products.map((entry) => ({
      location: new URL(`/${encodeURIComponent(entry.channelSlug)}/product/${encodeURIComponent(entry.slug)}`, url.origin).href,
      updatedAt: entry.updatedAt,
    })),
  ];

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...records.map((record) =>
      `  <url><loc>${escapeXml(record.location)}</loc><lastmod>${escapeXml(normalizeLastModified(record.updatedAt))}</lastmod></url>`,
    ),
    "</urlset>",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Cloudflare-CDN-Cache-Control": `public, max-age=${PUBLIC_EDGE_CACHE_SECONDS}, must-revalidate`,
    },
  });
};
