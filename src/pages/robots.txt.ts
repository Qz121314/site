import type { APIRoute } from "astro";
import { PUBLIC_EDGE_CACHE_SECONDS } from "@/lib/public/cache-policy";

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const lines = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /api/",
    "Disallow: /go/",
    `Sitemap: ${new URL("/sitemap.xml", url.origin).href}`,
  ];

  return new Response(`${lines.join("\n")}\n`, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Cloudflare-CDN-Cache-Control": `public, max-age=${PUBLIC_EDGE_CACHE_SECONDS}, must-revalidate`,
    },
  });
};
