type AuditMetadata = Record<string, string | number | boolean | null>;

type WriteAuditLogInput = {
  action: string;
  entityType: string;
  entityId?: string;
  requestId: string;
  metadata?: AuditMetadata;
};

export async function writeAuditLog(
  db: D1Database,
  input: WriteAuditLogInput,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO audit_logs (
         id,
         actor,
         action,
         entity_type,
         entity_id,
         request_id,
         metadata_json,
         created_at
       ) VALUES (?, 'single_admin', ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      input.action,
      input.entityType,
      input.entityId ?? null,
      input.requestId,
      input.metadata ? JSON.stringify(input.metadata) : null,
      new Date().toISOString(),
    )
    .run();
}
