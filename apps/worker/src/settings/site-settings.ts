export type SiteSettings = {
  siteName: string;
  locationLabel: string;
  mediaBaseUrl: string | null;
  logoAssetId: string | null;
  ga4MeasurementId: string | null;
  facebookPixelId: string | null;
  affiliateDetectionEnabled: boolean;
  affiliatePlatform: string | null;
  affiliateDetectionConfig: string | null;
  homeSectionLimit: number;
  showHot: boolean;
  showLatest: boolean;
  showMore: boolean;
  showMessages: boolean;
  showFaq: boolean;
  updatedAt: string;
};

export type SiteSettingsInput = Omit<SiteSettings, 'logoAssetId' | 'updatedAt'>;

type SiteSettingsRow = {
  site_name: string;
  location_label: string;
  media_base_url: string | null;
  logo_asset_id: string | null;
  ga4_measurement_id: string | null;
  facebook_pixel_id: string | null;
  affiliate_detection_enabled: number;
  affiliate_platform: string | null;
  affiliate_detection_config_json: string | null;
  home_section_limit: number;
  show_hot: number;
  show_latest: number;
  show_more: number;
  show_messages: number;
  show_faq: number;
  updated_at: string;
};

type ValidationResult =
  | { ok: true; value: SiteSettingsInput }
  | { ok: false; field: string; message: string };

type FieldValidation<T> =
  | { ok: true; value: T }
  | { ok: false; field: string; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readTrimmedString(
  value: unknown,
  field: string,
  minLength: number,
  maxLength: number,
): FieldValidation<string> {
  if (typeof value !== 'string') {
    return { ok: false, field, message: '必须填写文本。' };
  }

  const normalized = value.trim();
  if (normalized.length < minLength || normalized.length > maxLength) {
    return {
      ok: false,
      field,
      message: `长度必须在 ${minLength} 到 ${maxLength} 个字符之间。`,
    };
  }

  return { ok: true, value: normalized };
}

function readOptionalString(
  value: unknown,
  field: string,
  maxLength: number,
): FieldValidation<string | null> {
  if (value === null || value === undefined || value === '') {
    return { ok: true, value: null };
  }
  if (typeof value !== 'string') {
    return { ok: false, field, message: '必须填写文本。' };
  }

  const normalized = value.trim();
  if (!normalized) {
    return { ok: true, value: null };
  }
  if (normalized.length > maxLength) {
    return { ok: false, field, message: `不能超过 ${maxLength} 个字符。` };
  }

  return { ok: true, value: normalized };
}

function readBoolean(value: unknown, field: string): FieldValidation<boolean> {
  if (typeof value !== 'boolean') {
    return { ok: false, field, message: '必须选择启用或停用。' };
  }

  return { ok: true, value };
}

function isIpAddress(hostname: string): boolean {
  if (hostname.includes(':')) {
    return true;
  }

  const parts = hostname.split('.');
  return (
    parts.length === 4 &&
    parts.every((part) => /^\d{1,3}$/u.test(part) && Number(part) >= 0 && Number(part) <= 255)
  );
}

export function normalizeMediaBaseUrl(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new Error('R2 自定义域名必须是 HTTPS 地址。');
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error('R2 自定义域名格式无效。');
  }

  if (url.protocol !== 'https:') {
    throw new Error('R2 自定义域名必须使用 HTTPS。');
  }

  if (url.username || url.password || url.port || url.search || url.hash) {
    throw new Error('R2 自定义域名只能填写 HTTPS Origin。');
  }

  if (url.pathname !== '/' && url.pathname !== '') {
    throw new Error('R2 自定义域名不能包含路径。');
  }

  const hostname = url.hostname.toLowerCase();
  if (
    !hostname.includes('.') ||
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    isIpAddress(hostname)
  ) {
    throw new Error('R2 自定义域名必须使用有效的公开域名。');
  }

  if (hostname === 'r2.dev' || hostname.endsWith('.r2.dev')) {
    throw new Error('生产图片域名不能使用 r2.dev。');
  }

  if (hostname.endsWith('.r2.cloudflarestorage.com')) {
    throw new Error('请填写已绑定到 R2 Bucket 的自定义域名。');
  }

  return url.origin;
}

function readAffiliateConfig(value: unknown): FieldValidation<string | null> {
  const normalized = readOptionalString(value, 'affiliateDetectionConfig', 8000);
  if (!normalized.ok || normalized.value === null) {
    return normalized;
  }

  try {
    JSON.parse(normalized.value);
  } catch {
    return {
      ok: false,
      field: 'affiliateDetectionConfig',
      message: '联盟检测配置必须是有效 JSON。',
    };
  }

  return normalized;
}

