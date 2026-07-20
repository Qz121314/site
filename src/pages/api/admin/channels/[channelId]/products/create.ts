import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { isSameOriginPost } from "@/lib/auth/session";
import {
  isDuplicateProductSlugError,
  parseProductForm,
  validateProductRelations,
} from "@/lib/admin/product-form";
import { categoryFiltersBelongToChannel } from "@/lib/admin/category-form";
import { parseProductEntryExtras } from "@/lib/admin/product-entry";
import {
  removeEmptyGeneratedCategory,
  resolveProductCategory,
} from "@/lib/admin/product-category";
import { imageAssetsExist } from "@/lib/db/image-options";

export const prerender = false;

function entryRedirect(request: Request, channelId: string, params: Record<string, string>): Response {
  const url = new URL(`/admin/channels/${encodeURIComponent(channelId)}/products/new`, request.url);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return Response.redirect(url, 303);
}

function editRedirect(request: Request, channelId: string, productId: string, params: Record<string, string>): Response {
  const url = new URL(
    `/admin/channels/${encodeURIComponent(channelId)}/products/${encodeURIComponent(productId)}`,
    request.url,
  );
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return Response.redirect(url, 303);
}

export const POST: APIRoute = async ({ request, params }) => {
  if (!isSameOriginPost(request)) return new Response("Forbidden", { status: 403 });

  const channelId = params.channelId ?? "";
  if (!channelId) return new Response("Not Found", { status: 404 });

  const form = await request.formData();
  const parsed = parseProductForm(form);
  if (!parsed.ok) return entryRedirect(request, channelId, { error: parsed.code });

  const extras = parseProductEntryExtras(form);
  if (!extras.ok) return entryRedirect(request, channelId, { error: extras.code });

  const value = parsed.value;
  const productId = crypto.randomUUID();
  let generatedCategoryId: string | null = null;

  try {
    const channel = await env.DB.prepare("SELECT id FROM channels WHERE id = ?1")
      .bind(channelId)
      .first<{ id: string }>();
    if (!channel) return entryRedirect(request, channelId, { error: "not-found" });

    if (!(await imageAssetsExist([value.coverAssetId ?? "", ...extras.galleryAssetIds]))) {
      return entryRedirect(request, channelId, { error: "image" });
    }

    if (!(await categoryFiltersBelongToChannel(channelId, extras.filterIds))) {
      return entryRedirect(request, channelId, { error: "filters" });
    }

    const category = await resolveProductCategory({
      channelId,
      categoryId: value.categoryId,
      categoryName: extras.categoryName,
      productStatus: value.status,
      coverAssetId: value.coverAssetId,
    });
    generatedCategoryId = category.created ? category.id : null;

    if (!category.id && extras.filterIds.length > 0) {
      return entryRedirect(request, channelId, { error: "filter-category" });
    }

    const relationError = await validateProductRelations(
      channelId,
      category.id,
      value.conversionGroupId,
      value.status,
    );
    if (relationError) {
      if (generatedCategoryId) await removeEmptyGeneratedCategory(generatedCategoryId);
      return entryRedirect(request, channelId, { error: relationError });
    }

    const statements = [
      env.DB.prepare(
        `INSERT INTO products (
           id, channel_id, category_id, conversion_group_id, cover_asset_id,
           title, slug, tags, body_source, body_html, cta_label,
           featured, sort_order, status
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`,
      ).bind(
        productId,
        channelId,
        category.id,
        value.conversionGroupId,
        value.coverAssetId,
        value.title,
        value.slug,
        value.tagsJson,
        value.bodySource,
        value.bodyHtml,
        value.ctaLabel,
        value.featured ? 1 : 0,
        value.sortOrder,
        value.status,
      ),
      ...extras.galleryAssetIds.map((imageAssetId, index) =>
        env.DB.prepare(
          `INSERT INTO product_images (product_id, image_asset_id, sort_order)
           VALUES (?1, ?2, ?3)`,
        ).bind(productId, imageAssetId, index * 10),
      ),
      ...(category.id
        ? [
            env.DB.prepare("DELETE FROM category_filter_relations WHERE category_id = ?1").bind(category.id),
            ...extras.filterIds.map((filterId) =>
              env.DB.prepare(
                `INSERT INTO category_filter_relations (category_id, filter_id)
                 VALUES (?1, ?2)`,
              ).bind(category.id, filterId),
            ),
          ]
        : []),
    ];

    await env.DB.batch(statements);

    return extras.submitAction === "continue"
      ? entryRedirect(request, channelId, { saved: "created" })
      : editRedirect(request, channelId, productId, { saved: "created" });
  } catch (error) {
    if (generatedCategoryId) {
      try {
        await removeEmptyGeneratedCategory(generatedCategoryId);
      } catch (cleanupError) {
        console.error(JSON.stringify({ event: "generated_category_cleanup_failed", generatedCategoryId, error: String(cleanupError) }));
      }
    }

    console.error(JSON.stringify({ event: "admin_product_create_failed", channelId, slug: value.slug, error: String(error) }));
    return entryRedirect(request, channelId, {
      error: isDuplicateProductSlugError(error) ? "duplicate" : "database",
    });
  }
};
