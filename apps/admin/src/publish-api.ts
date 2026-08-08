import { AdminApiError } from './api';
import { adminFetch } from './admin-fetch';

export type PublishModuleKind = 'site' | 'sections-index' | 'faq' | 'section';

export type PublishVersion = {
  moduleKey: string;
  contentVersion: string;
  sourceRevision: string;
  publishedAt: string;
  isCurrent: boolean;
  objectCount: number;
  totalBytes: number;
};

export type PublishModuleStatus = {
  key: string;
  kind: PublishModuleKind;
  sectionId: string | null;
  label: string;
  currentVersion: string | null;
  publishedAt: string | null;
  isCurrent: boolean;
  versions: PublishVersion[];
  lastJob: {
    id: string;
    status: 'building' | 'published' | 'failed' | 'cancelled';
    contentVersion: string | null;
    errorCode: string | null;
    errorMessage: string | null;
    requestedAt: string;
    completedAt: string | null;
  } | null;
};

export type PublishStatus = {
  pointerVersion: string | null;
  publishedAt: string | null;
  isCurrent: boolean;
  dirtyCount: number;
  bootstrapRequired: boolean;
  legacyPointerDetected: boolean;
  contentOrigin: string | null;
  modules: PublishModuleStatus[];
};

export type PublishModuleResult = {
  moduleKey: string;
  label: string;
  contentVersion: string | null;
  sourceRevision: string;
  publishedAt: string | null;
  objectCount: number;
  totalBytes: number;
  unchanged: boolean;
};

export type PublishResult = {
  pointerVersion: string;
  publishedAt: string;
  bootstrapped: boolean;
  publications: PublishModuleResult[];
};

let publishStatusInFlight: Promise<PublishStatus> | null = null;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

async function readJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  return contentType.includes('application/json') ? response.json() : null;
}

async function requestJson(path: string, init?: RequestInit): Promise<unknown> {
  const response = await adminFetch(path, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...init,
  });
  const body = await readJson(response);
  if (!response.ok) {
    const envelope = asRecord(body);
    const error = envelope ? asRecord(envelope.error) : null;
    throw new AdminApiError(
      response.status,
      typeof error?.code === 'string' ? error.code : 'PUBLISH_REQUEST_FAILED',
      typeof error?.message === 'string' ? error.message : '前台发布请求失败。',
    );
  }
  return body;
}

function adminPost(path: string, body: unknown): Promise<unknown> {
  return requestJson(path, {
    method: 'POST',
    headers: {
      'x-admin-request': '1',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

function parseVersion(value: unknown): PublishVersion {
  const version = asRecord(value);
  if (
    !version ||
    typeof version.moduleKey !== 'string' ||
    typeof version.contentVersion !== 'string' ||
    typeof version.sourceRevision !== 'string' ||
    typeof version.publishedAt !== 'string' ||
    typeof version.isCurrent !== 'boolean' ||
    typeof version.objectCount !== 'number' ||
    typeof version.totalBytes !== 'number'
  ) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '前台板块版本返回数据无效。');
  }
  return version as PublishVersion;
}

function parseLastJob(value: unknown): PublishModuleStatus['lastJob'] {
  if (value === null) return null;
  const lastJob = asRecord(value);
  if (
    !lastJob ||
    typeof lastJob.id !== 'string' ||
    !['building', 'published', 'failed', 'cancelled'].includes(String(lastJob.status)) ||
    (typeof lastJob.contentVersion !== 'string' && lastJob.contentVersion !== null) ||
    (typeof lastJob.errorCode !== 'string' && lastJob.errorCode !== null) ||
    (typeof lastJob.errorMessage !== 'string' && lastJob.errorMessage !== null) ||
    typeof lastJob.requestedAt !== 'string' ||
    (typeof lastJob.completedAt !== 'string' && lastJob.completedAt !== null)
  ) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '前台板块发布任务返回数据无效。');
  }
  return lastJob as PublishModuleStatus['lastJob'];
}

