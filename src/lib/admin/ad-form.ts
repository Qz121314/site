export const AD_POOL_STATUSES = ["enabled", "disabled"] as const;
export const AD_STATUSES = ["enabled", "disabled"] as const;
export const AD_OPEN_MODES = ["same", "new"] as const;

export type AdPoolStatus = (typeof AD_POOL_STATUSES)[number];
export type AdStatus = (typeof AD_STATUSES)[number];
export type AdOpenMode = (typeof AD_OPEN_MODES)[number];

export type AdPoolFormResult =
  | { ok: true; name: string; status: AdPoolStatus }
  | { ok: false; code: "name" | "status" };

export type AdvertisementFormResult =
  | {
      ok: true;
      imageAssetId: string;
      targetUrl: string;
      openMode: AdOpenMode;
      sortOrder: number;
      status: AdStatus;
    }
  | { ok: false; code: "image" | "url" | "open" | "sort" | "status" };

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function readText(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function normalizeTargetUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      url.username ||
      url.password
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function parseAdPoolForm(form: FormData): AdPoolFormResult {
  const name = readText(form, "name");
  const status = readText(form, "status");

  if (!name || name.length > 80) return { ok: false, code: "name" };
  if (!AD_POOL_STATUSES.includes(status as AdPoolStatus)) return { ok: false, code: "status" };
  return { ok: true, name, status: status as AdPoolStatus };
}

export function parseAdvertisementForm(form: FormData): AdvertisementFormResult {
  const imageAssetId = readText(form, "imageAssetId");
  const targetUrl = normalizeTargetUrl(readText(form, "targetUrl"));
  const openMode = readText(form, "openMode");
  const sortOrder = Number(readText(form, "sortOrder") || "0");
  const status = readText(form, "status");

  if (!ID_PATTERN.test(imageAssetId)) return { ok: false, code: "image" };
  if (!targetUrl || targetUrl.length > 2_000) return { ok: false, code: "url" };
  if (!AD_OPEN_MODES.includes(openMode as AdOpenMode)) return { ok: false, code: "open" };
  if (!Number.isSafeInteger(sortOrder) || sortOrder < -999999 || sortOrder > 999999) {
    return { ok: false, code: "sort" };
  }
  if (!AD_STATUSES.includes(status as AdStatus)) return { ok: false, code: "status" };

  return {
    ok: true,
    imageAssetId,
    targetUrl,
    openMode: openMode as AdOpenMode,
    sortOrder,
    status: status as AdStatus,
  };
}

export function isDuplicateAdPoolNameError(error: unknown): boolean {
  const message = String(error);
  return message.includes("idx_ad_pools_channel_name") || message.includes("ad_pools.channel_id, ad_pools.name");
}

export { adPoolIntegrityErrorCode } from "@/lib/admin/pool-integrity";
