export type AiSettings = {
  isEnabled: boolean;
  allowGuest: boolean;
  model: string;
  systemPrompt: string;
  dailyRequestLimit: number;
  perVisitorDailyLimit: number;
  maxInputCharacters: number;
  maxOutputTokens: number;
  temperature: number;
  updatedAt: string;
};

export type AiSettingsInput = Omit<AiSettings, 'updatedAt'>;

type AiSettingsRow = {
  is_enabled: number;
  allow_guest: number;
  model: string;
  system_prompt: string;
  daily_request_limit: number;
  per_visitor_daily_limit: number;
  max_input_characters: number;
  max_output_tokens: number;
  temperature: number;
  updated_at: string;
};

type ValidationResult =
  | { ok: true; value: AiSettingsInput }
  | { ok: false; field: string; message: string };

export type AiRunner = {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readText(
  value: unknown,
  field: string,
  label: string,
  minLength: number,
  maxLength: number,
) {
  if (typeof value !== 'string') {
    return { ok: false as const, field, message: `${label}必须是文本。` };
  }
  const normalized = value.trim();
  if (normalized.length < minLength) {
    return { ok: false as const, field, message: `${label}不能为空。` };
  }
  if (normalized.length > maxLength) {
    return { ok: false as const, field, message: `${label}不能超过 ${maxLength} 个字符。` };
  }
  return { ok: true as const, value: normalized };
}

function readInteger(
  value: unknown,
  field: string,
  label: string,
  minimum: number,
  maximum: number,
) {
  if (!Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    return {
      ok: false as const,
      field,
      message: `${label}必须是 ${minimum} 到 ${maximum} 之间的整数。`,
    };
  }
  return { ok: true as const, value: value as number };
}

function readTemperature(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 2) {
    return {
      ok: false as const,
      field: 'temperature',
      message: '生成温度必须是 0 到 2 之间的数字。',
    };
  }
  return { ok: true as const, value: Math.round(value * 100) / 100 };
}

export function validateAiSettingsInput(value: unknown): ValidationResult {
  if (!isRecord(value)) {
    return { ok: false, field: 'form', message: 'AI 设置数据无效。' };
  }
  if (typeof value.isEnabled !== 'boolean') {
    return { ok: false, field: 'isEnabled', message: '必须选择启用或停用 AI。' };
  }
  if (typeof value.allowGuest !== 'boolean') {
    return { ok: false, field: 'allowGuest', message: '必须选择是否允许访客使用。' };
  }

  const model = readText(value.model, 'model', '模型标识', 1, 200);
  if (!model.ok) return model;
  if (!model.value.startsWith('@cf/')) {
    return {
      ok: false,
      field: 'model',
      message: '当前只允许使用以 @cf/ 开头的 Workers AI 模型。',
    };
  }

  const systemPrompt = readText(value.systemPrompt, 'systemPrompt', '系统提示词', 1, 4000);
  if (!systemPrompt.ok) return systemPrompt;
  const dailyRequestLimit = readInteger(
    value.dailyRequestLimit,
    'dailyRequestLimit',
    '全站每日额度',
    1,
    100000,
  );
  if (!dailyRequestLimit.ok) return dailyRequestLimit;
  const perVisitorDailyLimit = readInteger(
    value.perVisitorDailyLimit,
    'perVisitorDailyLimit',
    '单访客每日额度',
    1,
    1000,
  );
  if (!perVisitorDailyLimit.ok) return perVisitorDailyLimit;
  if (perVisitorDailyLimit.value > dailyRequestLimit.value) {
    return {
      ok: false,
      field: 'perVisitorDailyLimit',
      message: '单访客每日额度不能超过全站每日额度。',
    };
  }

  const maxInputCharacters = readInteger(
    value.maxInputCharacters,
    'maxInputCharacters',
    '单次输入字符上限',
    100,
    12000,
  );
  if (!maxInputCharacters.ok) return maxInputCharacters;
  const maxOutputTokens = readInteger(
    value.maxOutputTokens,
    'maxOutputTokens',
    '单次输出 Token 上限',
    64,
    4096,
  );
  if (!maxOutputTokens.ok) return maxOutputTokens;
  const temperature = readTemperature(value.temperature);
  if (!temperature.ok) return temperature;

  return {
    ok: true,
    value: {
      isEnabled: value.isEnabled,
      allowGuest: value.allowGuest,
      model: model.value,
      systemPrompt: systemPrompt.value,
      dailyRequestLimit: dailyRequestLimit.value,
      perVisitorDailyLimit: perVisitorDailyLimit.value,
      maxInputCharacters: maxInputCharacters.value,
      maxOutputTokens: maxOutputTokens.value,
      temperature: temperature.value,
    },
  };
}

