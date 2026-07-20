import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { isSameOriginPost } from "@/lib/auth/session";

export const prerender = false;

const redirect = (request: Request, query: string) =>
  Response.redirect(new URL(`/admin/settings?${query}`, request.url), 303);

function readText(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
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
  const r2PublicBaseUrl = normalizeR2BaseUrl(readText(form, "r2PublicBaseUrl"));
  const ga4Id = readText(form, "ga4Id").toUpperCase();
  const metaPixelId = readText(form, "metaPixelId");
  const allFilterLabel = readText(form, "allFilterLabel");
  const privacyContent = readText(form, "privacyContent");
  const disclaimerContent = readText(form, "disclaimerContent");
  const adultGateEnabled = form.get("adultGateEnabled") === "1" ? 1 : 0;
  const noindexEnabled = form.get("noindexEnabled") === "1" ? 1 : 0;

  if (!siteName || siteName.length > 80) return redirect(request, "error=site-name");
  if (siteDescription.length > 300) return redirect(request, "error=description");
  if (r2PublicBaseUrl === null) return redirect(request, "error=r2-url");
  if (ga4Id && !/^G-[A-Z0-9]{4,20}$/u.test(ga4Id)) return redirect(request, "error=ga4");
  if (metaPixelId && !/^\d{5,30}$/u.test(metaPixelId)) return redirect(request, "error=meta");
  if (!allFilterLabel || allFilterLabel.length > 24) return redirect(request, "error=all-label");
  if (privacyContent.length > 20_000) return redirect(request, "error=privacy");
  if (disclaimerContent.length > 20_000) return redirect(request, "error=disclaimer");

  try {
    if (defaultChannelId) {
      const channel = await env.DB.prepare("SELECT id FROM channels WHERE id = ?1")
        .bind(defaultChannelId)
        .first<{ id: string }>();
      if (!channel) return redirect(request, "error=default-channel");
    }

    await env.DB.batch([
      env.DB.prepare("INSERT OR IGNORE INTO site_settings (id) VALUES (1)"),
      env.DB.prepare(
        `UPDATE site_settings
         SET site_name = ?1,
             site_description = ?2,
             default_channel_id = ?3,
             r2_public_base_url = ?4,
             ga4_id = ?5,
             meta_pixel_id = ?6,
             adult_gate_enabled = ?7,
             noindex_enabled = ?8,
             all_filter_label = ?9,
             privacy_content = ?10,
             disclaimer_content = ?11,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = 1`,
      ).bind(
        siteName,
        siteDescription,
        defaultChannelId,
        r2PublicBaseUrl,
        ga4Id,
        metaPixelId,
        adultGateEnabled,
        noindexEnabled,
        allFilterLabel,
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
