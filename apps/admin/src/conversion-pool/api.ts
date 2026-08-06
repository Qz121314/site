import { AdminApiError } from '../api';

export type ConversionMode = 'customer_service' | 'link';
export type ConversionScope = 'active' | 'trash' | 'all';

export type AdminConversionGroup = {
  id: string;
  sectionId: string;
  name: string;
  mode: ConversionMode;
  buttonLabel: string;
  rotationStrategy: 'round_robin';
  sortOrder: number;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  targetCount: number;
  activeTargetCount: number;
  productCount: number;
};

export type AdminConversionTarget = {
  id: string;
  sectionId: string;
  groupId: string;
  name: string;
  endpointUrl: string;
  projectId: string | null;
  config: string | null;
  sortOrder: number;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type ConversionGroupInput = {
  name: string;
  mode: ConversionMode;
  buttonLabel: string;
  sortOrder: number;
  isEnabled: boolean;
};

export type ConversionTargetInput = {
  name: string;
  endpointUrl: string;
  projectId: string | null;
  config: string | null;
  sortOrder: number;
  isEnabled: boolean;
};

type ErrorEnvelope = {
  error?: { code?: string; message?: string };
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
    const envelope = asRecord(body) as ErrorEnvelope | null;
    throw new AdminApiError(
      response.status,
      envelope?.error?.code ?? 'CONVERSION_REQUEST_FAILED',
      envelope?.error?.message ?? '转化池请求失败。',
    );
  }
  return body;
}

function writeRequest(path: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown) {
  return requestJson(path, {
    method,
    headers: {
      'x-admin-request': '1',
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function idempotentPost(path: string, body: unknown) {
  return requestJson(path, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-admin-request': '1',
      'x-idempotency-key': crypto.randomUUID(),
    },
    body: JSON.stringify(body),
  });
}

function parseGroup(value: unknown): AdminConversionGroup {
  const group = asRecord(value);
  if (
    !group ||
    typeof group.id !== 'string' ||
    typeof group.sectionId !== 'string' ||
    typeof group.name !== 'string' ||
    (group.mode !== 'customer_service' && group.mode !== 'link') ||
    typeof group.buttonLabel !== 'string' ||
    group.rotationStrategy !== 'round_robin' ||
    typeof group.sortOrder !== 'number' ||
    typeof group.isEnabled !== 'boolean' ||
    typeof group.createdAt !== 'string' ||
    typeof group.updatedAt !== 'string' ||
    (typeof group.deletedAt !== 'string' && group.deletedAt !== null) ||
    typeof group.targetCount !== 'number' ||
    typeof group.activeTargetCount !== 'number' ||
    typeof group.productCount !== 'number'
  ) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '转化分组返回数据无效。');
  }
  return group as AdminConversionGroup;
}

function parseTarget(value: unknown): AdminConversionTarget {
  const target = asRecord(value);
  if (
    !target ||
    typeof target.id !== 'string' ||
    typeof target.sectionId !== 'string' ||
    typeof target.groupId !== 'string' ||
    typeof target.name !== 'string' ||
    typeof target.endpointUrl !== 'string' ||
    (typeof target.projectId !== 'string' && target.projectId !== null) ||
    (typeof target.config !== 'string' && target.config !== null) ||
    typeof target.sortOrder !== 'number' ||
    typeof target.isEnabled !== 'boolean' ||
    typeof target.createdAt !== 'string' ||
    typeof target.updatedAt !== 'string' ||
    (typeof target.deletedAt !== 'string' && target.deletedAt !== null)
  ) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '转化入口返回数据无效。');
  }
  return target as AdminConversionTarget;
}

function parseGroupEnvelope(value: unknown): AdminConversionGroup {
  return parseGroup(asRecord(value)?.group);
}

function parseTargetEnvelope(value: unknown): AdminConversionTarget {
  return parseTarget(asRecord(value)?.target);
}

function parseList<T>(value: unknown, key: 'groups' | 'targets', parser: (item: unknown) => T): T[] {
  const envelope = asRecord(value);
  const list = envelope?.[key];
  if (!Array.isArray(list)) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '转化池列表返回数据无效。');
  }
  return list.map(parser);
}

function basePath(sectionId: string): string {
  return `/api/admin/sections/${encodeURIComponent(sectionId)}/conversion-groups`;
}

function groupPath(sectionId: string, groupId: string): string {
  return `${basePath(sectionId)}/${encodeURIComponent(groupId)}`;
}

function targetPath(sectionId: string, groupId: string, targetId?: string): string {
  const base = `${groupPath(sectionId, groupId)}/targets`;
  return targetId ? `${base}/${encodeURIComponent(targetId)}` : base;
}

