import { Hono } from 'hono';
import { createAuditLogStatement } from '../audit/write-audit-log';
import { apiError } from '../http/api-response';
import {
  createLandingStatement,
  getLanding,
  isLandingConflictError,
  listLandings,
  updateLandingStatement,
  validateLandingDependencies,
  validateLandingInput,
  type LandingRecord,
} from '../landing/landing-pages';
import type { AppEnvironment } from '../types';
import {
  hasAdminRequestHeader,
  jsonBodyError,
  readJsonBody,
} from './admin-section-shared';

export const adminLandingRoutes = new Hono<AppEnvironment>();
function scope(value: string | undefined): 'active' | 'trash' | 'all' | null {
  return !value || value === 'active'
    ? 'active'
    : value === 'trash' || value === 'all'
      ? value
      : null;
}
function missing(context: Parameters<typeof apiError>[0]) {
  return apiError(context, 404, 'LANDING_NOT_FOUND', '落地页不存在或已进入回收站。');
}

adminLandingRoutes.get('/', async (c) => {
  const value = scope(c.req.query('scope'));
  if (!value) return apiError(c, 400, 'INVALID_LANDING_SCOPE', '落地页列表范围无效。');
  c.header('Cache-Control', 'no-store');
  return c.json({ landings: await listLandings(c.env.DB, value) });
});
adminLandingRoutes.get('/products/options', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT p.id,p.section_id,p.title,p.status,p.is_visible,s.name AS section_name,
       COALESCE(p.cover_asset_id,(SELECT pm.media_asset_id FROM product_media pm WHERE pm.product_id=p.id ORDER BY pm.sort_order LIMIT 1)) AS cover_asset_id,
       (SELECT COUNT(*) FROM product_media pm WHERE pm.product_id=p.id) AS media_count,
       cg.name AS conversion_group_name,cg.button_label
     FROM products p JOIN sections s ON s.id=p.section_id
     LEFT JOIN conversion_groups cg ON cg.id=p.conversion_group_id
     WHERE p.deleted_at IS NULL AND s.deleted_at IS NULL
     ORDER BY s.sort_order,p.sort_order,p.title`,
  ).all<{
    id: string;
    section_id: string;
    title: string;
    status: string;
    is_visible: number;
    section_name: string;
    cover_asset_id: string | null;
    media_count: number;
    conversion_group_name: string | null;
    button_label: string | null;
  }>();
  return c.json({
    products: rows.results.map((row) => ({
      id: row.id,
      sectionId: row.section_id,
      title: row.title,
      status: row.status,
      isVisible: row.is_visible === 1,
      sectionName: row.section_name,
      coverAssetId: row.cover_asset_id,
      mediaCount: row.media_count,
      conversionGroupName: row.conversion_group_name,
      buttonLabel: row.button_label,
    })),
  });
});
adminLandingRoutes.get('/:id', async (c) => {
  const landing = await getLanding(c.env.DB, c.req.param('id'));
  return landing ? c.json({ landing }) : missing(c);
});
adminLandingRoutes.post('/', async (c) => {
  if (!hasAdminRequestHeader(c))
    return apiError(c, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  let body: unknown;
  try {
    body = await readJsonBody(c);
  } catch (error) {
    return jsonBodyError(c, error);
  }
  const validation = validateLandingInput(body);
  if (!validation.ok)
    return apiError(c, 400, 'INVALID_LANDING', validation.message, {
      field: validation.field,
    });
  const dependencies = await validateLandingDependencies(c.env.DB, validation.value);
  if (!dependencies.ok)
    return apiError(c, 409, dependencies.code, dependencies.message, {
      field: dependencies.field,
    });
  const now = new Date().toISOString();
  const created = createLandingStatement(c.env.DB, validation.value, now);
  try {
    await c.env.DB.batch([
      created.statement,
      createAuditLogStatement(c.env.DB, {
        action: 'landing.created',
        entityType: 'landing',
        entityId: created.landing.id,
        requestId: c.get('requestId'),
        after: created.landing,
        createdAt: now,
      }),
    ]);
  } catch (error) {
    if (isLandingConflictError(error))
      return apiError(c, 409, 'LANDING_SLUG_CONFLICT', '已存在相同的落地页地址。');
    throw error;
  }
  return c.json({ landing: created.landing }, 201);
});
adminLandingRoutes.put('/:id', async (c) => {
  if (!hasAdminRequestHeader(c))
    return apiError(c, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  const current = await getLanding(c.env.DB, c.req.param('id'));
  if (!current || current.deletedAt) return missing(c);
  let body: unknown;
  try {
    body = await readJsonBody(c);
  } catch (error) {
    return jsonBodyError(c, error);
  }
  const validation = validateLandingInput(body);
  if (!validation.ok)
    return apiError(c, 400, 'INVALID_LANDING', validation.message, {
      field: validation.field,
    });
  const dependencies = await validateLandingDependencies(c.env.DB, validation.value);
  if (!dependencies.ok)
    return apiError(c, 409, dependencies.code, dependencies.message, {
      field: dependencies.field,
    });
  const now = new Date().toISOString();
  const publishedAt =
    validation.value.status === 'published' ? (current.publishedAt ?? now) : null;
  const updated: LandingRecord = {
    ...current,
    ...validation.value,
    publishedAt,
    updatedAt: now,
  };
  try {
    await c.env.DB.batch([
      updateLandingStatement(c.env.DB, current.id, validation.value, publishedAt, now),
      createAuditLogStatement(c.env.DB, {
        action: 'landing.updated',
        entityType: 'landing',
        entityId: current.id,
        requestId: c.get('requestId'),
        before: current,
        after: updated,
        createdAt: now,
      }),
    ]);
  } catch (error) {
    if (isLandingConflictError(error))
      return apiError(c, 409, 'LANDING_SLUG_CONFLICT', '已存在相同的落地页地址。');
    throw error;
  }
  return c.json({ landing: updated });
});
adminLandingRoutes.delete('/:id', async (c) => {
  if (!hasAdminRequestHeader(c))
    return apiError(c, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  const current = await getLanding(c.env.DB, c.req.param('id'));
  if (!current || current.deletedAt) return missing(c);
  const now = new Date().toISOString();
  const deleted = {
    ...current,
    status: 'archived' as const,
    deletedAt: now,
    updatedAt: now,
  };
  await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE landing_pages SET status='archived',deleted_at=?,updated_at=? WHERE id=?`,
    ).bind(now, now, current.id),
    createAuditLogStatement(c.env.DB, {
      action: 'landing.deleted',
      entityType: 'landing',
      entityId: current.id,
      requestId: c.get('requestId'),
      before: current,
      after: deleted,
      createdAt: now,
    }),
  ]);
  return c.json({ landing: deleted });
});
adminLandingRoutes.post('/:id/restore', async (c) => {
  if (!hasAdminRequestHeader(c))
    return apiError(c, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  const current = await getLanding(c.env.DB, c.req.param('id'));
  if (!current || !current.deletedAt) return missing(c);
  const now = new Date().toISOString();
  const restored = {
    ...current,
    status: 'draft' as const,
    deletedAt: null,
    publishedAt: null,
    updatedAt: now,
  };
  try {
    await c.env.DB.batch([
      c.env.DB.prepare(
        `UPDATE landing_pages SET status='draft',deleted_at=NULL,published_at=NULL,updated_at=? WHERE id=?`,
      ).bind(now, current.id),
      createAuditLogStatement(c.env.DB, {
        action: 'landing.restored',
        entityType: 'landing',
        entityId: current.id,
        requestId: c.get('requestId'),
        before: current,
        after: restored,
        createdAt: now,
      }),
    ]);
  } catch (error) {
    if (isLandingConflictError(error))
      return apiError(c, 409, 'LANDING_RESTORE_CONFLICT', '落地页地址已被占用。');
    throw error;
  }
  return c.json({ landing: restored });
});
