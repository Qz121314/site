import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { adminReturnUrl, redirectAdmin } from "@/lib/admin/admin-return";
import { automaticSlug, uniqueProductSlug } from "@/lib/admin/automatic-slug";
import { categoryFiltersInsert, productImagesInsert } from "@/lib/admin/bulk-relations";
import { categoryFiltersBelongToChannel } from "@/lib/admin/category-form";
import { parseProductContentForm, validateProductRelations } from "@/lib/admin/product-form";
import { parseProductEntryExtras } from "@/lib/admin/product-entry";
import { removeEmptyGeneratedCategory, resolveProductCategory } from "@/lib/admin/product-category";
import { isSameOriginPost } from "@/lib/auth/session";
import { productImageAssetsReady } from "@/lib/db/image-options";
import { loadNextAdminProductSortOrder } from "@/lib/db/products";

export const prerender = false;

export const POST: APIRoute = async ({ request, params }) => {
  if (!isSameOriginPost(request)) return new Response("Forbidden", { status: 403 });

  const channelId = params.channelId ?? "";
  if (!channelId) return new Response("Not Found", { status: 404 });

  const form = await request.formData();
  const fallbackPath = `/admin/channels/${encodeURIComponent(channelId)}/products`;
  const returnUrl = adminReturnUrl(request, form, fallbackPath);
  const rawTitle = form.get("title");
  const title = typeof rawTitle === "string" ? rawTitle.trim() : "";
  form.set("slug", automaticSlug(title, "product", 96));

  const parsed = parseProductContentForm(form);
  if (!parsed.ok) return redirectAdmin(returnUrl, { error: parsed.code, saved: null });

  const extras = parseProductEntryExtras(form);
  if (!extras.ok) return redirectAdmin(returnUrl, { error: extras.code, saved: null });

  const value = parsed.value;
  const firstImageAssetId = extras.galleryAssetIds[0] ?? null;
  const productId = crypto.randomUUID();
  let generatedCategoryId: string | null = null;

  try {
    const channel = await env.DB.prepare("SELECT id FROM channels WHERE id = ?1")
      .bind(channelId)
      .first<{ id: string }>();
    if (!channel) return redirectAdmin(returnUrl, { error: "not-found", saved: null });

    const [slug, sortOrder] = await Promise.all([
      uniqueProductSlug(channelId, value.title),
      loadNextAdminProductSortOrder(channelId),
    ]);

    if (!(await productImageAssetsReady(extras.galleryAssetIds))) {
      return redirectAdmin(returnUrl, { error: "image", saved: null });
    }

    if (!(await categoryFiltersBelongToChannel(channelId, extras.filterIds))) {
      return redirectAdmin(returnUrl, { error: "filters", saved: null });
    }

    const category = await resolveProductCategory({
      channelId,
      categoryName: extras.categoryName,
    });
    generatedCategoryId = category.created ? category.id : null;

    if (!category.id && extras.filterIds.length > 0) {
      return redirectAdmin(returnUrl, { error: "filter-category", saved: null });
    }

    const relationError = await validateProductRelations(
      channelId,
      category.id,
      value.conversionGroupId,
      "draft",
    );
    if (relationError) {
      if (generatedCategoryId) await removeEmptyGeneratedCategory(generatedCategoryId);
      return redirectAdmin(returnUrl, { error: relationError, saved: null });
    }

    const imageInsert = productImagesInsert(productId, extras.galleryAssetIds);
    const filterInsert = category.id ? categoryFiltersInsert(category.id, extras.filterIds) : null;
    const statements = [
      env.DB.prepare(
        `INSERT INTO products (
           id, channel_id, category_id, conversion_group_id, cover_asset_id,
           title, slug, tags, body_source, body_html, cta_label,
           sort_order, status
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 'draft')`,
      ).bind(
        productId,
        channelId,
        category.id,
        value.conversionGroupId,
        firstImageAssetId,
        value.title,
        slug,
        value.tagsJson,
        value.bodySource,
        value.bodyHtml,
        value.ctaLabel,
        sortOrder,
      ),
      ...(imageInsert ? [env.DB.prepare(imageInsert.sql).bind(...imageInsert.bindings)] : []),
      ...(category.id
        ? [
            env.DB.prepare("DELETE FROM category_filter_relations WHERE category_id = ?1").bind(category.id),
            ...(filterInsert ? [env.DB.prepare(filterInsert.sql).bind(...filterInsert.bindings)] : []),
          ]
        : []),
    ];

    await env.DB.batch(statements);
    return redirectAdmin(returnUrl, { edit: productId, saved: "created", error: null });
  } catch (error) {
    if (generatedCategoryId) {
      try {
        await removeEmptyGeneratedCategory(generatedCategoryId);
      } catch (cleanupError) {
        console.error(JSON.stringify({ event: "generated_category_cleanup_failed", generatedCategoryId, error: String(cleanupError) }));
      }
    }

    console.error(JSON.stringify({ event: "admin_product_create_failed", channelId, title: value.title, error: String(error) }));
    return redirectAdmin(returnUrl, { error: "database", saved: null });
  }
};
