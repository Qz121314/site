import { env } from "cloudflare:workers";

export const CONVERSION_GROUP_STATUSES = ["enabled", "disabled"] as const;
export const CONVERSION_RESOURCE_TYPES = ["url", "phone", "whatsapp", "telegram", "email"] as const;
export const CONVERSION_RESOURCE_STATUSES = ["enabled", "disabled"] as const;

export type ConversionGroupStatus = (typeof CONVERSION_GROUP_STATUSES)[number];
export type ConversionResourceType = (typeof CONVERSION_RESOURCE_TYPES)[number];
export type ConversionResourceStatus = (typeof CONVERSION_RESOURCE_STATUSES)[number];

export type ConversionGroupFormValue = {
  name: string;
  status: ConversionGroupStatus;
};

export type ConversionResourceFormValue = {
  type: ConversionResourceType;
  value: string;
  sortOrder: number;
  status: ConversionResourceStatus;
};

type ConversionGroupFormResult =
  | { ok: true; value: ConversionGroupFormValue }
  | { ok: false; code: "group-name" | "group-status" };

type ConversionResourceFormResult =
  | { ok: true; value: ConversionResourceFormValue }
  | { ok: false; code: "resource-type" | "resource-value" | "resource-sort" | "resource-status" };

function readText(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

function isPhoneLike(value: string): boolean {
  if (!/^[+0-9() .-]+$/u.test(value)) return false;
  const digits = value.replace(/\D/gu, "");
  return digits.length >= 5 && digits.length <= 20;
}

function isTelegramValue(value: string): boolean {
  if (isHttpUrl(value)) return true;
  return /^@?[A-Za-z0-9_]{3,64}$/u.test(value);
}

function isValidResourceValue(type: ConversionResourceType, value: string): boolean {
  if (!value || value.length > 2048) return false;

  switch (type) {
    case "url":
      return isHttpUrl(value);
    case "phone":
      return value.length <= 64 && isPhoneLike(value);
    case "whatsapp":
      return value.length <= 512 && (isPhoneLike(value) || isHttpUrl(value));
    case "telegram":
      return value.length <= 512 && isTelegramValue(value);
    case "email":
      return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value);
  }
}

export function parseConversionGroupForm(form: FormData): ConversionGroupFormResult {
  const name = readText(form, "name");
  const status = readText(form, "status");

  if (!name || name.length > 80) return { ok: false, code: "group-name" };
  if (!CONVERSION_GROUP_STATUSES.includes(status as ConversionGroupStatus)) {
    return { ok: false, code: "group-status" };
  }

  return { ok: true, value: { name, status: status as ConversionGroupStatus } };
}

export function parseConversionResourceForm(form: FormData): ConversionResourceFormResult {
  const type = readText(form, "type") as ConversionResourceType;
  const value = readText(form, "value");
  const sortText = readText(form, "sortOrder");
  const status = readText(form, "status") as ConversionResourceStatus;

  if (!CONVERSION_RESOURCE_TYPES.includes(type)) return { ok: false, code: "resource-type" };
  if (!isValidResourceValue(type, value)) return { ok: false, code: "resource-value" };

  const sortOrder = Number(sortText || "0");
  if (!Number.isSafeInteger(sortOrder) || sortOrder < -999999 || sortOrder > 999999) {
    return { ok: false, code: "resource-sort" };
  }

  if (!CONVERSION_RESOURCE_STATUSES.includes(status)) {
    return { ok: false, code: "resource-status" };
  }

  return { ok: true, value: { type, value, sortOrder, status } };
}

export async function conversionGroupBelongsToChannel(channelId: string, groupId: string): Promise<boolean> {
  const row = await env.DB.prepare(
    "SELECT id FROM conversion_groups WHERE id = ?1 AND channel_id = ?2",
  ).bind(groupId, channelId).first<{ id: string }>();
  return Boolean(row);
}

export async function conversionGroupNameExists(
  channelId: string,
  name: string,
  excludedGroupId?: string,
): Promise<boolean> {
  const row = excludedGroupId
    ? await env.DB.prepare(
        `SELECT id FROM conversion_groups
         WHERE channel_id = ?1 AND name = ?2 COLLATE NOCASE AND id <> ?3`,
      ).bind(channelId, name, excludedGroupId).first<{ id: string }>()
    : await env.DB.prepare(
        `SELECT id FROM conversion_groups
         WHERE channel_id = ?1 AND name = ?2 COLLATE NOCASE`,
      ).bind(channelId, name).first<{ id: string }>();

  return Boolean(row);
}

export function isDuplicateConversionGroupNameError(error: unknown): boolean {
  const message = String(error);
  return (
    message.includes("idx_conversion_groups_channel_name") ||
    message.includes("conversion_groups.channel_id, conversion_groups.name")
  );
}
