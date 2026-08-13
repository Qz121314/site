import { Hono } from 'hono';
import { createAuditLogStatement } from '../audit/write-audit-log';
import {
  createCustomerServiceConnection,
  createDeleteCustomerServiceConnectionStatement,
  createRestoreCustomerServiceConnectionStatement,
  createSetCustomerServiceVerificationStatement,
  createUpdateCustomerServiceConnectionStatement,
  getCustomerServiceConnection,
  getCustomerServiceConnectionInternal,
  isCustomerServiceConnectionConflict,
  listCustomerServiceConnections,
  toPublicCustomerServiceConnection,
  validateCustomerServiceConnectionInput,
  type CustomerServiceConnectionRecord,
  type CustomerServiceScope,
} from '../customer-service/customer-service-connections';
import {
  CustomerServiceProviderError,
  parseCustomerServiceIntegration,
} from '../customer-service/customer-service-provider';
import { apiError } from '../http/api-response';
import {
  createIdempotencyStatement,
  normalizeIdempotencyKey,
  readIdempotentResponse,
} from '../idempotency/idempotency';
import type { AppEnvironment } from '../types';
import {
  hasAdminRequestHeader,
  isRecord,
  jsonBodyError,
  readJsonBody,
} from './admin-section-shared';

const IDEMPOTENCY_HEADER = 'x-idempotency-key';
const MAX_BATCH_SIZE = 100;

export const adminCustomerServiceRoutes = new Hono<AppEnvironment>();

function parseScope(value: string | undefined): CustomerServiceScope | null {
  if (!value || value === 'active') return 'active';
  if (value === 'trash' || value === 'all') return value;
  return null;
}

function parseBatchIds(value: unknown): string[] | null {
  if (!isRecord(value) || !Array.isArray(value.ids)) return null;
  const ids = value.ids.filter(
    (id): id is string => typeof id === 'string' && id.length > 0,
  );
  if (ids.length === 0 || ids.length !== value.ids.length || ids.length > MAX_BATCH_SIZE)
    return null;
  const unique = [...new Set(ids)];
  return unique.length === ids.length ? unique : null;
}

async function readBody(
  context: Parameters<typeof apiError>[0],
): Promise<unknown | Response> {
  try {
    return await readJsonBody(context);
  } catch (error) {
    return jsonBodyError(context, error);
  }
}

function isResponse(value: unknown): value is Response {
  return value instanceof Response;
}

function connectionNotFound(context: Parameters<typeof apiError>[0]) {
  return apiError(
    context,
    404,
    'CUSTOMER_SERVICE_CONNECTION_NOT_FOUND',
    '客服系统连接不存在。',
  );
}

function connectionDeleteBlocked(
  context: Parameters<typeof apiError>[0],
  connection: CustomerServiceConnectionRecord,
) {
  return apiError(
    context,
    409,
    'CUSTOMER_SERVICE_CONNECTION_IN_USE',
    `客服系统“${connection.name}”仍被 ${connection.targetCount} 个在线客服分组使用，不能删除。`,
    { targetCount: connection.targetCount },
  );
}

function connectionAuditValue(connection: CustomerServiceConnectionRecord) {
  return {
    id: connection.id,
    name: connection.name,
    provider: connection.provider,
    baseUrl: connection.baseUrl,
    hasVerifyToken: connection.hasVerifyToken,
    clientApiUrl: connection.clientApiUrl,
    realtimeUrl: connection.realtimeUrl,
    verifiedAt: connection.verifiedAt,
    isEnabled: connection.isEnabled,
    deletedAt: connection.deletedAt,
    targetCount: connection.targetCount,
  };
}

function browserVerificationUnavailable(
  context: Parameters<typeof apiError>[0],
  code: string,
  message: string,
) {
  return apiError(context, 409, code, message);
}

