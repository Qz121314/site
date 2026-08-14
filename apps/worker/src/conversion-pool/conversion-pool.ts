export type ConversionMode = 'customer_service' | 'link';
export type ConversionScope = 'active' | 'trash' | 'all';
export type ConversionTargetBindingKind =
  'link' | 'customer_service' | 'legacy_customer_service';

export type ConversionGroupRecord = {
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
  customerServiceConnectionId: string | null;
  customerServiceConnectionName: string | null;
  remoteGroupId: string | null;
  remoteGroupName: string | null;
};

export type ConversionTargetRecord = {
  id: string;
  sectionId: string;
  groupId: string;
  name: string;
  bindingKind: ConversionTargetBindingKind;
  endpointUrl: string | null;
  customerServiceConnectionId: string | null;
  customerServiceConnectionName: string | null;
  remoteGroupId: string | null;
  remoteGroupName: string | null;
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
  customerServiceConnectionId: string | null;
  remoteGroupId: string | null;
  remoteGroupName: string | null;
};

export type ConversionTargetInput = {
  name: string;
  endpointUrl: string | null;
  customerServiceConnectionId: string | null;
  remoteGroupId: string | null;
  remoteGroupName: string | null;
  sortOrder: number;
  isEnabled: boolean;
};

type ConversionGroupRow = {
  id: string;
  section_id: string;
  name: string;
  mode: ConversionMode;
  button_label: string;
  rotation_strategy: 'round_robin';
  sort_order: number;
  is_enabled: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  target_count: number;
  active_target_count: number;
  product_count: number;
  customer_service_connection_id: string | null;
  customer_service_connection_name: string | null;
  remote_group_id: string | null;
  remote_group_name: string | null;
};

