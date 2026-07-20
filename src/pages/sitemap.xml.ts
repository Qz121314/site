import type { APIRoute } from "astro";
import { loadPublicSitemapEntries, loadPublicSiteShell } from "@/lib/db/public";

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
  const [site, entries] = await Promise.all([
    loadPublicSiteShell(),
    loadPublicSitemapEntries(),
  ]);

  if (site.noindexEnabled) {
    return new Response("<?xml version=\"1.0\" encoding=\"UTF-8\"?><urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\"></urlset>", {
      headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  const records: Array<{ location: string; updatedAt?: string }> = [
    { location: new URL("/privacy", url.origin).href },
    { location: new URL("/disclaimer", url.origin).href },
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
      `  <url><loc>${escapeXml(record.location)}</loc>${record.updatedAt ? `<lastmod>${escapeXml(normalizeLastModified(record.updatedAt))}</lastmod>` : ""}</url>`,
    ),
    "</urlset>",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
};
