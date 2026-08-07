import { AdminApiError } from './api';

export type PublishVersion = {
  contentVersion: string;
  publishedAt: string;
  isCurrent: boolean;
  objectCount: number;
  totalBytes: number;
};

export type PublishStatus = {
  currentVersion: string | null;
  publishedAt: string | null;
  isCurrent: boolean;
  versions: PublishVersion[];
  lastJob: {
    id: string;
    status: 'queued' | 'building' | 'published' | 'failed' | 'cancelled';
    contentVersion: string | null;
    errorCode: string | null;
    errorMessage: string | null;
    requestedAt: string;
    completedAt: string | null;
  } | null;
};

export type PublishResult = {
  jobId: string;
  contentVersion: string;
  sourceRevision: string;
  publishedAt: string;
  objectCount: number;
  totalBytes: number;
  unchanged: boolean;
};

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
  const response = await fetch(path, {
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

function adminPost(path: string, body?: unknown): Promise<unknown> {
  return requestJson(path, {
    method: 'POST',
    headers: {
      'x-admin-request': '1',
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function parseVersion(value: unknown): PublishVersion {
  const version = asRecord(value);
  if (
    !version ||
    typeof version.contentVersion !== 'string' ||
    typeof version.publishedAt !== 'string' ||
    typeof version.isCurrent !== 'boolean' ||
    typeof version.objectCount !== 'number' ||
    typeof version.totalBytes !== 'number'
  ) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '前台版本返回数据无效。');
  }
  return version as PublishVersion;
}

function parseStatus(value: unknown): PublishStatus {
  const envelope = asRecord(value);
  const status = envelope ? asRecord(envelope.status) : null;
  if (!status || !Array.isArray(status.versions)) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '发布状态返回数据无效。');
  }

  const lastJob = status.lastJob === null ? null : asRecord(status.lastJob);
  if (
    (typeof status.currentVersion !== 'string' && status.currentVersion !== null) ||
    (typeof status.publishedAt !== 'string' && status.publishedAt !== null) ||
    typeof status.isCurrent !== 'boolean' ||
    (lastJob !== null &&
      (typeof lastJob.id !== 'string' ||
        !['queued', 'building', 'published', 'failed', 'cancelled'].includes(String(lastJob.status)) ||
        (typeof lastJob.contentVersion !== 'string' && lastJob.contentVersion !== null) ||
        (typeof lastJob.errorCode !== 'string' && lastJob.errorCode !== null) ||
        (typeof lastJob.errorMessage !== 'string' && lastJob.errorMessage !== null) ||
        typeof lastJob.requestedAt !== 'string' ||
        (typeof lastJob.completedAt !== 'string' && lastJob.completedAt !== null)))
  ) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '发布状态返回数据无效。');
  }

  return {
    currentVersion: status.currentVersion as string | null,
    publishedAt: status.publishedAt as string | null,
    isCurrent: status.isCurrent,
    versions: status.versions.map(parseVersion),
    lastJob: lastJob as PublishStatus['lastJob'],
  };
}

function parsePublishResult(value: unknown): PublishResult {
  const envelope = asRecord(value);
  const publication = envelope ? asRecord(envelope.publication) : null;
  if (
    !publication ||
    typeof publication.jobId !== 'string' ||
    typeof publication.contentVersion !== 'string' ||
    typeof publication.sourceRevision !== 'string' ||
    typeof publication.publishedAt !== 'string' ||
    typeof publication.objectCount !== 'number' ||
    typeof publication.totalBytes !== 'number' ||
    typeof publication.unchanged !== 'boolean'
  ) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '发布结果返回数据无效。');
  }
  return publication as PublishResult;
}

export function fetchPublishStatus(): Promise<PublishStatus> {
  return requestJson('/api/admin/publish/').then(parseStatus);
}

export function publishStorefront(): Promise<PublishResult> {
  return adminPost('/api/admin/publish/').then(parsePublishResult);
}

export async function rollbackStorefront(contentVersion: string): Promise<PublishVersion> {
  const body = await adminPost('/api/admin/publish/rollback', { contentVersion });
  const envelope = asRecord(body);
  return parseVersion(envelope?.version);
}