function parseModule(value: unknown): PublishModuleStatus {
  const module = asRecord(value);
  if (
    !module ||
    typeof module.key !== 'string' ||
    !['site', 'sections-index', 'faq', 'section'].includes(String(module.kind)) ||
    (typeof module.sectionId !== 'string' && module.sectionId !== null) ||
    typeof module.label !== 'string' ||
    (typeof module.currentVersion !== 'string' && module.currentVersion !== null) ||
    (typeof module.publishedAt !== 'string' && module.publishedAt !== null) ||
    typeof module.isCurrent !== 'boolean' ||
    !Array.isArray(module.versions)
  ) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '前台板块发布状态返回数据无效。');
  }
  return {
    key: module.key,
    kind: module.kind as PublishModuleKind,
    sectionId: module.sectionId as string | null,
    label: module.label,
    currentVersion: module.currentVersion as string | null,
    publishedAt: module.publishedAt as string | null,
    isCurrent: module.isCurrent,
    versions: module.versions.map(parseVersion),
    lastJob: parseLastJob(module.lastJob),
  };
}

function parseStatus(value: unknown): PublishStatus {
  const envelope = asRecord(value);
  const status = envelope ? asRecord(envelope.status) : null;
  if (
    !status ||
    (typeof status.pointerVersion !== 'string' && status.pointerVersion !== null) ||
    (typeof status.publishedAt !== 'string' && status.publishedAt !== null) ||
    typeof status.isCurrent !== 'boolean' ||
    typeof status.dirtyCount !== 'number' ||
    typeof status.bootstrapRequired !== 'boolean' ||
    typeof status.legacyPointerDetected !== 'boolean' ||
    (typeof status.contentOrigin !== 'string' && status.contentOrigin !== null) ||
    !Array.isArray(status.modules)
  ) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '发布状态返回数据无效。');
  }
  return {
    pointerVersion: status.pointerVersion as string | null,
    publishedAt: status.publishedAt as string | null,
    isCurrent: status.isCurrent,
    dirtyCount: status.dirtyCount,
    bootstrapRequired: status.bootstrapRequired,
    legacyPointerDetected: status.legacyPointerDetected,
    contentOrigin: status.contentOrigin as string | null,
    modules: status.modules.map(parseModule),
  };
}

function parseModuleResult(value: unknown): PublishModuleResult {
  const publication = asRecord(value);
  if (
    !publication ||
    typeof publication.moduleKey !== 'string' ||
    typeof publication.label !== 'string' ||
    (typeof publication.contentVersion !== 'string' && publication.contentVersion !== null) ||
    typeof publication.sourceRevision !== 'string' ||
    (typeof publication.publishedAt !== 'string' && publication.publishedAt !== null) ||
    typeof publication.objectCount !== 'number' ||
    typeof publication.totalBytes !== 'number' ||
    typeof publication.unchanged !== 'boolean'
  ) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '板块发布结果返回数据无效。');
  }
  return publication as PublishModuleResult;
}

function parsePublishResult(value: unknown): PublishResult {
  const envelope = asRecord(value);
  const publication = envelope ? asRecord(envelope.publication) : null;
  if (
    !publication ||
    typeof publication.pointerVersion !== 'string' ||
    typeof publication.publishedAt !== 'string' ||
    typeof publication.bootstrapped !== 'boolean' ||
    !Array.isArray(publication.publications)
  ) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '发布结果返回数据无效。');
  }
  return {
    pointerVersion: publication.pointerVersion,
    publishedAt: publication.publishedAt,
    bootstrapped: publication.bootstrapped,
    publications: publication.publications.map(parseModuleResult),
  };
}

export function fetchPublishStatus(): Promise<PublishStatus> {
  if (publishStatusInFlight) return publishStatusInFlight;

  const request = requestJson('/api/admin/publish/')
    .then(parseStatus)
    .finally(() => {
      if (publishStatusInFlight === request) publishStatusInFlight = null;
    });
  publishStatusInFlight = request;
  return request;
}

export function publishStorefront(moduleKey = 'all'): Promise<PublishResult> {
  return adminPost('/api/admin/publish/', { moduleKey }).then(parsePublishResult);
}

export async function rollbackStorefront(
  moduleKey: string,
  contentVersion: string,
): Promise<PublishVersion> {
  const body = await adminPost('/api/admin/publish/rollback', { moduleKey, contentVersion });
  const envelope = asRecord(body);
  return parseVersion(envelope?.version);
}
