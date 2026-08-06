export type AdminSessionResponse = {
  authenticated: boolean;
  expiresAt?: string;
};

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

export type SiteSettingsUpdateInput = Omit<SiteSettings, 'logoAssetId' | 'updatedAt'>;

export type CustomerServiceSettings = {
  isEnabled: boolean;
  provider: string | null;
  endpointUrl: string | null;
  projectId: string | null;
  config: string | null;
  updatedAt: string;
};

export type CustomerServiceSettingsInput = Omit<CustomerServiceSettings, 'updatedAt'>;

export type MediaDomainTestResponse = {
  connected: true;
  mediaBaseUrl: string;
  probeUrl: string;
  responseStatus: number;
};

export type AssetReferenceCounts = {
  logo: number;
  sectionIcon: number;
  productCover: number;
  productGallery: number;
};

export type AdminAsset = {
  key: string;
  size: number;
  uploadedAt: string;
  etag: string;
  contentType: string | null;
  isImage: boolean;
  trackingStatus: 'tracked' | 'untracked';
  usageStatus: 'used' | 'unused';
  databaseStatus: string | null;
  assetId: string | null;
  referenceCount: number;
  references: AssetReferenceCounts;
  cleanupEligible: boolean;
  cleanupBlockedReason: 'IN_USE' | 'RECENT_UPLOAD' | 'NOT_IMAGE' | null;
  publicUrl: string | null;
};

export type AssetScanPage = {
  assets: AdminAsset[];
  cursor: string | null;
  truncated: boolean;
  mediaBaseUrl: string | null;
  scannedCount: number;
  prefix: 'media/';
};

export type AssetCleanupResponse = {
  deletedKeys: string[];
  deletedCount: number;
  alreadyMissingCount: number;
  freedBytes: number;
};

export type AdminSection = {
  id: string;
  slug: string;
  name: string;
  iconType: 'icon' | 'asset';
  iconValue: string | null;
  iconAssetId: string | null;
  sortOrder: number;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  productCount: number;
  conversionMethodCount: number;
};

export type SectionInput = {
  name: string;
  iconValue: string;
  sortOrder: number;
  isEnabled: boolean;
};

export type SectionScope = 'active' | 'trash' | 'all';

type ApiErrorDetails = {
  retryAfterSeconds?: number;
  field?: string;
  responseStatus?: number;
  productCount?: number;
  conversionMethodCount?: number;
  blockedKey?: string;
  blockedReason?: string;
};

type ApiErrorEnvelope = {
  error?: {
    code?: string;
    message?: string;
    details?: ApiErrorDetails;
  };
};

export class AdminApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryAfterSeconds: number | undefined;
  readonly field: string | undefined;
  readonly responseStatus: number | undefined;
  readonly productCount: number | undefined;
  readonly conversionMethodCount: number | undefined;
  readonly blockedKey: string | undefined;
  readonly blockedReason: string | undefined;

  constructor(status: number, code: string, message: string, details?: ApiErrorDetails) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = details?.retryAfterSeconds;
    this.field = details?.field;
    this.responseStatus = details?.responseStatus;
    this.productCount = details?.productCount;
    this.conversionMethodCount = details?.conversionMethodCount;
    this.blockedKey = details?.blockedKey;
    this.blockedReason = details?.blockedReason;
  }
}

async function readJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return null;
  }

  return response.json() as Promise<unknown>;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function asErrorEnvelope(value: unknown): ApiErrorEnvelope {
  return asRecord(value) ? (value as ApiErrorEnvelope) : {};
}

async function requestJson(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...init,
  });
  const body = await readJson(response);

  if (!response.ok) {
    const envelope = asErrorEnvelope(body);
    throw new AdminApiError(
      response.status,
      envelope.error?.code ?? 'REQUEST_FAILED',
      envelope.error?.message ?? '后台请求失败。',
      envelope.error?.details,
    );
  }

  return body;
}

function adminJsonRequest(path: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown) {
  return requestJson(path, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      'x-admin-request': '1',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function parseAdminSession(value: unknown): AdminSessionResponse {
  const result = asRecord(value);
  if (!result) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '后台返回了无效数据。');
  }

  return {
    authenticated: result.authenticated === true,
    ...(typeof result.expiresAt === 'string' ? { expiresAt: result.expiresAt } : {}),
  };
}

