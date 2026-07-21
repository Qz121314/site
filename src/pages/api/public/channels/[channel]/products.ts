import type { APIRoute } from "astro";
import {
  findPublicChannel,
  loadPublicCategory,
  loadPublicProducts,
  loadPublicSiteShell,
} from "@/lib/db/public";
import { loadPublicUncategorizedProducts } from "@/lib/db/public-availability";
import { readPublicPage } from "@/lib/public/pagination";
import { normalizePublicSearchQuery } from "@/lib/search/query";

export const prerender = false;

const PUBLIC_EDGE_CACHE_SECONDS = 30;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": status === 200 ? "public, max-age=0, must-revalidate" : "no-store",
      ...(status === 200
        ? {
            "Cloudflare-CDN-Cache-Control": `public, max-age=${PUBLIC_EDGE_CACHE_SECONDS}, stale-while-revalidate=${PUBLIC_EDGE_CACHE_SECONDS * 2}`,
          }
        : {}),
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export const GET: APIRoute = async ({ params, url }) => {
  const channelSlug = params.channel ?? "";
  const pageInput = readPublicPage(url.searchParams.get("page"));
  if (!pageInput.valid) return json({ error: "PAGE_OUT_OF_RANGE" }, 400);

  const categorySlug = (url.searchParams.get("category") ?? "").trim().slice(0, 96);
  const query = normalizePublicSearchQuery(url.searchParams.get("q") ?? "");
  const uncategorizedOnly = url.searchParams.get("uncategorized") === "1";
  if (uncategorizedOnly && categorySlug) return json({ error: "INVALID_PRODUCT_FILTER" }, 400);

  const site = await loadPublicSiteShell();
  const channel = findPublicChannel(site, channelSlug);
  if (!channel) return json({ error: "CHANNEL_NOT_FOUND" }, 404);

  const category = categorySlug
    ? await loadPublicCategory(channel.id, categorySlug, site.r2PublicBaseUrl)
    : null;
  if (categorySlug && !category) return json({ error: "CATEGORY_NOT_FOUND" }, 404);

  const result = uncategorizedOnly
    ? await loadPublicUncategorizedProducts({
        channelId: channel.id,
        baseUrl: site.r2PublicBaseUrl,
        page: pageInput.page,
      })
    : await loadPublicProducts({
        channelId: channel.id,
        baseUrl: site.r2PublicBaseUrl,
        page: pageInput.page,
        categoryId: category?.id ?? null,
        query,
      });

  return json(result);
};
