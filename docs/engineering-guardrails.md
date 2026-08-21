# Engineering Guardrails

The root `AGENTS.md` is the authoritative development contract for this repository.

The fixed rule is simple: recurring failures must be converted into repository-level prerequisites instead of being repaired repeatedly after CI fails.

Current enforcement layers:

```text
AGENTS.md
→ scripts/check-repository-guardrails.mjs
→ pnpm preflight
→ pre-commit
→ pnpm verify
→ pre-push
→ pnpm test / CI
```

For normal development, do not bypass these gates. If a new recurring failure class is discovered, update the contract and add an automated guardrail or stable test whenever the rule can be checked mechanically.