function parseSiteSettings(value: unknown): SiteSettings {
  const envelope = asRecord(value);
  const settings = envelope ? asRecord(envelope.settings) : null;
  if (!settings) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '站点设置返回数据无效。');
  }

  const valid =
    typeof settings.siteName === 'string' &&
    typeof settings.locationLabel === 'string' &&
    (typeof settings.mediaBaseUrl === 'string' || settings.mediaBaseUrl === null) &&
    (typeof settings.logoAssetId === 'string' || settings.logoAssetId === null) &&
    (typeof settings.ga4MeasurementId === 'string' || settings.ga4MeasurementId === null) &&
    (typeof settings.facebookPixelId === 'string' || settings.facebookPixelId === null) &&
    typeof settings.affiliateDetectionEnabled === 'boolean' &&
    (typeof settings.affiliatePlatform === 'string' || settings.affiliatePlatform === null) &&
    (typeof settings.affiliateDetectionConfig === 'string' ||
      settings.affiliateDetectionConfig === null) &&
    typeof settings.homeSectionLimit === 'number' &&
    typeof settings.showHot === 'boolean' &&
    typeof settings.showLatest === 'boolean' &&
    typeof settings.showMore === 'boolean' &&
    typeof settings.showMessages === 'boolean' &&
    typeof settings.showFaq === 'boolean' &&
    typeof settings.updatedAt === 'string';

  if (!valid) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '站点设置返回数据无效。');
  }

  return settings as SiteSettings;
}

function parseCustomerServiceSettings(value: unknown): CustomerServiceSettings {
  const envelope = asRecord(value);
  const settings = envelope ? asRecord(envelope.settings) : null;
  if (!settings) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '客服设置返回数据无效。');
  }

  const valid =
    typeof settings.isEnabled === 'boolean' &&
    (typeof settings.provider === 'string' || settings.provider === null) &&
    (typeof settings.endpointUrl === 'string' || settings.endpointUrl === null) &&
    (typeof settings.projectId === 'string' || settings.projectId === null) &&
    (typeof settings.config === 'string' || settings.config === null) &&
    typeof settings.updatedAt === 'string';

  if (!valid) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '客服设置返回数据无效。');
  }

  return settings as CustomerServiceSettings;
}

function parseAssetReferences(value: unknown): AssetReferenceCounts {
  const references = asRecord(value);
  if (
    !references ||
    typeof references.logo !== 'number' ||
    typeof references.sectionIcon !== 'number' ||
    typeof references.productCover !== 'number' ||
    typeof references.productGallery !== 'number'
  ) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '素材引用数据无效。');
  }

  return {
    logo: references.logo,
    sectionIcon: references.sectionIcon,
    productCover: references.productCover,
    productGallery: references.productGallery,
  };
}

function parseCleanupBlockedReason(
  value: unknown,
): AdminAsset['cleanupBlockedReason'] {
  if (value === null || value === 'IN_USE' || value === 'RECENT_UPLOAD' || value === 'NOT_IMAGE') {
    return value;
  }

  throw new AdminApiError(500, 'INVALID_RESPONSE', '素材清理状态无效。');
}

function parseAdminAsset(value: unknown): AdminAsset {
  const asset = asRecord(value);
  if (!asset) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '素材数据无效。');
  }

  if (
    typeof asset.key !== 'string' ||
    typeof asset.size !== 'number' ||
    typeof asset.uploadedAt !== 'string' ||
    typeof asset.etag !== 'string' ||
    (typeof asset.contentType !== 'string' && asset.contentType !== null) ||
    typeof asset.isImage !== 'boolean' ||
    (asset.trackingStatus !== 'tracked' && asset.trackingStatus !== 'untracked') ||
    (asset.usageStatus !== 'used' && asset.usageStatus !== 'unused') ||
    (typeof asset.databaseStatus !== 'string' && asset.databaseStatus !== null) ||
    (typeof asset.assetId !== 'string' && asset.assetId !== null) ||
    typeof asset.referenceCount !== 'number' ||
    typeof asset.cleanupEligible !== 'boolean' ||
    (typeof asset.publicUrl !== 'string' && asset.publicUrl !== null)
  ) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '素材数据无效。');
  }

  return {
    key: asset.key,
    size: asset.size,
    uploadedAt: asset.uploadedAt,
    etag: asset.etag,
    contentType: asset.contentType,
    isImage: asset.isImage,
    trackingStatus: asset.trackingStatus,
    usageStatus: asset.usageStatus,
    databaseStatus: asset.databaseStatus,
    assetId: asset.assetId,
    referenceCount: asset.referenceCount,
    references: parseAssetReferences(asset.references),
    cleanupEligible: asset.cleanupEligible,
    cleanupBlockedReason: parseCleanupBlockedReason(asset.cleanupBlockedReason),
    publicUrl: asset.publicUrl,
  };
}