function fromRow(row: AiSettingsRow): AiSettings {
  return {
    isEnabled: row.is_enabled === 1,
    allowGuest: row.allow_guest === 1,
    model: row.model,
    systemPrompt: row.system_prompt,
    dailyRequestLimit: row.daily_request_limit,
    perVisitorDailyLimit: row.per_visitor_daily_limit,
    maxInputCharacters: row.max_input_characters,
    maxOutputTokens: row.max_output_tokens,
    temperature: row.temperature,
    updatedAt: row.updated_at,
  };
}

export async function getAiSettings(db: D1Database): Promise<AiSettings> {
  const row = await db
    .prepare(
      `SELECT is_enabled,
              allow_guest,
              model,
              system_prompt,
              daily_request_limit,
              per_visitor_daily_limit,
              max_input_characters,
              max_output_tokens,
              temperature,
              updated_at
       FROM ai_settings
       WHERE id = 1`,
    )
    .first<AiSettingsRow>();

  if (!row) throw new Error('AI_SETTINGS_MISSING');
  return fromRow(row);
}

export function createUpdateAiSettingsStatement(
  db: D1Database,
  input: AiSettingsInput,
  updatedAt: string,
): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE ai_settings
       SET is_enabled = ?,
           allow_guest = ?,
           model = ?,
           system_prompt = ?,
           daily_request_limit = ?,
           per_visitor_daily_limit = ?,
           max_input_characters = ?,
           max_output_tokens = ?,
           temperature = ?,
           updated_at = ?
       WHERE id = 1`,
    )
    .bind(
      input.isEnabled ? 1 : 0,
      input.allowGuest ? 1 : 0,
      input.model,
      input.systemPrompt,
      input.dailyRequestLimit,
      input.perVisitorDailyLimit,
      input.maxInputCharacters,
      input.maxOutputTokens,
      input.temperature,
      updatedAt,
    );
}

export function toAiSettings(input: AiSettingsInput, updatedAt: string): AiSettings {
  return { ...input, updatedAt };
}

function readChoiceText(value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const first = value[0];
  if (!isRecord(first)) return null;
  if (typeof first.text === 'string') return first.text;
  const message = isRecord(first.message) ? first.message : null;
  return message && typeof message.content === 'string' ? message.content : null;
}

export function extractAiText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (!isRecord(value)) throw new Error('AI_INVALID_RESPONSE');

  const direct = [value.response, value.result, value.text].find(
    (item): item is string => typeof item === 'string',
  );
  const text = direct ?? readChoiceText(value.choices);
  if (!text?.trim()) throw new Error('AI_EMPTY_RESPONSE');
  return text.trim();
}

export async function runAiText(
  ai: AiRunner,
  settings: AiSettings,
  prompt: string,
): Promise<string> {
  const output = await ai.run(settings.model, {
    messages: [
      { role: 'system', content: settings.systemPrompt },
      { role: 'user', content: prompt },
    ],
    max_tokens: settings.maxOutputTokens,
    temperature: settings.temperature,
  });
  return extractAiText(output);
}
