import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { isSameOriginPost } from "@/lib/auth/session";
import { parseProductForm, validateProductRelations } from "@/lib/admin/product-form";
import { automaticSlug, uniqueProductSlug } from "@/lib/admin/automatic-slug";
import { categoryFiltersBelongToChannel } from "@/lib/admin/category-form";
import { parseProductEntryExtras } from "@/lib/admin/product-entry";
import { removeEmptyGeneratedCategory, resolveProductCategory } from "@/lib/admin/product-category";
import { imageAssetsExist } from "@/lib/db/image-options";

export const prerender = false;

function redirect(request: Request, channelId: string, productId: string, params: Record<string, string>): Response {
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
  const productId = params.productId ?? "";
  if (!channelId || !productId) return new Response("Not Found", { status: 404 });

  const form = await request.formData();
  const rawTitle = form.get("title");
  const title = typeof rawTitle === "string" ? rawTitle.trim() : "";
  form.set("slug", automaticSlug(title, "product", 96));

  const parsed = parseProductForm(form);
  if (!parsed.ok) return redirect(request, channelId, productId, { error: parsed.code });

  const extras = parseProductEntryExtras(form);
  if (!extras.ok) return redirect(request, channelId, productId, { error: extras.code });

  const value = parsed.value;
  const firstImageAssetId = extras.galleryAssetIds[0] ?? null;
  if (value.status === "published" && !firstImageAssetId) {
    return redirect(request, channelId, productId, { error: "image" });
  }

  let generatedCategoryId: string | null = null;

  try {
    const product = await env.DB.prepare(
      "SELECT id, category_id FROM products WHERE id = ?1 AND channel_id = ?2",
    ).bind(productId, channelId).first<{ id: string; category_id: string | null }>();
    if (!product) return redirect(request, channelId, productId, { error: "not-found" });

    const slug = await uniqueProductSlug(channelId, value.title, productId);

    if (!(await imageAssetsExist(extras.galleryAssetIds))) {
      return redirect(request, channelId, productId, { error: "image" });
    }

    if (!(await categoryFiltersBelongToChannel(channelId, extras.filterIds))) {
      return redirect(request, channelId, productId, { error: "filters" });
    }

    const category = await resolveProductCategory({
      channelId,
      categoryId: value.categoryId,
      categoryName: extras.categoryName,
      productStatus: value.status,
      coverAssetId: firstImageAssetId,
    });
    generatedCategoryId = category.created ? category.id : null;

    if (!category.id && extras.filterIds.length > 0) {
      return redirect(request, channelId, productId, { error: "filter-category" });
    }

    const relationError = await validateProductRelations(
      channelId,
      category.id,
      value.conversionGroupId,
      value.status,
    );
    if (relationError) {
      if (generatedCategoryId) await removeEmptyGeneratedCategory(generatedCategoryId);
      return redirect(request, channelId, productId, { error: relationError });
    }

    const statements = [
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
             featured = ?10,
             sort_order = ?11,
             status = ?12,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?13 AND channel_id = ?14`,
      ).bind(
        category.id,
        value.conversionGroupId,
        firstImageAssetId,
        value.title,
        slug,
        value.tagsJson,
        value.bodySource,
        value.bodyHtml,
        value.ctaLabel,
        value.featured ? 1 : 0,
        value.sortOrder,
        value.status,
        productId,
        channelId,
      ),
      env.DB.prepare("DELETE FROM product_images WHERE product_id = ?1").bind(productId),
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

    if (product.category_id && product.category_id !== category.id) {
      try {
        await removeEmptyGeneratedCategory(product.category_id);
      } catch (cleanupError) {
        console.error(JSON.stringify({ event: "old_category_cleanup_failed", categoryId: product.category_id, error: String(cleanupError) }));
      }
    }

    return redirect(request, channelId, productId, { saved: "updated" });
  } catch (error) {
    if (generatedCategoryId) {
      try {
        await removeEmptyGeneratedCategory(generatedCategoryId);
      } catch (cleanupError) {
        console.error(JSON.stringify({ event: "generated_category_cleanup_failed", generatedCategoryId, error: String(cleanupError) }));
      }
    }

    console.error(JSON.stringify({ event: "admin_product_update_failed", channelId, productId, title: value.title, error: String(error) }));
    return redirect(request, channelId, productId, { error: "database" });
  }
};
