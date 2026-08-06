import { Hono } from 'hono';
import { requireAdminSession, requirePermission } from '../middleware/admin-auth';
import { listAuditLogs } from '../repositories/admin-auth';
import type { AppEnvironment } from '../types';

const router = new Hono<AppEnvironment>();

router.use('*', requireAdminSession);

router.get('/me', (context) => {
  context.header('cache-control', 'no-store');
  return context.json({ administrator: context.get('adminSession') });
});

router.get('/audit-logs', requirePermission('audit.read'), async (context) => {
  const requestedLimit = Number.parseInt(context.req.query('limit') ?? '50', 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 50;
  const rows = await listAuditLogs(context.env.DB, limit);

  return context.json({
    items: rows.map((row) => ({
      id: row.id,
      actorAdminUserId: row.actor_admin_user_id,
      actorEmail: row.actor_email,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      requestId: row.request_id,
      metadata: JSON.parse(row.metadata_json) as unknown,
      createdAt: row.created_at,
    })),
  });
});

export default router;
