export const FILTER_STATUSES = ["enabled", "disabled"] as const;

export type FilterStatus = (typeof FILTER_STATUSES)[number];

export type FilterFormValue = {
  name: string;
  slug: string;
  sortOrder: number;
  status: FilterStatus;
};

export type FilterFormResult =
  | { ok: true; value: FilterFormValue }
  | { ok: false; code: "name" | "slug" | "sort" | "status" };

const FILTER_NAME_MAX_LENGTH = 60;
const FILTER_SLUG_MAX_LENGTH = 64;
const SORT_ORDER_LIMIT = 999999;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

function readText(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export function parseFilterForm(form: FormData): FilterFormResult {
  const name = readText(form, "name");
  const slug = readText(form, "slug").toLowerCase();
  const sortText = readText(form, "sortOrder");
  const statusText = readText(form, "status");

  if (!name || name.length > FILTER_NAME_MAX_LENGTH) return { ok: false, code: "name" };
  if (!slug || slug.length > FILTER_SLUG_MAX_LENGTH || !SLUG_PATTERN.test(slug)) {
    return { ok: false, code: "slug" };
  }

  const sortOrder = Number(sortText || "0");
  if (!Number.isSafeInteger(sortOrder) || sortOrder < -SORT_ORDER_LIMIT || sortOrder > SORT_ORDER_LIMIT) {
    return { ok: false, code: "sort" };
  }

  if (!FILTER_STATUSES.includes(statusText as FilterStatus)) {
    return { ok: false, code: "status" };
  }

  return {
    ok: true,
    value: {
      name,
      slug,
      sortOrder,
      status: statusText as FilterStatus,
    },
  };
}

export function isDuplicateFilterSlugError(error: unknown): boolean {
  const message = String(error);
  return (
    message.includes("UNIQUE constraint failed: category_filters.channel_id, category_filters.slug") ||
    message.includes("category_filters.channel_id, category_filters.slug")
  );
}
