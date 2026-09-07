# Repository Engineering Contract

Read this file before changing implementation, tests, CI, migrations, deployment code, or repository documentation. It contains the hard rules that must be immediately visible; operational how-to belongs in `docs/development/*`.

## Source-of-truth index

One rule has one canonical owner. Other files may summarize and link, not copy the detailed rule.

- `AGENTS.md` — mandatory sequence, S/M/L, fixed invariants, remote-resource boundaries, completion gates.
- `package.json` — executable commands.
- `.editorconfig`, `prettier.config.mjs`, `eslint.config.mjs` — concrete formatting/lint configuration.
- `docs/development/workflow.md` — detailed development, PR, exact-head and release workflow.
- `docs/development/formatting.md` — changed-file formatting and commit gate.
- `docs/development/testing.md` — test-layer ownership and validation policy.
- `docs/development/cloudflare-ci.md` — classifier and Cloudflare remote-resource budget.
- `docs/development/database.md` — D1 migration procedure.
- `docs/development/deployment.md` — build/deploy/smoke procedure.
- `README.md` — product, runtime topology and business boundaries; not a development manual.

## Mandatory sequence

Before editing:

```bash
pnpm preflight:dev
```

Then:

```text
classify S/M/L
→ inspect owner + existing contract
→ identify impact + root cause
→ implement scoped change
→ pnpm fix:changed
→ format/lint/typecheck/targeted validation
→ required completion gate
→ commit/push
→ exact latest-head PR CI
→ classifier-owned release
```

CI is final verification, not the first formatter/linter/test loop. Detailed commands are owned by `docs/development/workflow.md` and `docs/development/formatting.md`. Reclassify if scope expands.

## S / M / L

Risk, not file count, determines the level.

**S — small/local:** docs, copy, isolated presentation, or another change with no API/data/routing/request/security/release impact. Use the narrowest affected validation plus formatting.

**M — application behavior:** Storefront/Admin interaction, routing/navigation, filtering, CTA/PWA/media/Messages behavior, or another user-visible contract change without data/release redesign. Validate the owning behavior and affected app; run browser/E2E where that contract is owned.

**L — architecture/data/infrastructure:** D1 schema/query, Worker/public API, R2 publication/storage, security, CI/deployment, cross-app architecture, test architecture, documentation-contract ownership, or request-budget changes. Final candidate:

```bash
pnpm verify
```

When uncertain, use the higher level.

## Root-cause-first

Trace failures to the owning layer before patching symptoms. Do not default to stacked CSS overrides, route exception chains, duplicate replacement components, parallel old/new implementations, or deleting a failing test merely to make CI green.

Read the failing assertion/log, identify whether implementation, contract, fixture or formatting is wrong, then fix that cause. Keep the fix within scope.

## Exact-head PR rule

PR status is tied to the **exact latest PR HEAD SHA**.

- Older green runs never prove the current HEAD.
- After every push, retrieve the new remote HEAD and require every workflow triggered for that candidate to succeed on that SHA.
- Do not report PASS/READY from stale CI.
- Do not merge while required latest-head checks are pending or failing.

Details: `docs/development/workflow.md`.

## Classifier-owned release

`scripts/classify-cloudflare-changes.mjs` is the release-authority boundary. A `main` push does not authorize every Cloudflare remote operation.

Hard boundaries:

- PR validation is local-first: no production D1/R2 read or mutation, no production Worker deploy.
- No migration diff means no migration-specific production D1 recovery/read/apply.
- No R2 requirement means no production R2 mutation/domain/probe.
- No deploy-impacting diff means no Worker deploy.
- Minimal production smoke runs only after an actual deploy and remains bounded.
- Deep HTTP/browser production acceptance is change-classified.
- D1 binding/config changes do not authorize schema migration.

Classifier outputs, Wrangler boundaries and overrides: `docs/development/cloudflare-ci.md`. D1 procedure: `docs/development/database.md`. Deployment/smoke: `docs/development/deployment.md`.

## Testing hard rules

Canonical policy: `docs/development/testing.md`.

