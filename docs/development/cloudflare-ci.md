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

## Classifier

`scripts/classify-cloudflare-changes.mjs` is the repository-owned release classifier. It accepts an explicit Git base/head range, uses `git merge-base`, and writes stable boolean outputs to `$GITHUB_OUTPUT`.

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
```

Shared runtime packages are classified conservatively against every built application they can affect. The classifier reads both versions of `wrangler.jsonc`: Worker fields, `d1_databases`, `r2_buckets`, and `assets` produce separate outputs. Every effective Wrangler configuration change requires a Worker deployment because it changes the deployed configuration; only an R2 binding change adds R2 validation, and a D1 binding change never authorizes a D1 migration. Assets configuration adds public browser/deep acceptance. R2 remote management remains gated by an R2 configuration or R2 binding change.

`package.json` and `pnpm-lock.yaml` are content-classified rather than path-classified. Runtime dependency changes and build/deploy script changes require a deploy. Root development dependencies, non-production scripts, and lockfile changes limited to importer `devDependencies` do not. When source content cannot be inspected, the classifier remains conservative and treats the release input as deploy-impacting.

## Production D1 budget

CI/deploy may read production D1 only when the release action requires it:

- migration safety/release actions for a migration diff (or the dedicated `force_d1_migrations` manual override);
- minimal R2 validation metadata only inside the R2 validation branch.

Do not use production D1 as a PR test database. Do not scan business tables for statistics/integrity during deployment. Do not read `site_settings.media_base_url` on ordinary code deployments merely to construct an R2 probe target.

## R2 budget

`config/r2-public-cors.json` and the repository R2 validation helper are R2 release inputs. Only relevant changes (or an explicit operator override) may run custom-domain checks, `cors set/list`, or direct-media probes. `cors set --force` is never an unconditional main-push action.

## No-op classes

Docs-only, tests-only, repository contract changes, workflow-only changes, and pure development tooling do not independently authorize production D1/R2/deploy/browser work. They still receive their normal CI quality checks.

When validating a no-op release path on `main`, use a commit limited to these classes and inspect the workflow steps, not only the overall conclusion. The expected resource result is D1 skip, R2 skip, Worker deploy skip, smoke skip, and browser acceptance skip.

## Manual override

`workflow_dispatch` exposes explicit `force_deploy`, `force_cloudflare_validation`, and `force_d1_migrations` inputs. The generic validation override cannot apply migrations; that requires the dedicated migration override. Remote actions remain restricted to the `main` ref. Defaults are false.
