import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { adminReturnUrl, redirectAdmin } from "@/lib/admin/admin-return";
import { automaticSlug } from "@/lib/admin/automatic-slug";
import { categoryFiltersInsert, productImagesInsert } from "@/lib/admin/bulk-relations";
import { categoryFiltersBelongToChannel } from "@/lib/admin/category-form";
import { parseProductContentForm, validateProductRelations } from "@/lib/admin/product-form";
import { parseProductEntryExtras } from "@/lib/admin/product-entry";
import { removeEmptyGeneratedCategory, resolveProductCategory } from "@/lib/admin/product-category";
import { isSameOriginPost } from "@/lib/auth/session";
import { productImageAssetsReady } from "@/lib/db/image-options";
import type { ProductStatus } from "@/lib/admin/product-form";

export const prerender = false;

export const POST: APIRoute = async ({ request, params }) => {
  if (!isSameOriginPost(request)) return new Response("Forbidden", { status: 403 });

  const channelId = params.channelId ?? "";
  const productId = params.productId ?? "";
  if (!channelId || !productId) return new Response("Not Found", { status: 404 });

  const form = await request.formData();
  const fallbackPath = `/admin/channels/${encodeURIComponent(channelId)}/products?edit=${encodeURIComponent(productId)}`;
  const returnUrl = adminReturnUrl(request, form, fallbackPath);
  const rawTitle = form.get("title");
  const title = typeof rawTitle === "string" ? rawTitle.trim() : "";
  form.set("slug", automaticSlug(title, "product", 96));

  const parsed = parseProductContentForm(form);
  if (!parsed.ok) return redirectAdmin(returnUrl, { edit: productId, error: parsed.code, saved: null });

  const extras = parseProductEntryExtras(form);
  if (!extras.ok) return redirectAdmin(returnUrl, { edit: productId, error: extras.code, saved: null });

  const value = parsed.value;
  const firstImageAssetId = extras.galleryAssetIds[0] ?? null;
  let generatedCategoryId: string | null = null;

  try {
    const product = await env.DB.prepare(
      "SELECT id, category_id, slug, status FROM products WHERE id = ?1 AND channel_id = ?2",
    ).bind(productId, channelId).first<{
      id: string;
      category_id: string | null;
      slug: string;
      status: ProductStatus;
    }>();
    if (!product) return redirectAdmin(returnUrl, { edit: null, error: "not-found", saved: null });

    if (!(await productImageAssetsReady(extras.galleryAssetIds))) {
      return redirectAdmin(returnUrl, { edit: productId, error: "image", saved: null });
    }
    if (product.status === "published" && !firstImageAssetId) {
      return redirectAdmin(returnUrl, { edit: productId, error: "image", saved: null });
    }

    if (!(await categoryFiltersBelongToChannel(channelId, extras.filterIds))) {
      return redirectAdmin(returnUrl, { edit: productId, error: "filters", saved: null });
    }

    const category = await resolveProductCategory({
      channelId,
      categoryId: null,
      categoryName: extras.categoryName,
      productStatus: product.status,
    });
    generatedCategoryId = category.created ? category.id : null;

    if (!category.id && extras.filterIds.length > 0) {
      return redirectAdmin(returnUrl, { edit: productId, error: "filter-category", saved: null });
    }

    const relationError = await validateProductRelations(
      channelId,
      category.id,
      value.conversionGroupId,
      product.status,
    );
    if (relationError) {
      if (generatedCategoryId) await removeEmptyGeneratedCategory(generatedCategoryId);
      return redirectAdmin(returnUrl, { edit: productId, error: relationError, saved: null });
    }

    const imageInsert = productImagesInsert(productId, extras.galleryAssetIds);
    const filterInsert = category.id ? categoryFiltersInsert(category.id, extras.filterIds) : null;
    const statements = [
      ...(product.status === "published"
        ? [env.DB.prepare(
            `UPDATE products
             SET status = 'draft', updated_at = CURRENT_TIMESTAMP
             WHERE id = ?1 AND channel_id = ?2`,
          ).bind(productId, channelId)]
        : []),
      env.DB.prepare(
        `UPDATE products
         SET category_id = ?1,
             conversion_group_id = ?2,
             cover_asset_id = ?3,
             title = ?4,
             slug = ?5,
             tags = ?6,
             body_source = ?7,
             body_html = ?8,
             cta_label = ?9,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?10 AND channel_id = ?11`,
      ).bind(
        category.id,
        value.conversionGroupId,
        firstImageAssetId,
        value.title,
        product.slug,
        value.tagsJson,
        value.bodySource,
        value.bodyHtml,
        value.ctaLabel,
        productId,
        channelId,
      ),
      env.DB.prepare("DELETE FROM product_images WHERE product_id = ?1").bind(productId),
      ...(imageInsert ? [env.DB.prepare(imageInsert.sql).bind(...imageInsert.bindings)] : []),
      ...(category.id
        ? [
            env.DB.prepare("DELETE FROM category_filter_relations WHERE category_id = ?1").bind(category.id),
            ...(filterInsert ? [env.DB.prepare(filterInsert.sql).bind(...filterInsert.bindings)] : []),
          ]
        : []),
      ...(product.status === "published"
        ? [env.DB.prepare(
            `UPDATE products
             SET status = 'published', updated_at = CURRENT_TIMESTAMP
             WHERE id = ?1 AND channel_id = ?2`,
          ).bind(productId, channelId)]
        : []),
    ];

    await env.DB.batch(statements);
    return redirectAdmin(returnUrl, { edit: productId, saved: "updated", error: null });
  } catch (error) {
    if (generatedCategoryId) {
      try {
        await removeEmptyGeneratedCategory(generatedCategoryId);
      } catch (cleanupError) {
        console.error(JSON.stringify({ event: "generated_category_cleanup_failed", generatedCategoryId, error: String(cleanupError) }));
      }
    }

    console.error(JSON.stringify({ event: "admin_product_update_failed", channelId, productId, title: value.title, error: String(error) }));
    return redirectAdmin(returnUrl, { edit: productId, error: "database", saved: null });
  }
};
