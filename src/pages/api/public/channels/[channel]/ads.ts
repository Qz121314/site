import type { APIRoute } from "astro";
import { AD_DEVICE_TYPES, type AdDeviceType } from "@/lib/admin/ad-form";
import { loadPublicAffiliateAdCandidates } from "@/lib/db/public-ads";

export const prerender = false;

export const GET: APIRoute = async ({ params, url }) => {
  const channelSlug = params.channel ?? "";
  const deviceType = url.searchParams.get("device") ?? "";
  if (!channelSlug) return Response.json({ ok: false, error: "not-found" }, { status: 404 });
  if (!AD_DEVICE_TYPES.includes(deviceType as AdDeviceType)) {
    return Response.json({ ok: false, error: "device" }, { status: 400 });
  }

  try {
    const candidates = await loadPublicAffiliateAdCandidates(channelSlug, deviceType as AdDeviceType);
    return Response.json(
      {
        ok: true,
        candidates,
        meta: {
          channelSlug,
          device: deviceType,
          counts: {
            banners: candidates.banners.length,
            verticals: candidates.verticals.length,
            modals: candidates.modals.length,
          },
        },
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error(JSON.stringify({
      event: "public_affiliate_ads_read_failed",
      channelSlug,
      deviceType,
      error: String(error),
    }));
    return Response.json({ ok: false, error: "database" }, { status: 500 });
  }
};
