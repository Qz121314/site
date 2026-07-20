import type { APIRoute } from "astro";
import {
  loadPublicCategory,
  loadPublicChannel,
  loadPublicProducts,
  loadPublicSiteShell,
} from "@/lib/db/public";

export const prerender = false;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export const GET: APIRoute = async ({ params, url }) => {
  const channelSlug = params.channel ?? "";
  const pageValue = Number(url.searchParams.get("page") ?? "1");
  const page = Number.isSafeInteger(pageValue) && pageValue > 0 ? Math.min(pageValue, 10_000) : 1;
  const categorySlug = (url.searchParams.get("category") ?? "").trim().slice(0, 96);
  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 100);

  const [site, channel] = await Promise.all([
    loadPublicSiteShell(),
    loadPublicChannel(channelSlug),
  ]);
  if (!channel) return json({ error: "CHANNEL_NOT_FOUND" }, 404);

  const category = categorySlug
    ? await loadPublicCategory(channel.id, categorySlug, site.r2PublicBaseUrl)
    : null;
  if (categorySlug && !category) return json({ error: "CATEGORY_NOT_FOUND" }, 404);

  const result = await loadPublicProducts({
    channelId: channel.id,
    baseUrl: site.r2PublicBaseUrl,
    page,
    categoryId: category?.id ?? null,
    query,
  });

  return json(result);
};
