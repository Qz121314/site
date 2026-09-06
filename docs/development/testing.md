# Testing contract

Validation strength follows the S/M/L levels in `AGENTS.md`. CI is the final verification surface, not the first formatter or contract checker.

## Local-first checks

PR-facing checks may use:

- repository guardrails;
- Prettier and ESLint;
- Wrangler-generated local types;
- TypeScript typecheck;
- local D1 migration application;
- unit/integration tests;
- production builds;
- `wrangler deploy --dry-run`;
- local Playwright servers for affected Storefront behavior.

They must not use production D1, production R2 management APIs, or production Worker deployment.

## Targeted validation

During implementation, run the test owner closest to the changed contract. Do not wait for the full PR workflow to discover a formatting, lint, type, or narrow behavior failure that can be reproduced locally.

## Final L-level validation

Use:

```bash
pnpm verify
```

CI-contract tests under `tests/ci/` protect the development contract, classifier, release gating, cache setup, and build-reuse rules. They are part of `pnpm test`.

## Production acceptance

Production HTTP/browser acceptance is release validation, not a PR test database. Minimal smoke runs only after an actual Worker deploy. Deep HTTP and browser acceptance are additionally gated by the risk classification of the release diff.
