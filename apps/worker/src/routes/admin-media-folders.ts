import { Hono } from 'hono';
import { writeAuditLog } from '../audit/write-audit-log';
import { apiError } from '../http/api-response';
import {
  deleteMediaFolder,
  ensureMediaFolder,
  listMediaFolders,
  moveMediaAssetsToFolder,
  normalizeMediaFolderName,
  renameMediaFolder,
} from '../media/media-folders';
import type { AppEnvironment } from '../types';
import { hasAdminRequestHeader, isRecord, jsonBodyError, readJsonBody } from './admin-section-shared';

const MAX_MOVE_SIZE = 100;

function readIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_MOVE_SIZE) return null;
  const ids = value.filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 100);
  if (ids.length !== value.length || new Set(ids).size !== ids.length) return null;
  return ids;
}

export const adminMediaFolderRoutes = new Hono<AppEnvironment>();

adminMediaFolderRoutes.get('/folders', async (context) => {
  context.header('Cache-Control', 'no-store');
  return context.json({ folders: await listMediaFolders(context.env.DB) });
});

adminMediaFolderRoutes.post('/folders', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }

  let body: unknown;
  try {
    body = await readJsonBody(context);
  } catch (error) {
    return jsonBodyError(context, error);
  }
  const name = isRecord(body) ? normalizeMediaFolderName(body.name) : null;
  if (!name) {
    return apiError(context, 400, 'MEDIA_FOLDER_NAME_INVALID', '文件夹名称需要 1 到 80 个字符。', { field: 'name' });
  }

  const now = new Date().toISOString();
  const result = await ensureMediaFolder(context.env.DB, name, now);
  await writeAuditLog(context.env.DB, {
    action: result.reused ? 'media_folder.reused' : 'media_folder.created',
    entityType: 'media_folder',
    entityId: result.folder.id,
    requestId: context.get('requestId'),
    metadata: { name: result.folder.name, reused: result.reused },
  });
  return context.json(result, result.reused ? 200 : 201);
});

adminMediaFolderRoutes.put('/folders/:id', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }

  let body: unknown;
  try {
    body = await readJsonBody(context);
  } catch (error) {
    return jsonBodyError(context, error);
  }
  const name = isRecord(body) ? normalizeMediaFolderName(body.name) : null;
  if (!name) {
    return apiError(context, 400, 'MEDIA_FOLDER_NAME_INVALID', '文件夹名称需要 1 到 80 个字符。', { field: 'name' });
  }

  const now = new Date().toISOString();
  try {
    const folder = await renameMediaFolder(context.env.DB, context.req.param('id'), name, now);
    if (!folder) return apiError(context, 404, 'MEDIA_FOLDER_NOT_FOUND', '素材文件夹不存在。');
    await writeAuditLog(context.env.DB, {
      action: 'media_folder.renamed',
      entityType: 'media_folder',
      entityId: folder.id,
      requestId: context.get('requestId'),
      metadata: { name: folder.name },
    });
    return context.json({ folder });
  } catch {
    return apiError(context, 409, 'MEDIA_FOLDER_NAME_EXISTS', '已经存在同名素材文件夹。', { field: 'name' });
  }
});

adminMediaFolderRoutes.delete('/folders/:id', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }
  const now = new Date().toISOString();
  const id = context.req.param('id');
  if (!(await deleteMediaFolder(context.env.DB, id, now))) {
    return apiError(context, 404, 'MEDIA_FOLDER_NOT_FOUND', '素材文件夹不存在。');
  }
  await writeAuditLog(context.env.DB, {
    action: 'media_folder.deleted',
    entityType: 'media_folder',
    entityId: id,
    requestId: context.get('requestId'),
    metadata: { assetsMovedToUnfiled: true },
  });
  return context.json({ deleted: true });
});

adminMediaFolderRoutes.post('/folders/move', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }

  let body: unknown;
  try {
    body = await readJsonBody(context);
  } catch (error) {
    return jsonBodyError(context, error);
  }
  if (!isRecord(body)) return apiError(context, 400, 'MEDIA_MOVE_INVALID', '素材移动参数无效。');
  const ids = readIds(body.ids);
  const folderId = body.folderId === null || body.folderId === ''
    ? null
    : typeof body.folderId === 'string' && body.folderId.length <= 100
      ? body.folderId
      : undefined;
  if (!ids || folderId === undefined) {
    return apiError(context, 400, 'MEDIA_MOVE_INVALID', `请选择 1 到 ${MAX_MOVE_SIZE} 个素材并指定目标文件夹。`);
  }

  const now = new Date().toISOString();
  const movedCount = await moveMediaAssetsToFolder(context.env.DB, ids, folderId, now);
  if (movedCount < 0) return apiError(context, 404, 'MEDIA_FOLDER_NOT_FOUND', '目标素材文件夹不存在。');

  await writeAuditLog(context.env.DB, {
    action: 'media.moved',
    entityType: 'media_asset_batch',
    entityId: crypto.randomUUID(),
    requestId: context.get('requestId'),
    metadata: { ids, folderId, movedCount },
  });
  return context.json({ movedCount, folderId });
});
