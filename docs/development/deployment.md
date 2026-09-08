# Deployment contract

## Verification profiles

The `main` workflow classifies the exact release diff before choosing validation depth. Full verification is reserved for changes that can alter the deployed Worker, application assets, schema, build output or release inputs.

| Change class                                           | Verification                              | Production action                                                       |
| ------------------------------------------------------ | ----------------------------------------- | ----------------------------------------------------------------------- |
| Worker/app/shared/config/migration/build/release input | `pnpm verify`                             | Deploy when `deploy_required=true`; run classified smoke/browser checks |
| R2 or infrastructure validation only                   | Quality checks plus gated R2/infra checks | No Worker deploy unless separately classified                           |
| Tests only                                             | Guardrails plus repository tests          | No deploy or production resource access                                 |
| Development tooling/repository contract                | Guardrails, format, lint, typecheck       | No deploy or production resource access                                 |
| Docs only                                              | Guardrails and format                     | No deploy or production resource access                                 |

Manual release overrides may deliberately widen the production gates. They must not be used as a substitute for classifying a new release-impacting path.

`main` release is orchestrated by `.github/workflows/ci.yml` after the complete local-first verification gate succeeds.

## Deployment command separation

`pnpm deploy:worker` builds and deploys the Worker/static bundle. It does not apply remote D1 migrations. The compatibility `pnpm deploy` alias delegates to `deploy:worker` and therefore also does not migrate production D1.

Remote D1 migration remains the explicit `pnpm db:migrate:remote` command and is invoked by CI only when the classifier authorizes the migration branch.

Inside CI, `pnpm verify` has already produced the build output. The deployment step invokes Wrangler directly rather than re-running `pnpm build`, so the workflow builds once and reuses the result.

Wrangler types are generated through `scripts/ensure-wrangler-types.mjs`. The helper hashes the Wrangler/package/lockfile inputs and reuses the generated declaration within one workspace when the inputs have not changed; a fresh workspace still generates from source before use.

## Release decision

```text
classify diff
→ select verification profile
→ run profile-owned local checks
→ migration branch only if migration changed
→ R2 branch only if R2 config changed
→ deploy only if deploy_required
→ bounded minimal smoke only after deploy
→ deep HTTP/browser acceptance only for relevant risk classes
```

## Minimal smoke

`scripts/production-smoke.mjs` confirms:

- production health and exact deployed Worker Version ID with bounded backoff;
- Storefront app shell availability;
- readable current publication pointer.

It intentionally does not repeat R2 infrastructure checks or scan D1.

## Deep acceptance

`scripts/production-deep-smoke.mjs` protects public/security/runtime contracts when the classifier marks the release as deep-smoke relevant. Playwright production acceptance runs only after an actual deploy and only when Storefront/public runtime/production browser contracts are relevant (or an operator explicitly forces Cloudflare validation).

## Cache policy

GitHub Actions caches the pnpm store from `pnpm-lock.yaml`, not `node_modules`. Playwright retains its separate Chromium cache. Generated caches never contain secrets or production query results and are not sources of truth for release classification.