type ConversionTargetRow = {
  id: string;
  section_id: string;
  group_id: string;
  group_mode: ConversionMode;
  name: string;
  endpoint_url: string | null;
  customer_service_connection_id: string | null;
  customer_service_connection_name: string | null;
  remote_group_id: string | null;
  remote_group_name: string | null;
  sort_order: number;
  is_enabled: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type ValidationResult<T> =
  { ok: true; value: T } | { ok: false; field: string; message: string };

type RotationRow = { selected_index: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readRequiredText(
  value: unknown,
  field: string,
  label: string,
  maxLength: number,
): ValidationResult<string> {
  if (typeof value !== 'string') {
    return { ok: false, field, message: `${label}必须是文本。` };
  }
  const normalized = value.trim();
  if (!normalized) {
    return { ok: false, field, message: `请填写${label}。` };
  }
  if (normalized.length > maxLength) {
    return {
      ok: false,
      field,
      message: `${label}不能超过 ${maxLength} 个字符。`,
    };
  }
  return { ok: true, value: normalized };
}

function readNullableText(
  value: unknown,
  field: string,
  label: string,
  maxLength: number,
): ValidationResult<string | null> {
  if (value === null || value === undefined || value === '') {
    return { ok: true, value: null };
  }
  if (typeof value !== 'string') {
    return { ok: false, field, message: `${label}必须是文本。` };
  }
  const normalized = value.trim();
  if (!normalized) return { ok: true, value: null };
  if (normalized.length > maxLength) {
    return {
      ok: false,
      field,
      message: `${label}不能超过 ${maxLength} 个字符。`,
    };
  }
  return { ok: true, value: normalized };
}

function readSortOrder(value: unknown): ValidationResult<number> {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > 1_000_000
  ) {
    return {
      ok: false,
      field: 'sortOrder',
      message: '排序必须是 0 到 1000000 的整数。',
    };
  }
  return { ok: true, value };
}

export function validateConversionGroupInput(
  value: unknown,
): ValidationResult<ConversionGroupInput> {
  if (!isRecord(value)) {
    return { ok: false, field: 'form', message: '转化分组数据无效。' };
  }

  const name = readRequiredText(value.name, 'name', '分组名称', 100);
  if (!name.ok) return name;
  const buttonLabel = readRequiredText(
    value.buttonLabel,
    'buttonLabel',
    'CTA 按钮文字',
    80,
  );
  if (!buttonLabel.ok) return buttonLabel;
  if (value.mode !== 'customer_service' && value.mode !== 'link') {
    return { ok: false, field: 'mode', message: '请选择在线客服或链接分组。' };
  }
  const sortOrder = readSortOrder(value.sortOrder);
  if (!sortOrder.ok) return sortOrder;
  if (typeof value.isEnabled !== 'boolean') {
    return { ok: false, field: 'isEnabled', message: '必须选择启用或停用。' };
  }

  if (value.mode === 'customer_service') {
    const connectionId = readRequiredText(
      value.customerServiceConnectionId,
      'customerServiceConnectionId',
      '客服系统',
      100,
    );
    if (!connectionId.ok) return connectionId;

    return {
      ok: true,
      value: {
        name: name.value,
        mode: 'customer_service',
        buttonLabel: buttonLabel.value,
        sortOrder: sortOrder.value,
        isEnabled: value.isEnabled,
        customerServiceConnectionId: connectionId.value,
        remoteGroupId: null,
        remoteGroupName: null,
      },
    };
  }

  return {
    ok: true,
    value: {
      name: name.value,
      mode: 'link',
      buttonLabel: buttonLabel.value,
      sortOrder: sortOrder.value,
      isEnabled: value.isEnabled,
      customerServiceConnectionId: null,
      remoteGroupId: null,
      remoteGroupName: null,
    },
  };
}

export function validateConversionTargetInput(
  value: unknown,
  mode: ConversionMode,
): ValidationResult<ConversionTargetInput> {
  if (!isRecord(value)) {
    return { ok: false, field: 'form', message: '转化入口数据无效。' };
  }
  if (mode === 'customer_service') {
    return {
      ok: false,
      field: 'form',
      message: '在线客服分组直接绑定客服系统，不再使用转化入口。',
    };
  }

  const sortOrder = readSortOrder(value.sortOrder);
  if (!sortOrder.ok) return sortOrder;
  if (typeof value.isEnabled !== 'boolean') {
    return { ok: false, field: 'isEnabled', message: '必须选择启用或停用。' };
  }
  const name = readRequiredText(value.name, 'name', '链接名称', 100);
  if (!name.ok) return name;
  const endpoint = readNullableText(value.endpointUrl, 'endpointUrl', '跳转链接', 1000);
  if (!endpoint.ok) return endpoint;
  if (!endpoint.value) {
    return { ok: false, field: 'endpointUrl', message: '请填写跳转链接。' };
  }

  try {
    const parsed = new URL(endpoint.value);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return {
        ok: false,
        field: 'endpointUrl',
        message: '跳转链接必须使用 HTTP 或 HTTPS。',
      };
    }
  } catch {
    return { ok: false, field: 'endpointUrl', message: '跳转链接格式无效。' };
  }

  return {
    ok: true,
    value: {
      name: name.value,
      endpointUrl: endpoint.value,
      customerServiceConnectionId: null,
      remoteGroupId: null,
      remoteGroupName: null,
      sortOrder: sortOrder.value,
      isEnabled: value.isEnabled,
    },
  };
}

function mapGroup(row: ConversionGroupRow): ConversionGroupRecord {
  return {
    id: row.id,
    sectionId: row.section_id,
    name: row.name,
    mode: row.mode,
    buttonLabel: row.button_label,
    rotationStrategy: row.rotation_strategy,
    sortOrder: row.sort_order,
    isEnabled: row.is_enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    targetCount: row.target_count,
    activeTargetCount: row.active_target_count,
    productCount: row.product_count,
    customerServiceConnectionId: row.customer_service_connection_id,
    customerServiceConnectionName: row.customer_service_connection_name,
    remoteGroupId: row.remote_group_id,
    remoteGroupName: row.remote_group_name,
  };
}

