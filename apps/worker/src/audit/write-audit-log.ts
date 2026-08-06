type AuditJson = Record<string, unknown>;

type WriteAuditLogInput = {
  action: string;
  entityType: string;
  entityId?: string;
  requestId: string;
  before?: AuditJson;
  after?: AuditJson;
  metadata?: AuditJson;
  createdAt?: string;
};

function encodeJson(value: AuditJson | undefined): string | null {
  return value ? JSON.stringify(value) : null;
}

export function createAuditLogStatement(
  db: D1Database,
  input: WriteAuditLogInput,
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO audit_logs (
         id,
         actor,
         action,
         entity_type,
         entity_id,
         request_id,
         before_json,
         after_json,
         metadata_json,
         created_at
       ) VALUES (?, 'single_admin', ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      input.action,
      input.entityType,
      input.entityId ?? null,
      input.requestId,
      encodeJson(input.before),
      encodeJson(input.after),
      encodeJson(input.metadata),
      input.createdAt ?? new Date().toISOString(),
    );
}

export async function writeAuditLog(
  db: D1Database,
  input: WriteAuditLogInput,
): Promise<void> {
  await createAuditLogStatement(db, input).run();
}
