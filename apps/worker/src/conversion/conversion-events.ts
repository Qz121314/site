import type { ConversionMode } from '../conversion-pool/conversion-pool';

export type ConversionEventOutcome = 'redirected' | 'provider_error' | 'not_ready';

export type ConversionEventInput = {
  sectionId: string;
  productId: string;
  conversionGroupId: string | null;
  conversionTargetId: string | null;
  mode: ConversionMode | null;
  outcome: ConversionEventOutcome;
  requestId: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
};

export function createConversionEventStatement(
  db: D1Database,
  input: ConversionEventInput,
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO conversion_events (
         id,
         section_id,
         product_id,
         conversion_group_id,
         conversion_target_id,
         legacy_conversion_method_id,
         mode,
         event_type,
         outcome,
         request_id,
         metadata_json,
         created_at
       ) VALUES (?, ?, ?, ?, ?, NULL, ?, 'click', ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      input.sectionId,
      input.productId,
      input.conversionGroupId,
      input.conversionTargetId,
      input.mode,
      input.outcome,
      input.requestId,
      input.metadata ? JSON.stringify(input.metadata) : null,
      input.createdAt,
    );
}

export async function recordConversionEvent(
  db: D1Database,
  input: ConversionEventInput,
): Promise<void> {
  await createConversionEventStatement(db, input).run();
}
