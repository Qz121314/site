import type { APIRoute } from "astro";
import { selectProductConversionTarget } from "@/lib/public/conversions";

export const prerender = false;

export const GET: APIRoute = async ({ params, url }) => {
  const productSlug = params.productSlug ?? "";
  const channelSlug = (url.searchParams.get("channel") ?? "").trim();
  if (!productSlug || !channelSlug) {
    return new Response("Not Found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  try {
    const target = await selectProductConversionTarget(channelSlug, productSlug);
    if (!target) {
      return new Response("No conversion resource is currently available.", {
        status: 404,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Robots-Tag": "noindex, nofollow",
        },
      });
    }

    return new Response(null, {
      status: 302,
      headers: {
        Location: target,
        "Cache-Control": "no-store, max-age=0",
        "X-Robots-Tag": "noindex, nofollow",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (error) {
    console.error(JSON.stringify({ event: "public_conversion_redirect_failed", channelSlug, productSlug, error: String(error) }));
    return new Response("Conversion service unavailable.", {
      status: 503,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }
};
