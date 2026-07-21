import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { isSameOriginPost } from "@/lib/auth/session";
import { imageAssetsExist } from "@/lib/db/image-options";

export const prerender = false;

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

const redirect = (request: Request, query: string) =>
  Response.redirect(new URL(`/admin/settings?${query}`, request.url), 303);

function readText(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readOptionalId(form: FormData, key: string): string | null | undefined {
  const value = readText(form, key);
  if (!value) return null;
  return ID_PATTERN.test(value) ? value : undefined;
}

function normalizeR2BaseUrl(value: string): string | null {
  if (!value) return "";

  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.pathname !== "/" && url.pathname !== "")
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

export const POST: APIRoute = async ({ request }) => {
  if (!isSameOriginPost(request)) return new Response("Forbidden", { status: 403 });

  const form = await request.formData();
  const siteName = readText(form, "siteName");
  const siteDescription = readText(form, "siteDescription");
  const defaultChannelId = readText(form, "defaultChannelId") || null;
  const logoAssetId = readOptionalId(form, "logoAssetId");
  const faviconAssetId = readOptionalId(form, "faviconAssetId");
  const r2PublicBaseUrl = normalizeR2BaseUrl(readText(form, "r2PublicBaseUrl"));
  const ga4Id = readText(form, "ga4Id").toUpperCase();
  const metaPixelId = readText(form, "metaPixelId");
  const privacyContent = readText(form, "privacyContent");
  const disclaimerContent = readText(form, "disclaimerContent");
  const adultGateEnabled = form.get("adultGateEnabled") === "1" ? 1 : 0;

  if (!siteName || siteName.length > 80) return redirect(request, "error=site-name");
  if (siteDescription.length > 300) return redirect(request, "error=description");
  if (logoAssetId === undefined || faviconAssetId === undefined) return redirect(request, "error=image");
  if (r2PublicBaseUrl === null) return redirect(request, "error=r2-url");
  if (ga4Id && !/^G-[A-Z0-9]{4,20}$/u.test(ga4Id)) return redirect(request, "error=ga4");
  if (metaPixelId && !/^\d{5,30}$/u.test(metaPixelId)) return redirect(request, "error=meta");
  if (privacyContent.length > 20_000) return redirect(request, "error=privacy");
  if (disclaimerContent.length > 20_000) return redirect(request, "error=disclaimer");

  try {
    if (defaultChannelId) {
      const channel = await env.DB.prepare("SELECT id FROM channels WHERE id = ?1")
        .bind(defaultChannelId)
        .first<{ id: string }>();
      if (!channel) return redirect(request, "error=default-channel");
    }

    if (!(await imageAssetsExist([logoAssetId ?? "", faviconAssetId ?? ""]))) {
      return redirect(request, "error=image");
    }

    await env.DB.batch([
      env.DB.prepare("INSERT OR IGNORE INTO site_settings (id) VALUES (1)"),
      env.DB.prepare(
        `UPDATE site_settings
         SET site_name = ?1,
             site_description = ?2,
             logo_asset_id = ?3,
             favicon_asset_id = ?4,
             default_channel_id = ?5,
             r2_public_base_url = ?6,
             ga4_id = ?7,
             meta_pixel_id = ?8,
             adult_gate_enabled = ?9,
             privacy_content = ?10,
             disclaimer_content = ?11,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = 1`,
      ).bind(
        siteName,
        siteDescription,
        logoAssetId,
        faviconAssetId,
        defaultChannelId,
        r2PublicBaseUrl,
        ga4Id,
        metaPixelId,
        adultGateEnabled,
        privacyContent,
        disclaimerContent,
      ),
    ]);

    return redirect(request, "saved=1");
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_site_settings_update_failed", error: String(error) }));
    return redirect(request, "error=database");
  }
};