adminCustomerServiceRoutes.get('/connections', async (context) => {
  context.header('Cache-Control', 'no-store');
  const scope = parseScope(context.req.query('scope'));
  if (!scope) {
    return apiError(
      context,
      400,
      'INVALID_CUSTOMER_SERVICE_SCOPE',
      '客服系统列表范围无效。',
    );
  }
  return context.json({
    connections: await listCustomerServiceConnections(context.env.DB, scope),
  });
});

adminCustomerServiceRoutes.post('/connections/batch-delete', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }
  const idempotencyKey = normalizeIdempotencyKey(context.req.header(IDEMPOTENCY_HEADER));
  if (!idempotencyKey) {
    return apiError(context, 400, 'IDEMPOTENCY_KEY_REQUIRED', '批量删除缺少幂等键。');
  }
  const now = new Date().toISOString();
  const scope = 'customer-service-connections.batch-delete';
  const prior = await readIdempotentResponse(context.env.DB, scope, idempotencyKey, now);
  if (isRecord(prior)) return context.json(prior);
  const body = await readBody(context);
  if (isResponse(body)) return body;
  const ids = parseBatchIds(body);
  if (!ids) {
    return apiError(
      context,
      400,
      'INVALID_CUSTOMER_SERVICE_CONNECTION_IDS',
      '请选择有效的客服系统连接。',
    );
  }
  const connections = await Promise.all(
    ids.map((id) => getCustomerServiceConnection(context.env.DB, id)),
  );
  const active = connections.filter((item): item is CustomerServiceConnectionRecord =>
    Boolean(item),
  );
  if (active.length !== ids.length || active.some((item) => item.deletedAt))
    return connectionNotFound(context);
  const blocked = active.find((item) => item.targetCount > 0);
  if (blocked) return connectionDeleteBlocked(context, blocked);

  const responseBody = { deletedIds: ids };
  const statements: D1PreparedStatement[] = [];
  for (const connection of active) {
    statements.push(
      createDeleteCustomerServiceConnectionStatement(context.env.DB, connection.id, now),
      createAuditLogStatement(context.env.DB, {
        action: 'customer-service-connection.deleted',
        entityType: 'customer_service_connection',
        entityId: connection.id,
        requestId: context.get('requestId'),
        before: connectionAuditValue(connection),
        after: { ...connectionAuditValue(connection), isEnabled: false, deletedAt: now },
        metadata: { batch: true },
        createdAt: now,
      }),
    );
  }
  statements.push(
    createIdempotencyStatement(context.env.DB, scope, idempotencyKey, responseBody, now),
  );
  await context.env.DB.batch(statements);
  return context.json(responseBody);
});

adminCustomerServiceRoutes.post('/connections', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }
  const body = await readBody(context);
  if (isResponse(body)) return body;
  const validation = validateCustomerServiceConnectionInput(body);
  if (!validation.ok) {
    return apiError(
      context,
      400,
      'INVALID_CUSTOMER_SERVICE_CONNECTION',
      validation.message,
      { field: validation.field },
    );
  }
  const now = new Date().toISOString();
  const created = createCustomerServiceConnection(context.env.DB, validation.value, now);
  try {
    await context.env.DB.batch([
      created.statement,
      createAuditLogStatement(context.env.DB, {
        action: 'customer-service-connection.created',
        entityType: 'customer_service_connection',
        entityId: created.connection.id,
        requestId: context.get('requestId'),
        after: connectionAuditValue(created.connection),
        createdAt: now,
      }),
    ]);
  } catch (error) {
    if (isCustomerServiceConnectionConflict(error)) {
      return apiError(
        context,
        409,
        'CUSTOMER_SERVICE_CONNECTION_NAME_CONFLICT',
        '已存在同名客服系统连接。',
      );
    }
    throw error;
  }
  return context.json({ connection: created.connection }, 201);
});

