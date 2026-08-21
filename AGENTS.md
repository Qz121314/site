# Repository Engineering Contract

This file is a hard prerequisite for every code change in this repository. Read it before editing implementation, tests, CI, migrations, or deployment code.

## Mandatory sequence before editing

1. Read the implementation that will change.
2. Read the existing tests that cover the same behavior, including source-contract tests and production smoke/E2E when relevant.
3. Read the matching README section for already-decided product and architecture rules.
4. Identify the impact surface before writing code: runtime behavior, tests, types, D1 schema/query shape, Worker/R2 request budget, build, and production acceptance.
5. If the intended behavior changes an existing expectation, update that test contract in the same change. Do not leave a stale test to discover after implementation is finished.

The required order for a behavior change is:

```text
confirm the new rule
→ inspect/update the affected test contract
→ identify the owning layer and root cause
→ implement the structural fix
→ format with the repository Prettier version
→ run the complete verification gate
```

Do not use this order:

```text
implement
→ push
→ wait for CI to fail
→ discover old expectations
→ patch the test afterwards
```

## Root-cause-first rule

Do not use patch-style fixes as the default engineering method. A visible symptom must first be traced to its owning layer, state/data flow, route boundary, layout contract, or deployment contract.

Avoid symptom suppression such as stacking override selectors, adding one-off route conditions, duplicating components to escape an ownership problem, or keeping obsolete implementations beside the replacement. If the root cause is structural, fix the structure and remove the superseded code in the same change. When the lesson is reusable, encode it in a repository invariant, guardrail, or stable behavior contract.

## Fixed project invariants

These are defaults unless the user explicitly changes the product rule.

- Storefront is Mobile-first.
- Product browsing uses two columns on mobile and 1:1 product media.
- Storefront business/marketing content comes from admin-published data. Do not add arbitrary hard-coded marketing copy.
- Section search/category/tag filtering runs on already-loaded section data in the browser and must not add Worker or D1 requests per interaction.
- Prefer batch reads, bootstrap reuse, cached/public snapshots, and local filtering over repeated Worker/D1 reads.
- Theme recipe values are runtime/admin configuration. Production smoke tests must not hard-code a specific theme name, font pack, media style, motion style, navigation style, shadow, radius, or other mutable visual value unless that value is an explicit product invariant.
- Storefront App Shell owns persistent chrome: Header, Bottom Navigation, and viewport-fixed route action surfaces. Route pages provide content/action intent but must not mount global fixed UI directly to `document.body`.
- Mobile/browser fixed chrome must align to the live `VisualViewport` when available; do not use UA sniffing, device-model branches, or browser-specific magic offsets for Header, Bottom Navigation, CTA, keyboard, or browser-toolbar clearance.
- Safe Area variables handle physical screen cutouts and home-indicator clearance. Dynamic browser chrome and virtual-keyboard geometry come from the viewport runtime; these responsibilities must not be conflated.
- App Shell content clearance must use measured Header, Bottom Navigation, and Route Action dimensions. Do not duplicate their heights in route CSS formulas such as `CTA height + header constant` or `100dvh - nav constant`.
- Storefront presentation/history runtime owns navigation direction and route transition semantics only. Do not use generic `push`/`pop` presentation selectors to hide or replace App Shell chrome.
- Route transition transforms apply to route content only. Persistent Header and route action surfaces must stay outside the transformed route view so their viewport positioning remains stable.
- Production acceptance tests validate stable behavior and contracts: rendering, runtime configuration application, navigation, overflow, media ratio, CTA availability, auth boundaries, request/data contracts, viewport/chrome ownership, and deployment health. They are not pixel-snapshot substitutes.
- When a UI rule intentionally changes, inspect both the implementation test and any meta/source-contract test that reads the E2E source.
- Do not add temporary debug workflows, diagnostic files, or one-off CI workarounds to the final PR.
- Do not increase Worker/D1 request counts merely to simplify frontend code when the same data can be returned in an existing request or computed locally.

## Formatting is an input constraint

Do not hand-guess Prettier output. Before considering a changed file complete, format it using the repository-installed version, for example:

```bash
pnpm exec prettier --write <changed-files>
```

Then run the normal checks. A formatting failure in remote CI means the local completion gate was skipped.

## Completion gates

Before commit, the repository pre-commit hook runs:

```bash
pnpm preflight
```

Before push, the repository pre-push hook runs:

```bash
pnpm verify
```

`pnpm verify` is the minimum definition of code-complete and must remain green before merge:

```text
guardrails
→ format
→ lint
→ typecheck
→ local D1 migrations
→ tests
→ build
→ Worker dry-run
```

For deployment/E2E changes, also inspect the production smoke contract before merging. A passing unit test suite is not enough when production acceptance behavior was changed.

## Rule for repeated failures

When a failure exposes a reusable rule, do not only patch the failing line. Convert the lesson into one of these repository-level protections in the same or immediately following change:

1. a fixed invariant in this file;
2. an automated guardrail in `scripts/check-repository-guardrails.mjs`;
3. a stable behavior test;
4. a pre-commit/pre-push/CI gate.

The goal is that the same class of failure becomes structurally difficult to repeat.
