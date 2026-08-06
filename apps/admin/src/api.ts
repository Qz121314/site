export type AdminSessionResponse = {
  authenticated: boolean;
  expiresAt?: string;
};

export type SiteSettings = {
  siteName: string;
  locationLabel: string;
  mediaBaseUrl: string | null;
  logoAssetId: string | null;
  homeSectionLimit: number;
  showHot: boolean;
  showLatest: boolean;
  showMore: boolean;
  showMessages: boolean;
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

type ApiErrorDetails = {
  retryAfterSeconds?: number;
  field?: string;
  responseStatus?: number;
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

  constructor(status: number, code: string, message: string, details?: ApiErrorDetails) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = details?.retryAfterSeconds;
    this.field = details?.field;
    this.responseStatus = details?.responseStatus;
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

  if (response.status === 204) {
    return;
  }

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
  return requestJson('/api/admin/settings/', {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      'x-admin-request': '1',
    },
    body: JSON.stringify(input),
  }).then(parseSiteSettings);
}

export async function testMediaDomain(mediaBaseUrl: string): Promise<MediaDomainTestResponse> {
  const body = await requestJson('/api/admin/settings/media-domain/test', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-admin-request': '1',
    },
    body: JSON.stringify({ mediaBaseUrl }),
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