adminCustomerServiceRoutes.put('/connections/:id', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }
  const current = await getCustomerServiceConnectionInternal(
    context.env.DB,
    context.req.param('id'),
  );
  if (!current || current.deletedAt) return connectionNotFound(context);
  const body = await readBody(context);
  if (isResponse(body)) return body;
  const validation = validateCustomerServiceConnectionInput(body);
  if (!validation.ok) {
    return apiError(
      context,
      400,
      'INVALID_CUSTOMER_SERVICE_CONNECTION',
      validation.message,
      { field: validation.field },
    );
  }
  const now = new Date().toISOString();
  const resolvedVerifyToken =
    validation.value.verifyToken === undefined
      ? current.verifyToken
      : validation.value.verifyToken;
  const clearVerification =
    current.baseUrl !== validation.value.baseUrl ||
    current.verifyToken !== resolvedVerifyToken;
  const updatedInternal = {
    ...current,
    ...validation.value,
    verifyToken: resolvedVerifyToken,
    hasVerifyToken: Boolean(resolvedVerifyToken),
    clientApiUrl: clearVerification ? null : current.clientApiUrl,
    realtimeUrl: clearVerification ? null : current.realtimeUrl,
    verifiedAt: clearVerification ? null : current.verifiedAt,
    verifiedGroups: clearVerification ? [] : current.verifiedGroups,
    updatedAt: now,
  };
  const updated = toPublicCustomerServiceConnection(updatedInternal);
  try {
    await context.env.DB.batch([
      createUpdateCustomerServiceConnectionStatement(
        context.env.DB,
        current.id,
        validation.value,
        current.verifyToken,
        clearVerification,
        now,
      ),
      createAuditLogStatement(context.env.DB, {
        action: 'customer-service-connection.updated',
        entityType: 'customer_service_connection',
        entityId: current.id,
        requestId: context.get('requestId'),
        before: connectionAuditValue(toPublicCustomerServiceConnection(current)),
        after: connectionAuditValue(updated),
        createdAt: now,
      }),
    ]);
  } catch (error) {
    if (isCustomerServiceConnectionConflict(error)) {
      return apiError(
        context,
        409,
        'CUSTOMER_SERVICE_CONNECTION_NAME_CONFLICT',
        '已存在同名客服系统连接。',
      );
    }
    throw error;
  }
  return context.json({ connection: updated });
});

adminCustomerServiceRoutes.delete('/connections/:id', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }
  const current = await getCustomerServiceConnection(
    context.env.DB,
    context.req.param('id'),
  );
  if (!current || current.deletedAt) return connectionNotFound(context);
  if (current.targetCount > 0) return connectionDeleteBlocked(context, current);
  const now = new Date().toISOString();
  const deleted = { ...current, isEnabled: false, deletedAt: now, updatedAt: now };
  await context.env.DB.batch([
    createDeleteCustomerServiceConnectionStatement(context.env.DB, current.id, now),
    createAuditLogStatement(context.env.DB, {
      action: 'customer-service-connection.deleted',
      entityType: 'customer_service_connection',
      entityId: current.id,
      requestId: context.get('requestId'),
      before: connectionAuditValue(current),
      after: connectionAuditValue(deleted),
      createdAt: now,
    }),
  ]);
  return context.json({ connection: deleted });
});

adminCustomerServiceRoutes.post('/connections/:id/restore', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }
  const current = await getCustomerServiceConnection(
    context.env.DB,
    context.req.param('id'),
  );
  if (!current || !current.deletedAt) return connectionNotFound(context);
  const now = new Date().toISOString();
  const restored = { ...current, deletedAt: null, updatedAt: now };
  try {
    await context.env.DB.batch([
      createRestoreCustomerServiceConnectionStatement(context.env.DB, current.id, now),
      createAuditLogStatement(context.env.DB, {
        action: 'customer-service-connection.restored',
        entityType: 'customer_service_connection',
        entityId: current.id,
        requestId: context.get('requestId'),
        before: connectionAuditValue(current),
        after: connectionAuditValue(restored),
        createdAt: now,
      }),
    ]);
  } catch (error) {
    if (isCustomerServiceConnectionConflict(error)) {
      return apiError(
        context,
        409,
        'CUSTOMER_SERVICE_CONNECTION_RESTORE_CONFLICT',
        '已有同名客服系统连接。',
      );
    }
    throw error;
  }
  return context.json({ connection: restored });
});

