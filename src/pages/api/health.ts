import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";

export const prerender = false;

const REQUIRED_TABLES = [
  "site_settings",
  "image_assets",
  "image_deletion_queue",
  "ad_pools",
  "channels",
  "category_filters",
  "categories",
  "category_filter_relations",
  "conversion_groups",
  "conversion_resources",
  "products",
  "product_images",
  "advertisements",
] as const;

type SchemaRow = { table_count: number };
type ReadinessRow = {
  settings_ready: number;
  unassigned_ad_pools: number;
  unassigned_conversion_groups: number;
  pending_image_deletions: number;
};

export const GET: APIRoute = async () => {
  let database: "ok" | "unavailable" = "ok";
  let schema: "ok" | "incomplete" | "unknown" = "unknown";
  let settings: "ok" | "missing" | "unknown" = "unknown";
  let unassignedPools = 0;
  let pendingImageDeletions = 0;

  try {
    await env.DB.prepare("SELECT 1").first();
    const placeholders = REQUIRED_TABLES.map((_, index) => `?${index + 1}`).join(", ");
    const schemaRow = await env.DB.prepare(
      `SELECT COUNT(*) AS table_count
       FROM sqlite_master
       WHERE type = 'table' AND name IN (${placeholders})`,
    ).bind(...REQUIRED_TABLES).first<SchemaRow>();

    schema = Number(schemaRow?.table_count ?? 0) === REQUIRED_TABLES.length ? "ok" : "incomplete";
    if (schema === "ok") {
      const readiness = await env.DB.prepare(
        `SELECT
           EXISTS(SELECT 1 FROM site_settings WHERE id = 1) AS settings_ready,
           (SELECT COUNT(*) FROM ad_pools WHERE channel_id IS NULL) AS unassigned_ad_pools,
           (SELECT COUNT(*) FROM conversion_groups WHERE channel_id IS NULL) AS unassigned_conversion_groups,
           (SELECT COUNT(*) FROM image_deletion_queue) AS pending_image_deletions`,
      ).first<ReadinessRow>();
      settings = readiness?.settings_ready ? "ok" : "missing";
      unassignedPools = Number(readiness?.unassigned_ad_pools ?? 0)
        + Number(readiness?.unassigned_conversion_groups ?? 0);
      pendingImageDeletions = Number(readiness?.pending_image_deletions ?? 0);
    }
  } catch (error) {
    database = "unavailable";
    console.error(JSON.stringify({ event: "health_check_failed", error: String(error) }));
  }

  const ready = database === "ok" && schema === "ok" && settings === "ok";
  const degraded = unassignedPools > 0 || pendingImageDeletions > 0;
  const status = ready ? (degraded ? "degraded" : "ok") : "unavailable";
  const warnings = degraded ? {
    ...(unassignedPools > 0 ? { unassignedPools } : {}),
    ...(pendingImageDeletions > 0 ? { pendingImageDeletions } : {}),
  } : undefined;

  return new Response(JSON.stringify({
    status,
    database,
    schema,
    settings,
    warnings,
    timestamp: new Date().toISOString(),
  }), {
    status: ready ? 200 : 503,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
};
