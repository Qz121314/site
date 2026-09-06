# Development workflow

`AGENTS.md` is the mandatory entry point. This directory explains the operational details without duplicating tool configuration values.

## Required sequence

```text
preflight
→ implement
→ incremental validation
→ commit gate
→ PR CI
→ release
```

Before editing, run:

```bash
pnpm preflight:dev
```

Then classify the change as S, M, or L from `AGENTS.md`, inspect the affected implementation and tests, and keep each logical batch small enough to validate locally.

Before each logical commit candidate:

```bash
pnpm fix:changed
pnpm format
pnpm lint
pnpm typecheck
# run targeted tests for the affected contract
```

The pre-commit hook re-checks the exact staged file contents with Prettier and ESLint. It is intentionally not a full repository verification gate.

For L-level work and every final infrastructure/release candidate:

```bash
pnpm verify
```

`pnpm verify` remains the complete local-first repository gate: guardrails, formatting, lint, typecheck, local D1 migrations, tests, production build, and Worker dry-run.

## PR rule

A PR is eligible for review only when the current PR HEAD has completed the required workflows successfully. A green run for an older SHA is evidence for that older SHA only; never report exact latest-head PASS from stale CI.

PR validation is local-first. It may use local D1 and Worker dry-run, but it must not read or mutate production D1/R2 and must not deploy the production Worker.

## Release rule

Merging to `main` does not imply every Cloudflare operation should run. `scripts/classify-cloudflare-changes.mjs` classifies the release diff and the main workflow gates D1, R2, deployment, minimal smoke, deep smoke, and production browser acceptance from those outputs.

Manual `workflow_dispatch` may explicitly force deployment or Cloudflare validation. The default remains change-aware and no-op-aware.
