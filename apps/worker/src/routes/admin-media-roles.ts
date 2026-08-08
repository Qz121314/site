import { Hono } from 'hono';
import { writeAuditLog } from '../audit/write-audit-log';
import { apiError } from '../http/api-response';
import { parseMediaRole } from '../media/media-center';
import type { AppEnvironment } from '../types';
import { hasAdminRequestHeader, isRecord, jsonBodyError, readJsonBody } from './admin-section-shared';

export const adminMediaRoleRoutes = new Hono<AppEnvironment>();

adminMediaRoleRoutes.post('/library/role', async (context) => {
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

  if (!isRecord(body)) {
    return apiError(context, 400, 'MEDIA_ROLE_INPUT_INVALID', '素材用途数据无效。');
  }
  const id = typeof body.id === 'string' && body.id.length > 0 && body.id.length <= 100
    ? body.id
    : null;
  const role = parseMediaRole(body.role);
  if (!id || !role) {
    return apiError(context, 400, 'MEDIA_ROLE_INPUT_INVALID', '素材或用途无效。');
  }

  const exists = await context.env.DB
    .prepare(
      `SELECT id FROM media_assets
       WHERE id = ? AND status = 'ready' AND deleted_at IS NULL`,
    )
    .bind(id)
    .first<{ id: string }>();
  if (!exists) {
    return apiError(context, 404, 'MEDIA_ASSET_NOT_FOUND', '素材不存在或已删除。');
  }

  const createdAt = new Date().toISOString();
  await context.env.DB
    .prepare(
      `INSERT INTO media_asset_roles (media_asset_id, role, created_at)
       VALUES (?, ?, ?)
       ON CONFLICT(media_asset_id, role) DO NOTHING`,
    )
    .bind(id, role, createdAt)
    .run();

  await writeAuditLog(context.env.DB, {
    action: 'media.role_assigned',
    entityType: 'media_asset',
    entityId: id,
    requestId: context.get('requestId'),
    metadata: { role },
    createdAt,
  });

  return context.json({ id, role });
});
