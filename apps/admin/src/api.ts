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
  homeSectionLimit: number;
  showHot: boolean;
  showLatest: boolean;
  showMore: boolean;
  showFaq: boolean;
  updatedAt: string;
};

export type SiteSettingsUpdateInput = Omit<SiteSettings, 'logoAssetId' | 'updatedAt'>;

export type MediaDomainTestResponse = {
  connected: true;
  mediaBaseUrl: string;
  probeUrl: string;
  responseStatus: number;
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
    typeof settings.homeSectionLimit === 'number' &&
    typeof settings.showHot === 'boolean' &&
    typeof settings.showLatest === 'boolean' &&
    typeof settings.showMore === 'boolean' &&
    typeof settings.showFaq === 'boolean' &&
    typeof settings.updatedAt === 'string';

  if (!valid) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '站点设置返回数据无效。');
  }

  return settings as SiteSettings;
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