function parseAssetScanPage(value: unknown): AssetScanPage {
  const page = asRecord(value);
  if (
    !page ||
    !Array.isArray(page.assets) ||
    (typeof page.cursor !== 'string' && page.cursor !== null) ||
    typeof page.truncated !== 'boolean' ||
    (typeof page.mediaBaseUrl !== 'string' && page.mediaBaseUrl !== null) ||
    typeof page.scannedCount !== 'number' ||
    page.prefix !== 'media/'
  ) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '素材扫描返回数据无效。');
  }

  return {
    assets: page.assets.map(parseAdminAsset),
    cursor: page.cursor,
    truncated: page.truncated,
    mediaBaseUrl: page.mediaBaseUrl,
    scannedCount: page.scannedCount,
    prefix: 'media/',
  };
}

function parseAssetCleanupResponse(value: unknown): AssetCleanupResponse {
  const result = asRecord(value);
  if (
    !result ||
    !Array.isArray(result.deletedKeys) ||
    !result.deletedKeys.every((key) => typeof key === 'string') ||
    typeof result.deletedCount !== 'number' ||
    typeof result.alreadyMissingCount !== 'number' ||
    typeof result.freedBytes !== 'number'
  ) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '素材清理返回数据无效。');
  }

  return {
    deletedKeys: result.deletedKeys,
    deletedCount: result.deletedCount,
    alreadyMissingCount: result.alreadyMissingCount,
    freedBytes: result.freedBytes,
  };
}

function parseSectionRecord(value: unknown): AdminSection {
  const section = asRecord(value);
  if (!section) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '分区返回数据无效。');
  }

  const valid =
    typeof section.id === 'string' &&
    typeof section.slug === 'string' &&
    typeof section.name === 'string' &&
    (section.iconType === 'icon' || section.iconType === 'asset') &&
    (typeof section.iconValue === 'string' || section.iconValue === null) &&
    (typeof section.iconAssetId === 'string' || section.iconAssetId === null) &&
    typeof section.sortOrder === 'number' &&
    typeof section.isEnabled === 'boolean' &&
    typeof section.createdAt === 'string' &&
    typeof section.updatedAt === 'string' &&
    (typeof section.deletedAt === 'string' || section.deletedAt === null) &&
    typeof section.productCount === 'number' &&
    typeof section.conversionMethodCount === 'number';

  if (!valid) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '分区返回数据无效。');
  }

  return section as AdminSection;
}

function parseSectionEnvelope(value: unknown): AdminSection {
  const envelope = asRecord(value);
  return parseSectionRecord(envelope?.section);
}

function parseSectionList(value: unknown): AdminSection[] {
  const envelope = asRecord(value);
  if (!envelope || !Array.isArray(envelope.sections)) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '分区列表返回数据无效。');
  }

  return envelope.sections.map(parseSectionRecord);
}

export function fetchAdminSession(): Promise<AdminSessionResponse> {
  return requestJson('/api/admin/auth/session').then(parseAdminSession);
}

export function loginAdmin(password: string): Promise<AdminSessionResponse> {
  return requestJson('/api/admin/auth/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-admin-request': '1',
    },
    body: JSON.stringify({ password }),
  }).then(parseAdminSession);
}

export async function logoutAdmin(): Promise<void> {
  const response = await fetch('/api/admin/auth/logout', {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      'x-admin-request': '1',
    },
  });

  if (response.status === 204) return;

  const body = await readJson(response);
  const envelope = asErrorEnvelope(body);
  throw new AdminApiError(
    response.status,
    envelope.error?.code ?? 'LOGOUT_FAILED',
    envelope.error?.message ?? '退出登录失败。',
    envelope.error?.details,
  );
}

