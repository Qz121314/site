import type { APIRoute } from "astro";
import { PUBLIC_EDGE_CACHE_SECONDS } from "@/lib/public/cache-policy";
import { resolvePublicOrigin } from "@/lib/public/origin";

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
  const origin = resolvePublicOrigin(url, request.headers);
  const lines = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /api/",
    "Disallow: /go/",
    `Sitemap: ${new URL("/sitemap.xml", origin).href}`,
  ];

  return new Response(`${lines.join("\n")}\n`, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Cloudflare-CDN-Cache-Control": `public, max-age=${PUBLIC_EDGE_CACHE_SECONDS}, must-revalidate`,
    },
  });
};
