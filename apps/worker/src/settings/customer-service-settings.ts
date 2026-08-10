export type CustomerServiceSettings = {
  isEnabled: boolean;
  provider: string | null;
  endpointUrl: string | null;
  projectId: string | null;
  config: string | null;
  updatedAt: string;
};

export type CustomerServiceSettingsInput = Omit<CustomerServiceSettings, 'updatedAt'>;

type CustomerServiceSettingsRow = {
  is_enabled: number;
  provider: string | null;
  endpoint_url: string | null;
  project_id: string | null;
  config_json: string | null;
  updated_at: string;
};

type ValidationResult =
  | { ok: true; value: CustomerServiceSettingsInput }
  | { ok: false; field: string; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readOptionalString(value: unknown, field: string, maxLength: number) {
  if (value === null || value === undefined || value === '') {
    return { ok: true as const, value: null };
  }
  if (typeof value !== 'string') {
    return { ok: false as const, field, message: '必须填写文本。' };
  }
  const normalized = value.trim();
  if (!normalized) {
    return { ok: true as const, value: null };
  }
  if (normalized.length > maxLength) {
    return { ok: false as const, field, message: `不能超过 ${maxLength} 个字符。` };
  }
  return { ok: true as const, value: normalized };
}

function readEndpoint(value: unknown) {
  const endpoint = readOptionalString(value, 'endpointUrl', 500);
  if (!endpoint.ok || endpoint.value === null) {
    return endpoint;
  }

  try {
    const url = new URL(endpoint.value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error('INVALID_PROTOCOL');
    }
    return { ok: true as const, value: url.toString() };
  } catch {
    return {
      ok: false as const,
      field: 'endpointUrl',
      message: '客服系统地址必须是有效的 HTTP 或 HTTPS URL。',
    };
  }
}

export function validateCustomerServiceSettingsInput(value: unknown): ValidationResult {
  if (!isRecord(value)) {
    return { ok: false, field: 'form', message: '客服设置数据无效。' };
  }
  if (typeof value.isEnabled !== 'boolean') {
    return { ok: false, field: 'isEnabled', message: '必须选择启用或停用。' };
  }

  const provider = readOptionalString(value.provider, 'provider', 120);
  if (!provider.ok) return provider;
  const endpointUrl = readEndpoint(value.endpointUrl);
  if (!endpointUrl.ok) return endpointUrl;
  const projectId = readOptionalString(value.projectId, 'projectId', 200);
  if (!projectId.ok) return projectId;
  const config = readOptionalString(value.config, 'config', 8000);
  if (!config.ok) return config;

  if (config.value !== null) {
    try {
      JSON.parse(config.value);
    } catch {
      return { ok: false, field: 'config', message: '客服扩展配置必须是有效 JSON。' };
    }
  }

  if (value.isEnabled && endpointUrl.value === null) {
    return {
      ok: false,
      field: 'endpointUrl',
      message: '启用客服时必须填写客服系统地址。',
    };
  }

  return {
    ok: true,
    value: {
      isEnabled: value.isEnabled,
      provider: provider.value,
      endpointUrl: endpointUrl.value,
      projectId: projectId.value,
      config: config.value,
    },
  };
}

function fromRow(row: CustomerServiceSettingsRow): CustomerServiceSettings {
  return {
    isEnabled: row.is_enabled === 1,
    provider: row.provider,
    endpointUrl: row.endpoint_url,
    projectId: row.project_id,
    config: row.config_json,
    updatedAt: row.updated_at,
  };
}

export async function getCustomerServiceSettings(
  db: D1Database,
): Promise<CustomerServiceSettings> {
  const row = await db
    .prepare(
      `SELECT is_enabled, provider, endpoint_url, project_id, config_json, updated_at
       FROM customer_service_settings
       WHERE id = 1`,
    )
    .first<CustomerServiceSettingsRow>();

  if (!row) {
    throw new Error('CUSTOMER_SERVICE_SETTINGS_MISSING');
  }
  return fromRow(row);
}

export function createUpdateCustomerServiceSettingsStatement(
  db: D1Database,
  input: CustomerServiceSettingsInput,
  updatedAt: string,
): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE customer_service_settings
       SET is_enabled = ?,
           provider = ?,
           endpoint_url = ?,
           project_id = ?,
           config_json = ?,
           updated_at = ?
       WHERE id = 1`,
    )
    .bind(
      input.isEnabled ? 1 : 0,
      input.provider,
      input.endpointUrl,
      input.projectId,
      input.config,
      updatedAt,
    );
}

export function toCustomerServiceSettings(
  input: CustomerServiceSettingsInput,
  updatedAt: string,
): CustomerServiceSettings {
  return { ...input, updatedAt };
}