function mapTarget(row: ConversionTargetRow): ConversionTargetRecord {
  const bindingKind: ConversionTargetBindingKind =
    row.group_mode === 'link'
      ? 'link'
      : row.customer_service_connection_id && row.remote_group_id
        ? 'customer_service'
        : 'legacy_customer_service';

  return {
    id: row.id,
    sectionId: row.section_id,
    groupId: row.group_id,
    name: row.name,
    bindingKind,
    endpointUrl: row.endpoint_url,
    customerServiceConnectionId: row.customer_service_connection_id,
    customerServiceConnectionName: row.customer_service_connection_name,
    remoteGroupId: row.remote_group_id,
    remoteGroupName: row.remote_group_name,
    sortOrder: row.sort_order,
    isEnabled: row.is_enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

const GROUP_SELECT = `SELECT
  g.id,
  g.section_id,
  g.name,
  g.mode,
  g.button_label,
  g.rotation_strategy,
  g.sort_order,
  g.is_enabled,
  g.created_at,
  g.updated_at,
  g.deleted_at,
  CASE WHEN g.mode = 'link' THEN (
    SELECT COUNT(*) FROM conversion_targets t
    WHERE t.group_id = g.id AND t.deleted_at IS NULL
  ) ELSE 0 END AS target_count,
  CASE WHEN g.mode = 'customer_service' THEN
    CASE WHEN
      g.customer_service_connection_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM customer_service_connections c2
        WHERE c2.id = g.customer_service_connection_id
          AND c2.deleted_at IS NULL
          AND c2.is_enabled = 1
          AND c2.client_api_url IS NOT NULL
          AND c2.realtime_url IS NOT NULL
          AND c2.verified_at IS NOT NULL
      )
    THEN 1 ELSE 0 END
  ELSE (
    SELECT COUNT(*) FROM conversion_targets t
    WHERE t.group_id = g.id
      AND t.deleted_at IS NULL
      AND t.is_enabled = 1
      AND t.endpoint_url IS NOT NULL
  ) END AS active_target_count,
  (SELECT COUNT(*) FROM products p
    WHERE p.conversion_group_id = g.id) AS product_count,
  g.customer_service_connection_id,
  c.name AS customer_service_connection_name,
  g.remote_group_id,
  g.remote_group_name
FROM conversion_groups g
LEFT JOIN customer_service_connections c
  ON c.id = g.customer_service_connection_id`;

const TARGET_SELECT = `SELECT
  t.id,
  t.section_id,
  t.group_id,
  g.mode AS group_mode,
  t.name,
  t.endpoint_url,
  t.customer_service_connection_id,
  c.name AS customer_service_connection_name,
  t.remote_group_id,
  t.remote_group_name,
  t.sort_order,
  t.is_enabled,
  t.created_at,
  t.updated_at,
  t.deleted_at
FROM conversion_targets t
JOIN conversion_groups g ON g.id = t.group_id
LEFT JOIN customer_service_connections c
  ON c.id = t.customer_service_connection_id`;

export async function listConversionGroups(
  db: D1Database,
  sectionId: string,
  scope: ConversionScope,
): Promise<ConversionGroupRecord[]> {
  const scopeClause =
    scope === 'active'
      ? 'AND g.deleted_at IS NULL'
      : scope === 'trash'
        ? 'AND g.deleted_at IS NOT NULL'
        : '';
  const result = await db
    .prepare(
      `${GROUP_SELECT}
       WHERE g.section_id = ? ${scopeClause}
       ORDER BY g.sort_order ASC, g.name COLLATE NOCASE ASC`,
    )
    .bind(sectionId)
    .all<ConversionGroupRow>();
  return result.results.map(mapGroup);
}

export async function getConversionGroup(
  db: D1Database,
  sectionId: string,
  groupId: string,
): Promise<ConversionGroupRecord | null> {
  const row = await db
    .prepare(`${GROUP_SELECT} WHERE g.section_id = ? AND g.id = ?`)
    .bind(sectionId, groupId)
    .first<ConversionGroupRow>();
  return row ? mapGroup(row) : null;
}

export function createConversionGroup(
  db: D1Database,
  sectionId: string,
  input: ConversionGroupInput,
  now: string,
): { group: ConversionGroupRecord; statement: D1PreparedStatement } {
  const group: ConversionGroupRecord = {
    id: crypto.randomUUID(),
    sectionId,
    name: input.name,
    mode: input.mode,
    buttonLabel: input.buttonLabel,
    rotationStrategy: 'round_robin',
    sortOrder: input.sortOrder,
    isEnabled: input.isEnabled,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    targetCount: 0,
    activeTargetCount: 0,
    productCount: 0,
    customerServiceConnectionId: input.customerServiceConnectionId,
    customerServiceConnectionName: null,
    remoteGroupId: input.remoteGroupId,
    remoteGroupName: input.remoteGroupName,
  };

  return {
    group,
    statement: db
      .prepare(
        `INSERT INTO conversion_groups (
           id, section_id, name, mode, button_label, rotation_strategy,
           sort_order, is_enabled, customer_service_connection_id,
           remote_group_id, remote_group_name,
           created_at, updated_at, deleted_at
         ) VALUES (?, ?, ?, ?, ?, 'round_robin', ?, ?, ?, ?, ?, ?, ?, NULL)`,
      )
      .bind(
        group.id,
        group.sectionId,
        group.name,
        group.mode,
        group.buttonLabel,
        group.sortOrder,
        group.isEnabled ? 1 : 0,
        group.customerServiceConnectionId,
        group.remoteGroupId,
        group.remoteGroupName,
        group.createdAt,
        group.updatedAt,
      ),
  };
}

export function createUpdateConversionGroupStatement(
  db: D1Database,
  sectionId: string,
  groupId: string,
  input: ConversionGroupInput,
  now: string,
): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE conversion_groups
       SET name = ?, mode = ?, button_label = ?, sort_order = ?, is_enabled = ?,
           customer_service_connection_id = ?, remote_group_id = ?,
           remote_group_name = ?, updated_at = ?
       WHERE section_id = ? AND id = ? AND deleted_at IS NULL`,
    )
    .bind(
      input.name,
      input.mode,
      input.buttonLabel,
      input.sortOrder,
      input.isEnabled ? 1 : 0,
      input.customerServiceConnectionId,
      input.remoteGroupId,
      input.remoteGroupName,
      now,
      sectionId,
      groupId,
    );
}

export function createDeleteConversionGroupStatement(
  db: D1Database,
  sectionId: string,
  groupId: string,
  now: string,
): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE conversion_groups
       SET is_enabled = 0, deleted_at = ?, updated_at = ?
       WHERE section_id = ? AND id = ? AND deleted_at IS NULL`,
    )
    .bind(now, now, sectionId, groupId);
}

