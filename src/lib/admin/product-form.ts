import { env } from "cloudflare:workers";

export const PRODUCT_STATUSES = ["draft", "published", "disabled"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export type ProductFormValue = {
  title: string;
  slug: string;
  categoryId: string | null;
  conversionGroupId: string | null;
  tags: string[];
  tagsJson: string;
  bodySource: string;
  bodyHtml: string;
  ctaLabel: string;
  featured: boolean;
  sortOrder: number;
  status: ProductStatus;
};

export type ProductFormErrorCode =
  | "title"
  | "slug"
  | "category"
  | "conversion"
  | "tags"
  | "body"
  | "cta"
  | "sort"
  | "status";

export type ProductRelationErrorCode =
  | "category"
  | "category-unavailable"
  | "conversion"
  | "conversion-required"
  | "conversion-unavailable";

export type ProductFormResult =
  | { ok: true; value: ProductFormValue }
  | { ok: false; code: ProductFormErrorCode };

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function readText(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function readOptionalId(form: FormData, name: string): string | null | undefined {
  const value = readText(form, name);
  if (!value) return null;
  return ID_PATTERN.test(value) ? value : undefined;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderEmphasis(value: string): string {
  return escapeHtml(value)
    .replace(/\*\*([^*\n]{1,500})\*\*/gu, "<strong>$1</strong>")
    .replace(/(?<!\*)\*([^*\n]{1,500})\*(?!\*)/gu, "<em>$1</em>");
}

function renderInline(value: string): string {
  const linkPattern = /\[([^\]\n]{1,200})\]\((https?:\/\/[^\s)]+)\)/giu;
  let output = "";
  let cursor = 0;

  for (const match of value.matchAll(linkPattern)) {
    const index = match.index ?? 0;
    output += renderEmphasis(value.slice(cursor, index));

    try {
      const url = new URL(match[2]);
      if ((url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password) {
        output += `<a href="${escapeHtml(url.toString())}" rel="noopener noreferrer">${renderEmphasis(match[1])}</a>`;
      } else {
        output += renderEmphasis(match[0]);
      }
    } catch {
      output += renderEmphasis(match[0]);
    }

    cursor = index + match[0].length;
  }

  output += renderEmphasis(value.slice(cursor));
  return output;
}

export function renderProductBody(source: string): string {
  const normalized = source.replace(/\r\n?/gu, "\n").trim();
  if (!normalized) return "";

  const blocks: string[] = [];
  const paragraph: string[] = [];
  const listItems: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push(`<p>${paragraph.map(renderInline).join("<br>")}</p>`);
    paragraph.length = 0;
  };

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push(`<ul>${listItems.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ul>`);
    listItems.length = 0;
  };

  for (const line of normalized.split("\n")) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    if (trimmed.startsWith("### ")) {
      flushParagraph();
      flushList();
      blocks.push(`<h3>${renderInline(trimmed.slice(4))}</h3>`);
      continue;
    }

    if (trimmed.startsWith("## ")) {
      flushParagraph();
      flushList();
      blocks.push(`<h2>${renderInline(trimmed.slice(3))}</h2>`);
      continue;
    }

    if (trimmed.startsWith("- ")) {
      flushParagraph();
      listItems.push(trimmed.slice(2));
      continue;
    }

    flushList();
    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();
  return blocks.join("\n");
}

function parseTags(raw: string): string[] | null {
  const tags: string[] = [];
  const seen = new Set<string>();

  for (const item of raw.split(/[,\n]/gu)) {
    const tag = item.trim();
    if (!tag) continue;
    if (tag.length > 40) return null;

    const key = tag.toLocaleLowerCase("en-US");
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }

  return tags.length <= 20 ? tags : null;
}

export function parseProductForm(form: FormData, quickCreate = false): ProductFormResult {
  const title = readText(form, "title");
  const slug = readText(form, "slug").toLowerCase();
  const categoryId = readOptionalId(form, "categoryId");
  const conversionGroupId = readOptionalId(form, "conversionGroupId");
  const tags = parseTags(quickCreate ? "" : readText(form, "tags"));
  const bodySource = quickCreate ? "" : readText(form, "bodySource");
  const ctaLabel = quickCreate ? "View Details" : readText(form, "ctaLabel");
  const featured = quickCreate ? false : form.get("featured") === "1";
  const sortText = quickCreate ? "0" : readText(form, "sortOrder");
  const statusText = readText(form, "status");

  if (!title || title.length > 160) return { ok: false, code: "title" };
  if (!slug || slug.length > 96 || !SLUG_PATTERN.test(slug)) return { ok: false, code: "slug" };
  if (categoryId === undefined) return { ok: false, code: "category" };
  if (conversionGroupId === undefined) return { ok: false, code: "conversion" };
  if (!tags) return { ok: false, code: "tags" };
  if (bodySource.length > 30000) return { ok: false, code: "body" };
  if (!ctaLabel || ctaLabel.length > 80) return { ok: false, code: "cta" };

  const sortOrder = Number(sortText || "0");
  if (!Number.isSafeInteger(sortOrder) || sortOrder < -999999 || sortOrder > 999999) {
    return { ok: false, code: "sort" };
  }

  if (!PRODUCT_STATUSES.includes(statusText as ProductStatus)) {
    return { ok: false, code: "status" };
  }

  return {
    ok: true,
    value: {
      title,
      slug,
      categoryId,
      conversionGroupId,
      tags,
      tagsJson: JSON.stringify(tags),
      bodySource,
      bodyHtml: renderProductBody(bodySource),
      ctaLabel,
      featured,
      sortOrder,
      status: statusText as ProductStatus,
    },
  };
}

export async function validateProductRelations(
  channelId: string,
  categoryId: string | null,
  conversionGroupId: string | null,
  status: ProductStatus,
): Promise<ProductRelationErrorCode | null> {
  if (categoryId) {
    const category = await env.DB.prepare(
      "SELECT status FROM categories WHERE id = ?1 AND channel_id = ?2",
    ).bind(categoryId, channelId).first<{ status: string }>();

    if (!category) return "category";
    if (status === "published" && category.status !== "published") return "category-unavailable";
  }

  if (!conversionGroupId) {
    return status === "published" ? "conversion-required" : null;
  }

  const group = await env.DB.prepare(
    `SELECT g.status, COUNT(r.id) AS enabled_resources
     FROM conversion_groups g
     LEFT JOIN conversion_resources r ON r.group_id = g.id AND r.status = 'enabled'
     WHERE g.id = ?1 AND g.channel_id = ?2
     GROUP BY g.id, g.status`,
  ).bind(conversionGroupId, channelId).first<{ status: string; enabled_resources: number }>();

  if (!group) return "conversion";
  if (status === "published" && (group.status !== "enabled" || Number(group.enabled_resources ?? 0) < 1)) {
    return "conversion-unavailable";
  }

  return null;
}

export function isDuplicateProductSlugError(error: unknown): boolean {
  const message = String(error);
  return (
    message.includes("UNIQUE constraint failed: products.channel_id, products.slug") ||
    message.includes("products.channel_id, products.slug")
  );
}
