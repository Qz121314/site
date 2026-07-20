import type { APIRoute } from "astro";
import { selectProductConversionContact } from "@/lib/public/conversions";

export const prerender = false;

function responseHeaders(contentType?: string): HeadersInit {
  return {
    ...(contentType ? { "Content-Type": contentType } : {}),
    "Cache-Control": "no-store, max-age=0",
    "X-Robots-Tag": "noindex, nofollow",
    "Referrer-Policy": "no-referrer",
  };
}

export const GET: APIRoute = async ({ params, request, url }) => {
  const productSlug = params.productSlug ?? "";
  const channelSlug = (url.searchParams.get("channel") ?? "").trim();
  const wantsJson = url.searchParams.get("format") === "json"
    || (request.headers.get("Accept") ?? "").includes("application/json");

  if (!productSlug || !channelSlug) {
    return wantsJson
      ? Response.json({ ok: false, error: "not-found" }, { status: 404, headers: responseHeaders() })
      : new Response("Not Found", { status: 404, headers: responseHeaders("text/plain; charset=utf-8") });
  }

  try {
    const contact = await selectProductConversionContact(channelSlug, productSlug);
    if (!contact) {
      return wantsJson
        ? Response.json({ ok: false, error: "unavailable" }, { status: 404, headers: responseHeaders() })
        : new Response("No contact is currently available.", {
            status: 404,
            headers: responseHeaders("text/plain; charset=utf-8"),
          });
    }

    if (wantsJson) {
      return Response.json(
        {
          ok: true,
          contact: {
            type: contact.type,
            display: contact.display,
            target: contact.target,
          },
        },
        { headers: responseHeaders() },
      );
    }

    return new Response(null, {
      status: 302,
      headers: {
        ...responseHeaders(),
        Location: contact.target,
      },
    });
  } catch (error) {
    console.error(JSON.stringify({ event: "public_conversion_resolve_failed", channelSlug, productSlug, error: String(error) }));
    return wantsJson
      ? Response.json({ ok: false, error: "unavailable" }, { status: 503, headers: responseHeaders() })
      : new Response("Contact service unavailable.", {
          status: 503,
          headers: responseHeaders("text/plain; charset=utf-8"),
        });
  }
};