- Prefer stable user/business behavior assertions.
- Source inspection is only for high-value architecture boundaries that cannot be verified more stably.
- Request budgets, forbidden dependencies, bootstrap/startup ownership, build/CI classifiers and security-sensitive boundaries may justify source contracts.
- CSS selectors/classes, exact spacing/radius/shadow and visual hierarchy are not default long-term source contracts.
- Never weaken request/routing/security/unread/lifecycle invariants merely to reduce test count.
- When a product rule changes, update its owning stable contract in the same change.

## Storefront invariants

Unless the user explicitly changes them:

- Mobile-first; mobile product browsing is two columns with 1:1 product media.
- Business/marketing content comes from Admin-published data.
- Section search/category/tag filtering uses already-loaded data; no Worker/D1 request per interaction.
- Prefer bootstrap reuse, batch/public snapshots, cache and local computation over repeated reads.
- Request budget, dedup, bootstrap reuse, startup split and lazy support activation are architecture contracts.
- Do not increase Worker/D1/R2 request counts merely to simplify frontend code.

### App Shell / viewport

App Shell owns persistent Header, Bottom Navigation, route action host and fixed viewport geometry.

- Routes provide content/action intent; do not mount a second global fixed surface directly to `document.body`.
- `VisualViewport` owns dynamic browser chrome/keyboard geometry when available; no UA/device magic offsets.
- Safe Area handles physical cutouts, not dynamic viewport movement.
- Content clearance uses measured shell geometry; do not duplicate Header/Nav/CTA heights in route formulas.
- Route transforms affect route content, not persistent chrome; navigation/history runtime owns push/pop/tab and scroll restoration.

## Article / Messages invariants

- Article is reusable Markdown content, not Message, Conversation or Customer Service data.
- Generic route: `/articles/:articleId/`.
- Legacy FAQ storage/publication/routes remain compatibility boundaries until explicitly retired.
- Messages Article bootstrap metadata remains lightweight/body-free.
- Article unread and support unread are independent; badge composition must not let one reset erase the other.
- Article metadata/background references must not add a media/config request path merely for unread calculation.
- Do not claim Storefront promotional Article Cards are implemented before C3 completes.

## Conversion / Customer Service invariants

- `/go/:productId` is the authoritative CTA entry.
- Product context and `handoffId` survive Customer Service handoff.
- Do not invent an extra visitor text message when CTA is represented as product context.
- Customer Service conversations/messages/realtime stay owned by the independent service; Site is not a chat proxy.
- First-time ordinary browsing must not activate support identity/conversation/WebSocket work merely because Messages navigation exists.

## UI ownership

**Admin**
- Shared controls: `apps/admin/src/components/ui`.
- Radix/shadcn-style primitives, `cn`, class-variance-authority and Lucide are the shared component model; no second packaged Admin design system.
- `admin-foundation.css` owns tokens/reset/global primitives; `admin-ui-system.css` owns shared component presentation; page CSS owns page/business layout.
- `apps/admin/src/main.tsx` imports only `admin.css`; manifest owns cascade order.
- Do not solve normal cascade ownership with new `!important` or a final override layer.

**Storefront**
- Keeps its own `packages/storefront-ui`, Theme Tokens, App Shell, PWA and VisualViewport ownership.
- Shared appearance belongs in `packages/storefront-ui`; route CSS owns route geometry and consumes shared tokens. Do not apply Admin skin to Storefront.

## Formatting requirement

Use repository-installed tooling; do not hand-guess Prettier output:

```bash
pnpm fix:changed
pnpm format
```

Concrete formatting values stay in repository config. Commit-gate details: `docs/development/formatting.md`.

## Completion gates

- S: changed-file formatting + narrowest affected validation.
- M: affected app format/lint/typecheck/tests/build + relevant browser/E2E owner.
- L: `pnpm verify` + any explicit PR browser/CI gate triggered by paths.

Final PR candidate:

```text
local candidate gates
→ push
→ retrieve exact remote latest HEAD
→ wait for workflows on that HEAD
→ fix failures root-cause-first
→ report READY/PASS only when current HEAD is green
```

Release after merge remains change-aware. Never claim merge, deployment, migration or production validation that did not actually occur.
