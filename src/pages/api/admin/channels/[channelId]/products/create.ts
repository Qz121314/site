import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { isSameOriginPost } from "@/lib/auth/session";
import { parseProductForm, validateProductRelations } from "@/lib/admin/product-form";
import { automaticSlug, uniqueProductSlug } from "@/lib/admin/automatic-slug";
import { categoryFiltersBelongToChannel } from "@/lib/admin/category-form";
import { parseProductEntryExtras } from "@/lib/admin/product-entry";
import { categoryFiltersInsert, productImagesInsert } from "@/lib/admin/bulk-relations";
import { removeEmptyGeneratedCategory, resolveProductCategory } from "@/lib/admin/product-category";
import { renderProductBody } from "@/lib/admin/product-body";
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
  const rawTitle = form.get("title");
  const title = typeof rawTitle === "string" ? rawTitle.trim() : "";
  form.set("slug", automaticSlug(title, "product", 96));

  const parsed = parseProductForm(form);
  if (!parsed.ok) return entryRedirect(request, channelId, { error: parsed.code });

  const extras = parseProductEntryExtras(form);
  if (!extras.ok) return entryRedirect(request, channelId, { error: extras.code });

  const value = {
    ...parsed.value,
    bodyHtml: renderProductBody(parsed.value.bodySource),
  };
  const firstImageAssetId = extras.galleryAssetIds[0] ?? null;
  if (value.status === "published" && !firstImageAssetId) {
    return entryRedirect(request, channelId, { error: "image" });
  }

  const productId = crypto.randomUUID();
  let generatedCategoryId: string | null = null;

  try {
    const channel = await env.DB.prepare("SELECT id FROM channels WHERE id = ?1")
      .bind(channelId)
      .first<{ id: string }>();
    if (!channel) return entryRedirect(request, channelId, { error: "not-found" });

    const slug = await uniqueProductSlug(channelId, value.title);

    if (!(await imageAssetsExist(extras.galleryAssetIds))) {
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
      coverAssetId: firstImageAssetId,
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

    const imageInsert = productImagesInsert(productId, extras.galleryAssetIds);
    const filterInsert = category.id ? categoryFiltersInsert(category.id, extras.filterIds) : null;
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

    console.error(JSON.stringify({ event: "admin_product_create_failed", channelId, title: value.title, error: String(error) }));
    return entryRedirect(request, channelId, { error: "database" });
  }
};