export function createRestoreConversionGroupStatement(
  db: D1Database,
  sectionId: string,
  groupId: string,
  now: string,
): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE conversion_groups
       SET deleted_at = NULL, updated_at = ?
       WHERE section_id = ? AND id = ? AND deleted_at IS NOT NULL`,
    )
    .bind(now, sectionId, groupId);
}

export function createReorderConversionGroupStatement(
  db: D1Database,
  sectionId: string,
  groupId: string,
  sortOrder: number,
  now: string,
): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE conversion_groups
       SET sort_order = ?, updated_at = ?
       WHERE section_id = ? AND id = ? AND deleted_at IS NULL`,
    )
    .bind(sortOrder, now, sectionId, groupId);
}

export async function listConversionTargets(
  db: D1Database,
  sectionId: string,
  groupId: string,
  scope: ConversionScope,
): Promise<ConversionTargetRecord[]> {
  const scopeClause =
    scope === 'active'
      ? 'AND t.deleted_at IS NULL'
      : scope === 'trash'
        ? 'AND t.deleted_at IS NOT NULL'
        : '';
  const result = await db
    .prepare(
      `${TARGET_SELECT}
       WHERE t.section_id = ? AND t.group_id = ? ${scopeClause}
       ORDER BY t.sort_order ASC, t.name COLLATE NOCASE ASC`,
    )
    .bind(sectionId, groupId)
    .all<ConversionTargetRow>();
  return result.results.map(mapTarget);
}

export async function getConversionTarget(
  db: D1Database,
  sectionId: string,
  groupId: string,
  targetId: string,
): Promise<ConversionTargetRecord | null> {
  const row = await db
    .prepare(
      `${TARGET_SELECT}
       WHERE t.section_id = ? AND t.group_id = ? AND t.id = ?`,
    )
    .bind(sectionId, groupId, targetId)
    .first<ConversionTargetRow>();
  return row ? mapTarget(row) : null;
}

