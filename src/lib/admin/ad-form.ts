export const AD_POOL_STATUSES = ["enabled", "disabled"] as const;
export const AD_DEVICE_TYPES = ["mobile", "desktop"] as const;
export const AD_STATUSES = ["enabled", "disabled"] as const;
export const AD_OPEN_MODES = ["same", "new"] as const;
export const AD_DISPLAY_TYPES = ["banner", "vertical", "modal"] as const;
export const AD_CREATIVE_TYPES = ["uploaded_image", "external_media", "embed_code"] as const;

export type AdPoolStatus = (typeof AD_POOL_STATUSES)[number];
export type AdDeviceType = (typeof AD_DEVICE_TYPES)[number];
export type AdStatus = (typeof AD_STATUSES)[number];
export type AdOpenMode = (typeof AD_OPEN_MODES)[number];
export type AdDisplayType = (typeof AD_DISPLAY_TYPES)[number];
export type AdCreativeType = (typeof AD_CREATIVE_TYPES)[number];

export type AdPoolFormResult =
  | { ok: true; name: string; deviceType: AdDeviceType; status: AdPoolStatus }
  | { ok: false; code: "name" | "device" | "status" };

export type AdvertisementFormResult =
  | {
      ok: true;
      name: string;
      displayType: AdDisplayType;
      creativeType: AdCreativeType;
      imageAssetId: string | null;
      mediaUrl: string;
      embedCode: string;
      targetUrl: string;
      declaredWidth: number | null;
      declaredHeight: number | null;
      openMode: AdOpenMode;
      status: AdStatus;
    }
  | {
      ok: false;
      code: "name" | "display" | "creative" | "image" | "media" | "code" | "url" | "size" | "open" | "status";
    };

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function readText(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function normalizeHttpUrl(value: string, optional = false): string | null {
  if (!value && optional) return "";
  try {
    const url = new URL(value);
    if (
      (url.protocol !== "https:" && url.protocol !== "http:")
      || url.username
      || url.password
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function parseDimension(value: string): number | null {
  const dimension = Number(value);
  return Number.isSafeInteger(dimension) && dimension >= 1 && dimension <= 4096 ? dimension : null;
}

export function parseAdPoolForm(form: FormData): AdPoolFormResult {
  const name = readText(form, "name");
  const deviceType = readText(form, "deviceType");
  const status = readText(form, "status") || "enabled";

  if (!name || name.length > 80) return { ok: false, code: "name" };
  if (!AD_DEVICE_TYPES.includes(deviceType as AdDeviceType)) return { ok: false, code: "device" };
  if (!AD_POOL_STATUSES.includes(status as AdPoolStatus)) return { ok: false, code: "status" };
  return {
    ok: true,
    name,
    deviceType: deviceType as AdDeviceType,
    status: status as AdPoolStatus,
  };
}

export function parseAdvertisementForm(form: FormData): AdvertisementFormResult {
  const name = readText(form, "name");
  const displayType = readText(form, "displayType");
  const creativeType = readText(form, "creativeType");
  const imageAssetId = readText(form, "imageAssetId");
  const rawMediaUrl = readText(form, "mediaUrl");
  const embedCode = readText(form, "embedCode");
  const rawTargetUrl = readText(form, "targetUrl");
  const openMode = readText(form, "openMode") || "new";
  const status = readText(form, "status") || "enabled";

  if (!name || name.length > 120) return { ok: false, code: "name" };
  if (!AD_DISPLAY_TYPES.includes(displayType as AdDisplayType)) return { ok: false, code: "display" };
  if (!AD_CREATIVE_TYPES.includes(creativeType as AdCreativeType)) return { ok: false, code: "creative" };
  if (!AD_OPEN_MODES.includes(openMode as AdOpenMode)) return { ok: false, code: "open" };
  if (!AD_STATUSES.includes(status as AdStatus)) return { ok: false, code: "status" };

  let normalizedImageAssetId: string | null = null;
  let mediaUrl = "";
  let normalizedEmbedCode = "";
  let targetUrl = "";
  let declaredWidth: number | null = null;
  let declaredHeight: number | null = null;

  if (creativeType === "uploaded_image") {
    if (!ID_PATTERN.test(imageAssetId)) return { ok: false, code: "image" };
    const normalizedTarget = normalizeHttpUrl(rawTargetUrl);
    if (!normalizedTarget || normalizedTarget.length > 2_000) return { ok: false, code: "url" };
    normalizedImageAssetId = imageAssetId;
    targetUrl = normalizedTarget;
  } else if (creativeType === "external_media") {
    const normalizedMedia = normalizeHttpUrl(rawMediaUrl);
    const normalizedTarget = normalizeHttpUrl(rawTargetUrl);
    declaredWidth = parseDimension(readText(form, "declaredWidth"));
    declaredHeight = parseDimension(readText(form, "declaredHeight"));
    if (!normalizedMedia || normalizedMedia.length > 2_000) return { ok: false, code: "media" };
    if (!normalizedTarget || normalizedTarget.length > 2_000) return { ok: false, code: "url" };
    if (!declaredWidth || !declaredHeight) return { ok: false, code: "size" };
    mediaUrl = normalizedMedia;
    targetUrl = normalizedTarget;
  } else {
    if (!embedCode || embedCode.length > 100_000) return { ok: false, code: "code" };
    const normalizedTarget = normalizeHttpUrl(rawTargetUrl, true);
    declaredWidth = parseDimension(readText(form, "declaredWidth"));
    declaredHeight = parseDimension(readText(form, "declaredHeight"));
    if (normalizedTarget === null || normalizedTarget.length > 2_000) return { ok: false, code: "url" };
    if (!declaredWidth || !declaredHeight) return { ok: false, code: "size" };
    normalizedEmbedCode = embedCode;
    targetUrl = normalizedTarget;
  }

  return {
    ok: true,
    name,
    displayType: displayType as AdDisplayType,
    creativeType: creativeType as AdCreativeType,
    imageAssetId: normalizedImageAssetId,
    mediaUrl,
    embedCode: normalizedEmbedCode,
    targetUrl,
    declaredWidth,
    declaredHeight,
    openMode: openMode as AdOpenMode,
    status: status as AdStatus,
  };
}

export function isDuplicateAdPoolNameError(error: unknown): boolean {
  const message = String(error);
  return message.includes("idx_ad_pools_channel_name") || message.includes("ad_pools.channel_id, ad_pools.name");
}