export function validateSiteSettingsInput(value: unknown): ValidationResult {
  if (!isRecord(value)) {
    return { ok: false, field: 'form', message: '站点设置数据无效。' };
  }

  const siteName = readTrimmedString(value.siteName, 'siteName', 1, 120);
  if (!siteName.ok) return siteName;

  const locationLabel = readTrimmedString(value.locationLabel, 'locationLabel', 1, 80);
  if (!locationLabel.ok) return locationLabel;

  let mediaBaseUrl: string | null;
  try {
    mediaBaseUrl = normalizeMediaBaseUrl(value.mediaBaseUrl);
  } catch (error) {
    return {
      ok: false,
      field: 'mediaBaseUrl',
      message: error instanceof Error ? error.message : 'R2 自定义域名无效。',
    };
  }

  const ga4MeasurementId = readOptionalString(value.ga4MeasurementId, 'ga4MeasurementId', 80);
  if (!ga4MeasurementId.ok) return ga4MeasurementId;

  const facebookPixelId = readOptionalString(value.facebookPixelId, 'facebookPixelId', 80);
  if (!facebookPixelId.ok) return facebookPixelId;

  const affiliateDetectionEnabled = readBoolean(
    value.affiliateDetectionEnabled,
    'affiliateDetectionEnabled',
  );
  if (!affiliateDetectionEnabled.ok) return affiliateDetectionEnabled;

  const affiliatePlatform = readOptionalString(value.affiliatePlatform, 'affiliatePlatform', 120);
  if (!affiliatePlatform.ok) return affiliatePlatform;

  const affiliateDetectionConfig = readAffiliateConfig(value.affiliateDetectionConfig);
  if (!affiliateDetectionConfig.ok) return affiliateDetectionConfig;

  if (
    typeof value.homeSectionLimit !== 'number' ||
    !Number.isInteger(value.homeSectionLimit) ||
    value.homeSectionLimit < 1 ||
    value.homeSectionLimit > 20
  ) {
    return {
      ok: false,
      field: 'homeSectionLimit',
      message: '首页分区数量必须是 1 到 20 的整数。',
    };
  }

  const showHot = readBoolean(value.showHot, 'showHot');
  if (!showHot.ok) return showHot;
  const showLatest = readBoolean(value.showLatest, 'showLatest');
  if (!showLatest.ok) return showLatest;
  const showMore = readBoolean(value.showMore, 'showMore');
  if (!showMore.ok) return showMore;
  const showMessages = readBoolean(value.showMessages, 'showMessages');
  if (!showMessages.ok) return showMessages;
  const showFaq = readBoolean(value.showFaq, 'showFaq');
  if (!showFaq.ok) return showFaq;

  return {
    ok: true,
    value: {
      siteName: siteName.value,
      locationLabel: locationLabel.value,
      mediaBaseUrl,
      ga4MeasurementId: ga4MeasurementId.value,
      facebookPixelId: facebookPixelId.value,
      affiliateDetectionEnabled: affiliateDetectionEnabled.value,
      affiliatePlatform: affiliatePlatform.value,
      affiliateDetectionConfig: affiliateDetectionConfig.value,
      homeSectionLimit: value.homeSectionLimit,
      showHot: showHot.value,
      showLatest: showLatest.value,
      showMore: showMore.value,
      showMessages: showMessages.value,
      showFaq: showFaq.value,
    },
  };
}

function fromRow(row: SiteSettingsRow): SiteSettings {
  return {
    siteName: row.site_name,
    locationLabel: row.location_label,
    mediaBaseUrl: row.media_base_url,
    logoAssetId: row.logo_asset_id,
    ga4MeasurementId: row.ga4_measurement_id,
    facebookPixelId: row.facebook_pixel_id,
    affiliateDetectionEnabled: row.affiliate_detection_enabled === 1,
    affiliatePlatform: row.affiliate_platform,
    affiliateDetectionConfig: row.affiliate_detection_config_json,
    homeSectionLimit: row.home_section_limit,
    showHot: row.show_hot === 1,
    showLatest: row.show_latest === 1,
    showMore: row.show_more === 1,
    showMessages: row.show_messages === 1,
    showFaq: row.show_faq === 1,
    updatedAt: row.updated_at,
  };
}

export async function getSiteSettings(db: D1Database): Promise<SiteSettings> {
  const row = await db
    .prepare(
      `SELECT
         site_name,
         location_label,
         media_base_url,
         logo_asset_id,
         ga4_measurement_id,
         facebook_pixel_id,
         affiliate_detection_enabled,
         affiliate_platform,
         affiliate_detection_config_json,
         home_section_limit,
         show_hot,
         show_latest,
         show_more,
         show_messages,
         show_faq,
         updated_at
       FROM site_settings
       WHERE id = 1`,
    )
    .first<SiteSettingsRow>();

  if (!row) {
    throw new Error('SITE_SETTINGS_MISSING');
  }

  return fromRow(row);
}

export function createUpdateSiteSettingsStatement(
  db: D1Database,
  input: SiteSettingsInput,
  updatedAt: string,
): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE site_settings
       SET site_name = ?,
           location_label = ?,
           media_base_url = ?,
           ga4_measurement_id = ?,
           facebook_pixel_id = ?,
           affiliate_detection_enabled = ?,
           affiliate_platform = ?,
           affiliate_detection_config_json = ?,
           home_section_limit = ?,
           show_hot = ?,
           show_latest = ?,
           show_more = ?,
           show_messages = ?,
           show_faq = ?,
           updated_at = ?
       WHERE id = 1`,
    )
    .bind(
      input.siteName,
      input.locationLabel,
      input.mediaBaseUrl,
      input.ga4MeasurementId,
      input.facebookPixelId,
      input.affiliateDetectionEnabled ? 1 : 0,
      input.affiliatePlatform,
      input.affiliateDetectionConfig,
      input.homeSectionLimit,
      input.showHot ? 1 : 0,
      input.showLatest ? 1 : 0,
      input.showMore ? 1 : 0,
      input.showMessages ? 1 : 0,
      input.showFaq ? 1 : 0,
      updatedAt,
    );
}

export function toSiteSettings(
  input: SiteSettingsInput,
  logoAssetId: string | null,
  updatedAt: string,
): SiteSettings {
  return {
    ...input,
    logoAssetId,
    updatedAt,
  };
}
