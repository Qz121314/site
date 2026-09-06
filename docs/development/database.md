# Database development and release contract

D1 schema remains migration-owned. This document changes CI release behavior only; it does not redesign the schema or runtime query architecture.

## Development and PR

- Schema evolution lives only under `migrations/*.sql`.
- Every PR that exercises the complete repository gate applies all migrations to local D1 with `pnpm db:migrate:local`.
- PR workflows must never pass `--remote` to Wrangler D1 commands.
- Production D1 is not a test fixture.

## Main release

The release classifier owns authorization for production migration actions.

When `migration_changed=false`, skip all migration-specific remote D1 work, including:

- D1 Time Travel recovery bookmark reads;
- remote migration status/apply;
- post-migration probes that exist only for migration safety.

When `migration_changed=true`, preserve the safety order:

```text
local migration validation
→ production recovery bookmark
→ remote migration apply
→ only the minimum necessary post-check
```

A migration diff is considered deploy-impacting so the normal release can deploy the matching Worker/static bundle after migration safety succeeds.

## Read budget

Release-time production D1 reads must be bounded metadata queries required by the release branch. Broad business-table scans, reporting/statistics queries, and full integrity scans do not belong in deployment CI.
