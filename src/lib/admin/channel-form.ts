export const CHANNEL_STATUSES = ["draft", "published", "disabled"] as const;

export type ChannelStatus = (typeof CHANNEL_STATUSES)[number];

export type ChannelFormValue = {
  name: string;
  slug: string;
  icon: string;
  sortOrder: number;
  status: ChannelStatus;
};

export type ChannelFormResult =
  | { ok: true; value: ChannelFormValue }
  | { ok: false; code: "name" | "slug" | "icon" | "sort" | "status" };

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

function readText(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export function parseChannelForm(form: FormData): ChannelFormResult {
  const name = readText(form, "name");
  const slug = readText(form, "slug").toLowerCase();
  const icon = readText(form, "icon");
  const sortText = readText(form, "sortOrder");
  const statusText = readText(form, "status");

  if (!name || name.length > 80) return { ok: false, code: "name" };
  if (!slug || slug.length > 64 || !SLUG_PATTERN.test(slug)) return { ok: false, code: "slug" };
  if (icon.length > 12) return { ok: false, code: "icon" };

  const sortOrder = Number(sortText || "0");
  if (!Number.isSafeInteger(sortOrder) || sortOrder < -999999 || sortOrder > 999999) {
    return { ok: false, code: "sort" };
  }

  if (!CHANNEL_STATUSES.includes(statusText as ChannelStatus)) {
    return { ok: false, code: "status" };
  }

  return {
    ok: true,
    value: {
      name,
      slug,
      icon,
      sortOrder,
      status: statusText as ChannelStatus,
    },
  };
}

export function isDuplicateChannelSlugError(error: unknown): boolean {
  const message = String(error);
  return message.includes("UNIQUE constraint failed: channels.slug") || message.includes("idx_channels_slug");
}
