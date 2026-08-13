import type { RemoteCustomerServiceGroup } from './customer-service-provider';

type VerifiedGroupRow = {
  remote_group_id: string;
  remote_group_name: string;
  is_enabled: number;
};

export function createReplaceVerifiedCustomerServiceGroupsStatements(
  db: D1Database,
  connectionId: string,
  groups: RemoteCustomerServiceGroup[],
  verifiedAt: string,
): D1PreparedStatement[] {
  const statements: D1PreparedStatement[] = [
    db
      .prepare('DELETE FROM customer_service_verified_groups WHERE connection_id = ?')
      .bind(connectionId),
  ];
  for (const group of groups) {
    statements.push(
      db
        .prepare(
          `INSERT INTO customer_service_verified_groups (
             connection_id, remote_group_id, remote_group_name, is_enabled, verified_at
           ) VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(connectionId, group.id, group.name, group.isEnabled ? 1 : 0, verifiedAt),
    );
  }
  return statements;
}

export async function listVerifiedCustomerServiceGroups(
  db: D1Database,
  connectionId: string,
): Promise<RemoteCustomerServiceGroup[]> {
  const rows = (
    await db
      .prepare(
        `SELECT remote_group_id, remote_group_name, is_enabled
         FROM customer_service_verified_groups
         WHERE connection_id = ?
         ORDER BY remote_group_name COLLATE NOCASE ASC, remote_group_id ASC`,
      )
      .bind(connectionId)
      .all<VerifiedGroupRow>()
  ).results;
  return rows.map((row) => ({
    id: row.remote_group_id,
    name: row.remote_group_name,
    isEnabled: row.is_enabled === 1,
  }));
}
