export const FILTER_STATUSES = ["enabled", "disabled"] as const;

export type FilterStatus = (typeof FILTER_STATUSES)[number];

export type FilterFormValue = {
  name: string;
  sortOrder: number;
  status: FilterStatus;
};

export type FilterFormResult =
  | { ok: true; value: FilterFormValue }
  | { ok: false; code: "name" | "sort" | "status" };

const FILTER_NAME_MAX_LENGTH = 60;
const SORT_ORDER_LIMIT = 999999;

function readText(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export function parseFilterForm(form: FormData): FilterFormResult {
  const name = readText(form, "name");
  const sortText = readText(form, "sortOrder");
  const statusText = readText(form, "status");

  if (!name || name.length > FILTER_NAME_MAX_LENGTH) return { ok: false, code: "name" };

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
      sortOrder,
      status: statusText as FilterStatus,
    },
  };
}
