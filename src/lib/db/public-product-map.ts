import { buildPublicImageUrl } from "@/lib/images/url";

export type PublicProductCard = {
  id: string;
  title: string;
  slug: string;
  coverUrl: string | null;
  coverWidth: number | null;
  coverHeight: number | null;
  tags: string[];
};

export type PublicProductRow = {
  id: string;
  title: string;
  slug: string;
  object_key: string | null;
  cover_width: number | null;
  cover_height: number | null;
  tags: string;
};

function parseTags(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((tag): tag is string => typeof tag === "string").slice(0, 20)
      : [];
  } catch {
    return [];
  }
}

export function mapPublicProductRow(row: PublicProductRow, baseUrl: string): PublicProductCard {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    coverUrl: row.object_key ? buildPublicImageUrl(baseUrl, row.object_key) : null,
    coverWidth: row.object_key ? Number(row.cover_width) || null : null,
    coverHeight: row.object_key ? Number(row.cover_height) || null : null,
    tags: parseTags(row.tags),
  };
}
