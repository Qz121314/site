# Cloudflare CI resource contract

Production Cloudflare resources are release dependencies, not general CI fixtures.

## Hard rules

1. PR validation is local-first and must not access production Cloudflare resources.
2. No migration diff means no production D1 recovery bookmark, migration status/apply, or migration-only D1 read.
3. No R2 configuration diff means no production R2 CORS mutation, custom-domain verification, or direct-media probe.
4. No deploy-impacting diff means no production Worker deployment.
5. Minimal production smoke runs only after an actual deployment and uses bounded requests/retries.
6. Deep production HTTP/browser acceptance is change-classified rather than unconditional.
7. CI does not replace local formatting/lint/type/targeted-test gates.
8. Safety checks are moved to the correct environment and trigger; they are not deleted merely to save CI time.
9. A public Worker runtime change or manual `force_deploy` must prove that the currently published Storefront bootstrap schema is inside the candidate runtime's readable protocol range before deployment.

## Classifier

`scripts/classify-cloudflare-changes.mjs` is the repository-owned release classifier. It accepts an explicit Git base/head range, uses `git merge-base`, and writes stable boolean outputs to `$GITHUB_OUTPUT`.

It also writes the string output `verification_profile`, which controls how much local validation the main release workflow performs:

| Profile      | Use                                                                     | Main validation                                                      |
| ------------ | ----------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `full`       | Worker, app, shared/config, migration, Wrangler, build or release input | `pnpm verify`                                                        |
| `cloudflare` | R2/infrastructure validation without an application deploy              | guardrails, format, lint and typecheck; then gated Cloudflare checks |
| `tests`      | Test-only changes                                                       | guardrails and repository tests                                      |
| `quality`    | Development tooling/repository contract changes                         | guardrails, format, lint and typecheck                               |
| `docs`       | Documentation-only changes                                              | guardrails and format                                                |

This prevents no-op, documentation and test-only pushes from paying the full build, local migration and Worker dry-run cost. A release-impacting classification must remain `full`; the profile is an optimization boundary, not a reason to weaken coverage.

Core outputs include:

```text
migration_changed
worker_changed
storefront_changed
admin_changed
r2_config_changed
wrangler_config_changed
wrangler_worker_config_changed
wrangler_d1_config_changed
wrangler_r2_config_changed
wrangler_assets_config_changed
public_runtime_changed
production_browser_relevant
deploy_required
docs_only
d1_remote_required
r2_validation_required
infra_validation_required
deep_smoke_relevant
verification_profile
```

Shared runtime packages are classified conservatively against every built application they can affect. The classifier reads both versions of `wrangler.jsonc`: Worker fields, `d1_databases`, `r2_buckets`, and `assets` produce separate outputs. Every effective Wrangler configuration change requires a Worker deployment because it changes the deployed configuration; only an R2 binding change adds R2 validation, and a D1 binding change never authorizes a D1 migration. Assets configuration adds public browser/deep acceptance. R2 remote management remains gated by an R2 configuration or R2 binding change.

`package.json` and `pnpm-lock.yaml` are content-classified rather than path-classified. Runtime dependency changes and build/deploy script changes require a deploy. Root development dependencies, non-production scripts, and lockfile changes limited to importer `devDependencies` do not. When source content cannot be inspected, the classifier remains conservative and treats the release input as deploy-impacting.

## Published bootstrap compatibility gate

`apps/worker/src/publishing/storefront-bootstrap-protocol.json` is the single release-owned bootstrap schema range. The publisher writes `currentSchemaVersion`; the runtime may read only the bounded range from `minReadableSchemaVersion` through `currentSchemaVersion`. The range must never exceed N/N-1.

Before a classified `public_runtime_changed` Worker deployment or any manual `force_deploy`, `scripts/check-storefront-bootstrap-compatibility.mjs` performs exactly two read-only production R2 object reads:

1. `public/current.json` to resolve the active pointer version;
2. `public/bootstrap/<pointerVersion>/bootstrap.json` to read its actual schema version.

The deployment is blocked when the active bootstrap schema falls outside the candidate runtime's readable range. This gate does not query D1, does not mutate R2, and does not run in PR validation. Breaking schema rollouts therefore use a bounded overlap: deploy a reader that accepts N-1/N, publish N, then retire N-1 only after production points at N. Additive optional fields/capabilities should not bump the schema.

## Production D1 budget

CI/deploy may read production D1 only when the release action requires it:

- migration safety/release actions for a migration diff (or the dedicated `force_d1_migrations` manual override);
- minimal R2 validation metadata only inside the R2 validation branch.

Do not use production D1 as a PR test database. Do not scan business tables for statistics/integrity during deployment. Do not read `site_settings.media_base_url` on ordinary code deployments merely to construct an R2 probe target.

## R2 budget

`config/r2-public-cors.json` and the repository R2 validation helper are R2 release inputs. Only relevant changes (or an explicit operator override) may run custom-domain checks, `cors set/list`, or direct-media probes. `cors set --force` is never an unconditional main-push action.

The bootstrap compatibility gate is the narrow exception for public runtime releases and manual forced Worker deployments: it is read-only, limited to the two active publication objects described above, and exists to prevent an incompatible Worker from reaching production. It does not authorize any R2 configuration change, media probe, list operation, write, or delete.

## No-op and lightweight verification classes

Docs-only, tests-only, repository contract changes, workflow-only changes, and pure development tooling do not independently authorize production D1/R2/deploy/browser work. They receive the classifier-selected lightweight profile rather than the full `pnpm verify` aggregate. A workflow or classifier change is treated as development tooling for release-resource purposes, but its own contract tests must still protect the classifier and gating rules.

When validating a no-op release path on `main`, use a commit limited to these classes and inspect the workflow steps, not only the overall conclusion. The expected resource result is D1 skip, R2 skip, Worker deploy skip, smoke skip, and browser acceptance skip.

## Manual override

`workflow_dispatch` exposes explicit `force_deploy`, `force_cloudflare_validation`, and `force_d1_migrations` inputs. The generic validation override cannot apply migrations; that requires the dedicated migration override. A manual `force_deploy` still runs the published bootstrap compatibility gate before the Worker can deploy. Remote actions remain restricted to the `main` ref. Defaults are false.
