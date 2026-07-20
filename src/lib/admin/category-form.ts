import { env } from "cloudflare:workers";

export const CATEGORY_STATUSES = ["draft", "published", "disabled"] as const;

export type CategoryStatus = (typeof CATEGORY_STATUSES)[number];

export type CategoryFormValue = {
  name: string;
  slug: string;
  sortOrder: number;
  status: CategoryStatus;
  filterIds: string[];
};

export type CategoryFormResult =
  | { ok: true; value: CategoryFormValue }
  | { ok: false; code: "name" | "slug" | "sort" | "status" | "filters" };

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function readText(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function readFilterIds(form: FormData): string[] | null {
  const rawValues = form.getAll("filterIds");
  const values = rawValues.filter((value): value is string => typeof value === "string").map((value) => value.trim());
  const uniqueValues = [...new Set(values.filter(Boolean))];

  if (uniqueValues.length > 100 || uniqueValues.some((value) => !ID_PATTERN.test(value))) return null;
  return uniqueValues;
}

export function parseCategoryForm(form: FormData): CategoryFormResult {
  const name = readText(form, "name");
  const slug = readText(form, "slug").toLowerCase();
  const sortText = readText(form, "sortOrder");
  const statusText = readText(form, "status");
  const filterIds = readFilterIds(form);

  if (!name || name.length > 80) return { ok: false, code: "name" };
  if (!slug || slug.length > 64 || !SLUG_PATTERN.test(slug)) return { ok: false, code: "slug" };

  const sortOrder = Number(sortText || "0");
  if (!Number.isSafeInteger(sortOrder) || sortOrder < -999999 || sortOrder > 999999) {
    return { ok: false, code: "sort" };
  }

  if (!CATEGORY_STATUSES.includes(statusText as CategoryStatus)) {
    return { ok: false, code: "status" };
  }

  if (!filterIds) return { ok: false, code: "filters" };

  return {
    ok: true,
    value: {
      name,
      slug,
      sortOrder,
      status: statusText as CategoryStatus,
      filterIds,
    },
  };
}

export async function categoryFiltersBelongToChannel(channelId: string, filterIds: string[]): Promise<boolean> {
  if (filterIds.length === 0) return true;

  const placeholders = filterIds.map((_, index) => `?${index + 2}`).join(", ");
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS count
     FROM category_filters
     WHERE channel_id = ?1 AND id IN (${placeholders})`,
  ).bind(channelId, ...filterIds).first<{ count: number }>();

  return Number(row?.count ?? 0) === filterIds.length;
}

export function isDuplicateCategorySlugError(error: unknown): boolean {
  const message = String(error);
  return (
    message.includes("UNIQUE constraint failed: categories.channel_id, categories.slug") ||
    message.includes("categories.channel_id, categories.slug")
  );
}