export function createConversionTarget(
  db: D1Database,
  sectionId: string,
  groupId: string,
  input: ConversionTargetInput,
  now: string,
): { target: ConversionTargetRecord; statement: D1PreparedStatement } {
  const target: ConversionTargetRecord = {
    id: crypto.randomUUID(),
    sectionId,
    groupId,
    name: input.name,
    bindingKind: input.customerServiceConnectionId ? 'customer_service' : 'link',
    endpointUrl: input.endpointUrl,
    customerServiceConnectionId: input.customerServiceConnectionId,
    customerServiceConnectionName: null,
    remoteGroupId: input.remoteGroupId,
    remoteGroupName: input.remoteGroupName,
    sortOrder: input.sortOrder,
    isEnabled: input.isEnabled,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  return {
    target,
    statement: db
      .prepare(
        `INSERT INTO conversion_targets (
           id, section_id, group_id, name, endpoint_url,
           customer_service_connection_id, remote_group_id, remote_group_name,
           legacy_project_id, legacy_config_json,
           sort_order, is_enabled, created_at, updated_at, deleted_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, NULL)`,
      )
      .bind(
        target.id,
        target.sectionId,
        target.groupId,
        target.name,
        target.endpointUrl,
        target.customerServiceConnectionId,
        target.remoteGroupId,
        target.remoteGroupName,
        target.sortOrder,
        target.isEnabled ? 1 : 0,
        target.createdAt,
        target.updatedAt,
      ),
  };
}

export function createUpdateConversionTargetStatement(
  db: D1Database,
  sectionId: string,
  groupId: string,
  targetId: string,
  input: ConversionTargetInput,
  now: string,
): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE conversion_targets
       SET name = ?, endpoint_url = ?, customer_service_connection_id = ?,
           remote_group_id = ?, remote_group_name = ?,
           legacy_project_id = NULL, legacy_config_json = NULL,
           sort_order = ?, is_enabled = ?, updated_at = ?
       WHERE section_id = ? AND group_id = ? AND id = ? AND deleted_at IS NULL`,
    )
    .bind(
      input.name,
      input.endpointUrl,
      input.customerServiceConnectionId,
      input.remoteGroupId,
      input.remoteGroupName,
      input.sortOrder,
      input.isEnabled ? 1 : 0,
      now,
      sectionId,
      groupId,
      targetId,
    );
}

export function createDeleteConversionTargetStatement(
  db: D1Database,
  sectionId: string,
  groupId: string,
  targetId: string,
  now: string,
): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE conversion_targets
       SET is_enabled = 0, deleted_at = ?, updated_at = ?
       WHERE section_id = ? AND group_id = ? AND id = ? AND deleted_at IS NULL`,
    )
    .bind(now, now, sectionId, groupId, targetId);
}

export function createRestoreConversionTargetStatement(
  db: D1Database,
  sectionId: string,
  groupId: string,
  targetId: string,
  now: string,
): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE conversion_targets
       SET deleted_at = NULL, updated_at = ?
       WHERE section_id = ? AND group_id = ? AND id = ? AND deleted_at IS NOT NULL`,
    )
    .bind(now, sectionId, groupId, targetId);
}

export function createReorderConversionTargetStatement(
  db: D1Database,
  sectionId: string,
  groupId: string,
  targetId: string,
  sortOrder: number,
  now: string,
): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE conversion_targets
       SET sort_order = ?, updated_at = ?
       WHERE section_id = ? AND group_id = ? AND id = ? AND deleted_at IS NULL`,
    )
    .bind(sortOrder, now, sectionId, groupId, targetId);
}

export async function selectNextConversionTarget(
  db: D1Database,
  group: ConversionGroupRecord,
  now: string,
): Promise<ConversionTargetRecord | null> {
  if (
    group.mode !== 'link' ||
    !group.isEnabled ||
    group.deletedAt ||
    group.activeTargetCount === 0
  ) {
    return null;
  }

  const rotation = await db
    .prepare(
      `INSERT INTO conversion_group_rotation (group_id, next_index, updated_at)
       VALUES (?, 1, ?)
       ON CONFLICT(group_id) DO UPDATE SET
         next_index = conversion_group_rotation.next_index + 1,
         updated_at = excluded.updated_at
       RETURNING next_index - 1 AS selected_index`,
    )
    .bind(group.id, now)
    .first<RotationRow>();
  if (!rotation) return null;

  const offset = rotation.selected_index % group.activeTargetCount;
  const row = await db
    .prepare(
      `${TARGET_SELECT}
       WHERE t.section_id = ? AND t.group_id = ?
         AND t.deleted_at IS NULL AND t.is_enabled = 1
         AND t.endpoint_url IS NOT NULL
       ORDER BY t.sort_order ASC, t.name COLLATE NOCASE ASC
       LIMIT 1 OFFSET ?`,
    )
    .bind(group.sectionId, group.id, offset)
    .first<ConversionTargetRow>();
  return row ? mapTarget(row) : null;
}

export function hasGroupDeleteBlocker(group: ConversionGroupRecord): boolean {
  return group.productCount > 0 || (group.mode === 'link' && group.targetCount > 0);
}

export function isConversionGroupConflictError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes('conversion_groups_active_name_unique') ||
      error.message.includes('UNIQUE constraint failed: conversion_groups.section_id'))
  );
}

export function isConversionTargetConflictError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes('conversion_targets_active_name_unique') ||
      error.message.includes('UNIQUE constraint failed: conversion_targets.group_id'))
  );
}
