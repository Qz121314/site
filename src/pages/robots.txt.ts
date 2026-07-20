import type { APIRoute } from "astro";
import { loadPublicSiteShell } from "@/lib/db/public";

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const site = await loadPublicSiteShell();
  const lines = site.noindexEnabled
    ? ["User-agent: *", "Disallow: /"]
    : [
        "User-agent: *",
        "Allow: /",
        "Disallow: /admin",
        "Disallow: /api/admin",
        "Disallow: /go/",
        `Sitemap: ${new URL("/sitemap.xml", url.origin).href}`,
      ];

  return new Response(`${lines.join("\n")}\n`, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
};