adminCustomerServiceRoutes.get(
  '/connections/:id/verification-context',
  async (context) => {
    context.header('Cache-Control', 'no-store');
    const connection = await getCustomerServiceConnectionInternal(
      context.env.DB,
      context.req.param('id'),
    );
    if (!connection || connection.deletedAt) return connectionNotFound(context);
    if (!connection.isEnabled) {
      return browserVerificationUnavailable(
        context,
        'CUSTOMER_SERVICE_CONNECTION_DISABLED',
        '该客服系统连接当前未启用。',
      );
    }
    if (!connection.verifyToken) {
      return apiError(
        context,
        400,
        'CUSTOMER_SERVICE_VERIFY_TOKEN_REQUIRED',
        '请先配置客服系统验证 Token。',
      );
    }
    return context.json({
      baseUrl: connection.baseUrl,
      verifyToken: connection.verifyToken,
    });
  },
);

adminCustomerServiceRoutes.post(
  '/connections/:id/verification-result',
  async (context) => {
    context.header('Cache-Control', 'no-store');
    if (!hasAdminRequestHeader(context)) {
      return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
    }
    const connection = await getCustomerServiceConnectionInternal(
      context.env.DB,
      context.req.param('id'),
    );
    if (!connection || connection.deletedAt) return connectionNotFound(context);
    if (!connection.isEnabled) {
      return browserVerificationUnavailable(
        context,
        'CUSTOMER_SERVICE_CONNECTION_DISABLED',
        '该客服系统连接当前未启用。',
      );
    }
    if (!connection.verifyToken) {
      return apiError(
        context,
        400,
        'CUSTOMER_SERVICE_VERIFY_TOKEN_REQUIRED',
        '请先配置客服系统验证 Token。',
      );
    }

    const body = await readBody(context);
    if (isResponse(body)) return body;
    if (!isRecord(body) || !Object.hasOwn(body, 'integration')) {
      return apiError(
        context,
        400,
        'CUSTOMER_SERVICE_INVALID_RESPONSE',
        '客服系统验证结果无效。',
      );
    }

    let result;
    try {
      result = parseCustomerServiceIntegration(body.integration);
    } catch (error) {
      if (error instanceof CustomerServiceProviderError) {
        return apiError(context, 400, error.code, error.message);
      }
      throw error;
    }

    const verifiedAt = new Date().toISOString();
    await context.env.DB.batch([
      createSetCustomerServiceVerificationStatement(
        context.env.DB,
        connection.id,
        result.clientApiUrl,
        result.realtimeUrl,
        result.groups,
        verifiedAt,
      ),
      createAuditLogStatement(context.env.DB, {
        action: 'customer-service-connection.verified',
        entityType: 'customer_service_connection',
        entityId: connection.id,
        requestId: context.get('requestId'),
        before: connectionAuditValue(toPublicCustomerServiceConnection(connection)),
        after: {
          ...connectionAuditValue(toPublicCustomerServiceConnection(connection)),
          clientApiUrl: result.clientApiUrl,
          realtimeUrl: result.realtimeUrl,
          verifiedAt,
        },
        metadata: { groupCount: result.groups.length, transport: 'admin-browser' },
        createdAt: verifiedAt,
      }),
    ]);

    return context.json({
      connected: true,
      groupCount: result.groups.length,
      verifiedAt,
    });
  },
);

adminCustomerServiceRoutes.get('/connections/:id/groups', async (context) => {
  context.header('Cache-Control', 'no-store');
  const connection = await getCustomerServiceConnectionInternal(
    context.env.DB,
    context.req.param('id'),
  );
  if (!connection || connection.deletedAt) return connectionNotFound(context);
  if (!connection.verifiedAt || !connection.clientApiUrl || !connection.realtimeUrl) {
    return browserVerificationUnavailable(
      context,
      'CUSTOMER_SERVICE_NOT_VERIFIED',
      '请先验证客服系统连接。',
    );
  }
  return context.json({ groups: connection.verifiedGroups });
});
