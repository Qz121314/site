# Formatting and commit gates

The repository configuration files are the only source of truth for concrete formatting/lint values:

- `.editorconfig`
- `prettier.config.mjs`
- `eslint.config.mjs`

Do not copy quote, semicolon, trailing-comma, width, or similar values into `AGENTS.md` or prose documentation.

Use the repository-installed tools rather than hand-guessing output:

```bash
pnpm fix:changed
pnpm format
pnpm lint
```

`pnpm fix:changed` formats changed/untracked files and applies safe ESLint fixes to changed JavaScript/TypeScript files. Review the result before staging.

The repository-owned `.githooks/pre-commit` runs `pnpm precommit:check`. That gate reads the staged Git blob for each staged text source and verifies staged Prettier/ESLint results. It does not run typecheck, tests, builds, Cloudflare commands, or network operations.

`prepare` installs `.githooks` through `scripts/setup-git-hooks.mjs`. CI/archive environments without `.git` must not fail merely because hooks cannot be installed or inspected.
