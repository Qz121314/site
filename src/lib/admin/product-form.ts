import { env } from "cloudflare:workers";

export const PRODUCT_STATUSES = ["draft", "published", "disabled"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export type ProductFormValue = {
  title: string;
  slug: string;
  categoryId: string | null;
  conversionGroupId: string | null;
  coverAssetId: string | null;
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
  | "image"
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

function readBodySource(form: FormData): string {
  const value = form.get("bodySource");
  return typeof value === "string" ? value.replace(/\r\n?/gu, "\n") : "";
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

function renderFormattedText(value: string): string {
  const codeSpans: string[] = [];
  let output = escapeHtml(value).replace(/`([^`\n]{1,1000})`/gu, (_match, code: string) => {
    const index = codeSpans.push(`<code>${code}</code>`) - 1;
    return `\u0000CODE${index}\u0000`;
  });

  output = output
    .replace(/\*\*([^*\n]{1,1000})\*\*/gu, "<strong>$1</strong>")
    .replace(/__([^_\n]{1,1000})__/gu, "<strong>$1</strong>")
    .replace(/(?<!\*)\*([^*\n]{1,1000})\*(?!\*)/gu, "<em>$1</em>")
    .replace(/(?<!_)_([^_\n]{1,1000})_(?!_)/gu, "<em>$1</em>");

  return output.replace(/\u0000CODE(\d+)\u0000/gu, (_match, index: string) => codeSpans[Number(index)] ?? "");
}

function safeLink(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.username || url.password) return null;
    if (url.protocol === "http:" || url.protocol === "https:") return url.toString();
    if (url.protocol === "mailto:" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value.slice(7))) return value;
    return null;
  } catch {
    return null;
  }
}

function renderInline(value: string): string {
  const linkPattern = /\[([^\]\n]{1,300})\]\(([^\s)]+)\)/gu;
  let output = "";
  let cursor = 0;

  for (const match of value.matchAll(linkPattern)) {
    const index = match.index ?? 0;
    const fullMatch = match[0] ?? "";
    const linkText = match[1] ?? "";
    const linkTarget = safeLink(match[2] ?? "");
    output += renderFormattedText(value.slice(cursor, index));
    output += linkTarget
      ? `<a href="${escapeHtml(linkTarget)}" rel="noopener noreferrer">${renderFormattedText(linkText)}</a>`
      : renderFormattedText(fullMatch);
    cursor = index + fullMatch.length;
  }

  output += renderFormattedText(value.slice(cursor));
  return output;
}

export function renderProductBody(source: string): string {
  const normalized = source.replace(/\r\n?/gu, "\n");
  if (!normalized.trim()) return "";

  const blocks: string[] = [];
  const paragraph: string[] = [];
  const listItems: string[] = [];
  const orderedItems: string[] = [];
  const quoteLines: string[] = [];
  let codeLines: string[] | null = null;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push(`<p>${paragraph.map(renderInline).join("<br>")}</p>`);
    paragraph.length = 0;
  };

  const flushLists = () => {
    if (listItems.length > 0) {
      blocks.push(`<ul>${listItems.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ul>`);
      listItems.length = 0;
    }
    if (orderedItems.length > 0) {
      blocks.push(`<ol>${orderedItems.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ol>`);
      orderedItems.length = 0;
    }
  };

  const flushQuote = () => {
    if (quoteLines.length === 0) return;
    blocks.push(`<blockquote>${quoteLines.map(renderInline).join("<br>")}</blockquote>`);
    quoteLines.length = 0;
  };

  const flushAll = () => {
    flushParagraph();
    flushLists();
    flushQuote();
  };

  for (const line of normalized.split("\n")) {
    const markerLine = line.trimStart();

    if (codeLines) {
      if (markerLine.startsWith("```")) {
        blocks.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        codeLines = null;
      } else {
        codeLines.push(line);
      }
      continue;
    }

    if (markerLine.startsWith("```")) {
      flushAll();
      codeLines = [];
      continue;
    }

    if (!line.trim()) {
      flushAll();
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/u.exec(markerLine);
    if (heading) {
      flushAll();
      const level = heading[1]?.length ?? 1;
      blocks.push(`<h${level}>${renderInline(heading[2] ?? "")}</h${level}>`);
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/u.test(markerLine)) {
      flushAll();
      blocks.push("<hr>");
      continue;
    }

    if (markerLine.startsWith("> ")) {
      flushParagraph();
      flushLists();
      quoteLines.push(markerLine.slice(2));
      continue;
    }

    if (/^[-*+]\s+/u.test(markerLine)) {
      flushParagraph();
      flushQuote();
      orderedItems.length = 0;
      listItems.push(markerLine.replace(/^[-*+]\s+/u, ""));
      continue;
    }

    if (/^\d+[.)]\s+/u.test(markerLine)) {
      flushParagraph();
      flushQuote();
      listItems.length = 0;
      orderedItems.push(markerLine.replace(/^\d+[.)]\s+/u, ""));
      continue;
    }

    flushLists();
    flushQuote();
    paragraph.push(line);
  }

  if (codeLines) blocks.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
  flushAll();
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
  const bodySource = quickCreate ? "" : readBodySource(form);
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
      coverAssetId: null,
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