export function fetchConversionGroups(
  sectionId: string,
  scope: ConversionScope = 'active',
): Promise<AdminConversionGroup[]> {
  return requestJson(`${basePath(sectionId)}?scope=${encodeURIComponent(scope)}`).then((value) =>
    parseList(value, 'groups', parseGroup),
  );
}

export function createConversionGroup(
  sectionId: string,
  input: ConversionGroupInput,
): Promise<AdminConversionGroup> {
  return writeRequest(basePath(sectionId), 'POST', input).then(parseGroupEnvelope);
}

export function updateConversionGroup(
  sectionId: string,
  groupId: string,
  input: ConversionGroupInput,
): Promise<AdminConversionGroup> {
  return writeRequest(groupPath(sectionId, groupId), 'PUT', input).then(parseGroupEnvelope);
}

export function deleteConversionGroup(
  sectionId: string,
  groupId: string,
): Promise<AdminConversionGroup> {
  return writeRequest(groupPath(sectionId, groupId), 'DELETE').then(parseGroupEnvelope);
}

export function restoreConversionGroup(
  sectionId: string,
  groupId: string,
): Promise<AdminConversionGroup> {
  return writeRequest(`${groupPath(sectionId, groupId)}/restore`, 'POST').then(parseGroupEnvelope);
}

export async function batchDeleteConversionGroups(sectionId: string, ids: string[]): Promise<string[]> {
  const value = await idempotentPost(`${basePath(sectionId)}/batch-delete`, { ids });
  const result = asRecord(value);
  if (!result || !Array.isArray(result.deletedIds) || !result.deletedIds.every((id) => typeof id === 'string')) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '批量删除返回数据无效。');
  }
  return result.deletedIds;
}

export async function reorderConversionGroups(
  sectionId: string,
  items: Array<{ id: string; sortOrder: number }>,
): Promise<void> {
  const result = asRecord(await idempotentPost(`${basePath(sectionId)}/reorder`, { items }));
  if (!result || result.reordered !== true) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '分组排序返回数据无效。');
  }
}

export function previewRotation(
  sectionId: string,
  groupId: string,
): Promise<AdminConversionTarget> {
  return writeRequest(`${groupPath(sectionId, groupId)}/rotate-preview`, 'POST').then(parseTargetEnvelope);
}

export function fetchConversionTargets(
  sectionId: string,
  groupId: string,
  scope: ConversionScope = 'active',
): Promise<AdminConversionTarget[]> {
  return requestJson(`${targetPath(sectionId, groupId)}?scope=${encodeURIComponent(scope)}`).then((value) =>
    parseList(value, 'targets', parseTarget),
  );
}

export function createConversionTarget(
  sectionId: string,
  groupId: string,
  input: ConversionTargetInput,
): Promise<AdminConversionTarget> {
  return writeRequest(targetPath(sectionId, groupId), 'POST', input).then(parseTargetEnvelope);
}

export function updateConversionTarget(
  sectionId: string,
  groupId: string,
  targetId: string,
  input: ConversionTargetInput,
): Promise<AdminConversionTarget> {
  return writeRequest(targetPath(sectionId, groupId, targetId), 'PUT', input).then(parseTargetEnvelope);
}

export function deleteConversionTarget(
  sectionId: string,
  groupId: string,
  targetId: string,
): Promise<AdminConversionTarget> {
  return writeRequest(targetPath(sectionId, groupId, targetId), 'DELETE').then(parseTargetEnvelope);
}

export function restoreConversionTarget(
  sectionId: string,
  groupId: string,
  targetId: string,
): Promise<AdminConversionTarget> {
  return writeRequest(`${targetPath(sectionId, groupId, targetId)}/restore`, 'POST').then(parseTargetEnvelope);
}

export async function batchDeleteConversionTargets(
  sectionId: string,
  groupId: string,
  ids: string[],
): Promise<string[]> {
  const value = await idempotentPost(`${targetPath(sectionId, groupId)}/batch-delete`, { ids });
  const result = asRecord(value);
  if (!result || !Array.isArray(result.deletedIds) || !result.deletedIds.every((id) => typeof id === 'string')) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '入口批量删除返回数据无效。');
  }
  return result.deletedIds;
}

export async function reorderConversionTargets(
  sectionId: string,
  groupId: string,
  items: Array<{ id: string; sortOrder: number }>,
): Promise<void> {
  const result = asRecord(await idempotentPost(`${targetPath(sectionId, groupId)}/reorder`, { items }));
  if (!result || result.reordered !== true) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '入口排序返回数据无效。');
  }
}