export function fetchSiteSettings(): Promise<SiteSettings> {
  return requestJson('/api/admin/settings/').then(parseSiteSettings);
}

export function updateSiteSettings(input: SiteSettingsUpdateInput): Promise<SiteSettings> {
  return adminJsonRequest('/api/admin/settings/', 'PUT', input).then(parseSiteSettings);
}

export function fetchCustomerServiceSettings(): Promise<CustomerServiceSettings> {
  return requestJson('/api/admin/customer-service/').then(parseCustomerServiceSettings);
}

export function updateCustomerServiceSettings(
  input: CustomerServiceSettingsInput,
): Promise<CustomerServiceSettings> {
  return adminJsonRequest('/api/admin/customer-service/', 'PUT', input).then(
    parseCustomerServiceSettings,
  );
}

export function fetchAssetPage(cursor?: string): Promise<AssetScanPage> {
  const query = new URLSearchParams({ limit: '100' });
  if (cursor) {
    query.set('cursor', cursor);
  }

  return requestJson(`/api/admin/assets/?${query.toString()}`).then(parseAssetScanPage);
}

export function cleanupAssets(keys: string[]): Promise<AssetCleanupResponse> {
  return requestJson('/api/admin/assets/cleanup', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-admin-request': '1',
      'x-idempotency-key': crypto.randomUUID(),
    },
    body: JSON.stringify({ keys }),
  }).then(parseAssetCleanupResponse);
}

export async function testMediaDomain(mediaBaseUrl: string): Promise<MediaDomainTestResponse> {
  const body = await adminJsonRequest('/api/admin/settings/media-domain/test', 'POST', {
    mediaBaseUrl,
  });
  const result = asRecord(body);

  if (
    !result ||
    result.connected !== true ||
    typeof result.mediaBaseUrl !== 'string' ||
    typeof result.probeUrl !== 'string' ||
    typeof result.responseStatus !== 'number'
  ) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '域名测试返回数据无效。');
  }

  return {
    connected: true,
    mediaBaseUrl: result.mediaBaseUrl,
    probeUrl: result.probeUrl,
    responseStatus: result.responseStatus,
  };
}

export function fetchSections(scope: SectionScope = 'active'): Promise<AdminSection[]> {
  return requestJson(`/api/admin/sections/?scope=${encodeURIComponent(scope)}`).then(
    parseSectionList,
  );
}

export function createSection(input: SectionInput): Promise<AdminSection> {
  return adminJsonRequest('/api/admin/sections/', 'POST', input).then(parseSectionEnvelope);
}

export function updateSection(id: string, input: SectionInput): Promise<AdminSection> {
  return adminJsonRequest(`/api/admin/sections/${encodeURIComponent(id)}`, 'PUT', input).then(
    parseSectionEnvelope,
  );
}

export function deleteSection(id: string): Promise<AdminSection> {
  return adminJsonRequest(`/api/admin/sections/${encodeURIComponent(id)}`, 'DELETE').then(
    parseSectionEnvelope,
  );
}

export function restoreSection(id: string): Promise<AdminSection> {
  return adminJsonRequest(`/api/admin/sections/${encodeURIComponent(id)}/restore`, 'POST').then(
    parseSectionEnvelope,
  );
}

export async function batchDeleteSections(ids: string[]): Promise<string[]> {
  const body = await requestJson('/api/admin/sections/batch-delete', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-admin-request': '1',
      'x-idempotency-key': crypto.randomUUID(),
    },
    body: JSON.stringify({ ids }),
  });
  const result = asRecord(body);
  if (
    !result ||
    !Array.isArray(result.deletedIds) ||
    !result.deletedIds.every((id) => typeof id === 'string')
  ) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '批量删除返回数据无效。');
  }

  return result.deletedIds;
}

export async function reorderSections(
  items: Array<{ id: string; sortOrder: number }>,
): Promise<void> {
  const body = await requestJson('/api/admin/sections/reorder', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-admin-request': '1',
      'x-idempotency-key': crypto.randomUUID(),
    },
    body: JSON.stringify({ items }),
  });
  const result = asRecord(body);
  if (!result || result.reordered !== true) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '分区排序返回数据无效。');
  }
}
