import { Hono } from 'hono';
import {
  getConversionGroup,
  listConversionTargets,
  type ConversionTargetRecord,
} from '../conversion-pool/conversion-pool';
import { getCustomerServiceConnectionInternal } from '../customer-service/customer-service-connections';
import { apiError } from '../http/api-response';
import type { AppEnvironment } from '../types';
import { hasAdminRequestHeader } from './admin-section-shared';

type RotationCursorRow = { next_index: number };

async function listPreviewTargets(
  db: D1Database,
  sectionId: string,
  groupId: string,
  mode: 'customer_service' | 'link',
): Promise<ConversionTargetRecord[]> {
  const targets = (await listConversionTargets(db, sectionId, groupId, 'active')).filter(
    (target) => target.isEnabled,
  );
  if (mode === 'link') {
    return targets.filter(
      (target) => target.bindingKind === 'link' && Boolean(target.endpointUrl),
    );
  }

  const eligible: ConversionTargetRecord[] = [];
  for (const target of targets) {
    if (
      target.bindingKind !== 'customer_service' ||
      !target.customerServiceConnectionId ||
      !target.remoteGroupId
    ) {
      continue;
    }
    const connection = await getCustomerServiceConnectionInternal(
      db,
      target.customerServiceConnectionId,
    );
    if (connection && !connection.deletedAt && connection.isEnabled)
      eligible.push(target);
  }
  return eligible;
}

export const adminConversionPreviewRoutes = new Hono<AppEnvironment>();

adminConversionPreviewRoutes.post(
  '/:sectionId/conversion-groups/:groupId/rotate-preview',
  async (context) => {
    context.header('Cache-Control', 'no-store');
    if (!hasAdminRequestHeader(context)) {
      return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
    }

    const sectionId = context.req.param('sectionId');
    const groupId = context.req.param('groupId');
    const group = await getConversionGroup(context.env.DB, sectionId, groupId);
    if (!group || group.deletedAt) {
      return apiError(
        context,
        404,
        'CONVERSION_GROUP_NOT_FOUND',
        '转化分组不存在或已进入回收站。',
      );
    }
    if (!group.isEnabled) {
      return apiError(context, 409, 'CONVERSION_GROUP_NOT_READY', '分组当前未启用。');
    }

    const targets = await listPreviewTargets(
      context.env.DB,
      sectionId,
      groupId,
      group.mode,
    );
    if (targets.length === 0) {
      return apiError(context, 409, 'CONVERSION_GROUP_NOT_READY', '分组没有可用入口。');
    }

    const cursor = await context.env.DB.prepare(
      'SELECT next_index FROM conversion_group_rotation WHERE group_id = ?',
    )
      .bind(groupId)
      .first<RotationCursorRow>();
    const nextIndex = cursor?.next_index ?? 0;
    const target = targets[nextIndex % targets.length];
    if (!target) {
      return apiError(context, 409, 'CONVERSION_GROUP_NOT_READY', '分组没有可用入口。');
    }

    return context.json({ target });
  },
);
