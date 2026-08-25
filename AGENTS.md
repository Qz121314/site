# Repository Engineering Contract

This file is a hard prerequisite for every code change in this repository. Read it before editing implementation, tests, CI, migrations, or deployment code.

## Mandatory sequence before editing

1. Classify the requested change as S, M, or L before editing. The level is based on impact/risk, not the number of changed files.
2. Read the implementation that will change.
3. Read the existing tests that cover the same behavior, including source-contract tests and production smoke/E2E when relevant.
4. Read the matching README section for already-decided product and architecture rules.
5. Identify the impact surface before writing code: runtime behavior, tests, types, D1 schema/query shape, Worker/R2 request budget, build, and production acceptance.
6. If the intended behavior changes an existing expectation, update that test contract in the same change. Do not leave a stale test to discover after implementation is finished.

The required order for a behavior change is:

```text
classify the change level
→ confirm the new rule
→ inspect/update the affected test contract
→ identify the owning layer and root cause
→ implement the structural fix
→ format with the repository Prettier version
→ run the verification gate required by the change level
```

Do not use this order:

```text
implement
→ push
→ wait for CI to fail
→ discover old expectations
→ patch the test afterwards
```

## Change levels and verification strength

Verification strength must be proportional to change risk. Do not make low-risk work slow by default, and do not under-verify high-risk work.

### S — small / local change

Typical examples:

- documentation;
- copy, spacing, typography, icon sizing, border/radius/shadow;
- local CSS polish or another change that does not alter API, data, routing, requests, persistence, or deployment behavior.

Rules:

- keep the scope local and avoid unrelated refactors;
- format the changed files with the repository Prettier version;
- run the narrowest relevant lint/test/typecheck/build check for the affected package when code is involved;
- documentation-only changes do not require D1, Worker, R2, or production E2E verification;
- when practical, batch several related UI-polish fixes into one verification/merge cycle instead of one PR per pixel-level change.

### M — application behavior change

Typical examples:

- Storefront/Admin interaction behavior;
- route or navigation behavior;
- filtering, CTA presentation, PWA behavior, media loading, Messages UI behavior;
- changes that alter an existing user-visible contract without changing persistent data or deployment infrastructure.

Rules:

- inspect/update the affected behavior/source contract first;
- run package/app formatting, lint, typecheck, relevant tests, and build;
- add Worker dry-run only when the Worker/runtime boundary is affected;
- run relevant production smoke/E2E when the changed behavior is specifically protected there.

### L — architecture / data / infrastructure change

Typical examples:

- D1 schema/migrations or query contracts;
- Worker API or public data contracts;
- R2 publication/storage behavior;
- authentication/security boundaries;
- CI/deployment changes;
- cross-application architecture or request-budget changes.

Rules:

- use the complete repository verification gate;
- inspect migrations, production smoke/E2E, deployment contracts, and recovery implications as applicable.

If a change grows beyond its original impact while being implemented, stop and reclassify it before continuing. When uncertain between two levels, use the higher level.

The repository/main deployment CI remains the final release gate. Change-level classification controls local development and PR iteration cost; it does not permit bypassing required protected-branch or production checks.

## Root-cause-first rule

Do not use patch-style fixes as the default engineering method. A visible symptom must first be traced to its owning layer, state/data flow, route boundary, layout contract, or deployment contract.

Avoid symptom suppression such as stacking override selectors, adding one-off route conditions, duplicating components to escape an ownership problem, or keeping obsolete implementations beside the replacement. If the root cause is structural, fix the structure and remove the superseded code in the same change. When the lesson is reusable, encode it in a repository invariant, guardrail, or stable behavior contract.

Do not upgrade every small defect into an architecture refactor. In the current commercial-polish phase, architecture, data models, APIs, publication flow, and routing are considered stable by default. Escalate an S/M change into structural work only when the same root cause crosses ownership boundaries or would otherwise recur across multiple surfaces.

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

## UI and CSS ownership contract

- Admin shared controls are source-owned components under `apps/admin/src/components/ui`. New buttons, inputs, textareas, selects, dialogs, sheets, tabs, badges, tables, toasts, and loading states must extend that layer instead of adding a new page-local visual implementation.
- Admin component composition follows the shadcn/ui ownership model with Radix primitives, class-variance-authority, `cn`, and Lucide icons. Components are copied into this repository and remain editable; do not introduce a second packaged design system.
- Lucide is the default functional icon set. Do not use emoji, Unicode glyphs, inline one-off SVG, or text punctuation as interface icons when a matching Lucide icon exists. Product and brand artwork are exempt.
- `admin-foundation.css` owns Admin tokens, reset, and global primitives. `admin-ui-system.css` owns shared component presentation. Page CSS owns layout and business-specific geometry only.
- Storefront does not inherit the Admin component skin. It keeps `packages/storefront-ui`, Theme Tokens, App Shell, PWA, VisualViewport, and runtime theme ownership. Shared Storefront visual behavior belongs in `packages/storefront-ui`; route CSS may own route geometry but must consume shared tokens.
- Do not add a CSS file for a single small component. Add to the owning shared component layer or the existing page stylesheet. A new stylesheet requires a distinct ownership boundary that cannot be expressed cleanly in an existing owner.
- Do not add `!important` to resolve normal cascade conflicts. Fix import order, specificity, or ownership. Existing debt may only decrease; any temporary exception must explain the browser/third-party constraint beside the declaration.
- UI migration is incremental. Do not retain a legacy shared control beside its migrated component once all consumers have moved, and do not rewrite stable business layouts merely to increase component-library coverage.
- `apps/admin/src/main.tsx` imports only `admin.css`. The manifest owns cascade order; runtime TypeScript must not accumulate page stylesheet imports.

## Formatting is an input constraint

Do not hand-guess Prettier output. Before considering a changed file complete, format it using the repository-installed version, for example:

```bash
pnpm exec prettier --write <changed-files>
```

Then run the change-level verification gate. A formatting failure in remote CI means the local completion gate was skipped.

## Completion gates

Use the smallest gate that correctly covers the classified change.

For S-level work, use changed-file formatting plus the narrowest affected package check. Documentation-only S-level work requires formatting/content review only.

For M-level work, run affected package/app formatting, lint, typecheck, tests, and build, plus relevant smoke/E2E when the changed contract is protected there.

For L-level work, or whenever persistent data / Worker / R2 / deployment boundaries change, run:

```bash
pnpm verify
```

The complete verification gate is:

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

When a failure exposes a reusable rule, do not only patch the failing line. Convert the lesson into one of these repository-level protections when the recurrence risk justifies it:

1. a fixed invariant in this file;
2. an automated guardrail in `scripts/check-repository-guardrails.mjs`;
3. a stable behavior test;
4. a pre-commit/pre-push/CI gate.

Do not add a new guardrail for every isolated S-level cosmetic issue. Guardrails are for reusable, cross-surface, or high-cost failure classes.

The goal is that repeated high-value failure classes become structurally difficult to repeat without turning everyday low-risk development into an unnecessarily slow process.
