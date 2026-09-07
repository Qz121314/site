# Testing contract

This document is the canonical owner for repository testing strategy and test-level selection. S/M/L determines validation strength in `AGENTS.md`; this file determines **which layer should own a contract**.

The goal is not to maximize test count. Stable business/runtime behavior should fail reliably when it regresses, while CSS/class/source-layout changes should not break unrelated tests.

## Test ownership model

Use the most stable layer that can verify the contract without hiding important architecture risk.

```text
1. Unit / Behavior
2. Architecture / Contract
3. Browser / E2E
4. Visual Regression
```

A behavior may have more than one layer only when each layer protects a distinct risk. Do not duplicate the same assertion across source inspection, browser tests and screenshots merely for coverage volume.

## 1. Unit / Behavior

Default owner for deterministic business behavior, data transformation and state semantics.

Use direct function/module behavior tests for contracts such as:

- routing and URL parsing;
- CTA/handoff data transformation;
- Article metadata normalization and unread calculation;
- support identity/lifecycle helpers;
- attachment/link safety;
- request/recovery coordination that can be exercised with a controlled fetch/storage/runtime harness;
- published-content parsing and compatibility behavior;
- local filtering, ordering and fallback rules.

Behavior tests should assert observable inputs/outputs, calls, state transitions and error semantics. They should not assert internal function names, CSS classes or incidental source layout when those details are not the product contract.

Prefer extracting a small pure helper when that makes an important rule directly testable without changing runtime behavior.

## 2. Architecture / Contract

Architecture tests protect boundaries that would be expensive or unsafe to discover only in browser/production tests and that cannot be expressed reliably as a lower-level behavior test.

Source inspection is allowed here, but it is an **exception**, not the default testing technique.

Good source-contract candidates include:

- request-budget and request-dedup architecture;
- forbidden import/dependency boundaries;
- bootstrap/startup ownership and lazy split boundaries;
- route/runtime ownership that prevents duplicate global owners;
- build/CI classifier contracts;
- security-sensitive source boundaries;
- explicit no-production-resource rules in repository tooling.

For source inspection:

- assert the smallest stable boundary necessary;
- prefer semantic module ownership over exact implementation strings;
- do not lock unrelated presentation details in the same test;
- merge duplicate source contracts when one canonical owner already protects the invariant.

### What source contracts should not own

Do not use source inspection as the default way to protect:

- CSS selector or class-name existence;
- exact spacing, height, width or breakpoint values unless the number itself is a real system contract;
- border radius, shadow, elevation or typography appearance;
- exact visual hierarchy;
- stylesheet import location when runtime/build behavior is already covered elsewhere;
- component names or DOM implementation details that may change without changing user behavior.

A refactor that preserves behavior should not require broad test rewrites merely because selectors/classes changed.

## 3. Browser / E2E

Browser tests own real integration and user-flow behavior that requires the browser runtime.

Use Playwright/browser acceptance for contracts such as:

- real navigation and route transitions;
- CTA click/handoff flow;
- App Shell ownership and fixed-chrome behavior;
- VisualViewport/keyboard/viewport integration;
- rendering and accessibility behavior that is genuinely user-visible;
- startup/runtime configuration application;
- request/runtime integration that must be observed from a real page;
- production route discovery;
- critical end-to-end gates.

Browser assertions should be semantic where possible: visible state, accessible role/name, URL, network request count, computed runtime relationship or user action result. Avoid turning browser tests into a second CSS source snapshot.

Production acceptance is release validation, not a PR database fixture. PR browser tests should use local deterministic fixtures unless the release process explicitly owns a production check.

## 4. Visual Regression

Visual regression is reserved for a **small number of stable, deterministic visual baselines** where image comparison provides real value beyond semantic browser assertions.

Appropriate baseline candidates may include major surfaces such as Home, Catalog/Section, Product Detail or Messages when the repository has a stable screenshot owner, deterministic fixtures, fonts/assets and accepted update procedure.

Do not translate dozens of removed CSS/source contracts into dozens of screenshots.

At the C2.5 baseline the repository has semantic Playwright acceptance but does **not** have a mature deterministic screenshot-baseline owner. Therefore C2.5 does not introduce screenshot infrastructure. Pure presentation details that no longer belong in source contracts are covered by existing browser acceptance plus product/manual visual review until a future visual-regression phase establishes a deliberate owner.

## Source-contract decision rule

Before adding or keeping a `readFile(...)` / regex / source-string test, ask:

1. Is the invariant high-value?
2. Would a pure behavior test verify it more directly?
3. Would an existing browser/E2E assertion verify it more semantically?
4. Is source ownership itself the contract?
5. Would a harmless rename/class/CSS refactor make this test fail?

Keep source inspection only when the answer establishes a real architecture boundary and no more stable layer is practical.

Examples that may remain source-owned:

```text
no eager support import in startup
no duplicate public query owner
no forbidden production Cloudflare command in PR tooling
no runtime dependency across a security boundary
classifier maps a path/content change to the correct release resource
```

Examples that should normally not remain source-owned:

```text
.some-class exists
border-radius is 14px
min-height is 44px
shadow token X is consumed by selector Y
heading is centered by this exact declaration
```

## Request budgets and performance contracts

Request budgets are system/cost contracts, not visual implementation details.

Protect important budgets through the most direct available layer:

- controlled fetch harness for concrete request count/order;
- browser network observation for integrated flows;
- source contract only when query-cache/lazy ownership cannot be exercised more stably.

Do not remove request-budget coverage merely because it uses source inspection. Rewrite it only when a stronger stable layer is practical.

Key Storefront budgets include bootstrap reuse, content route lazy loading, support lazy activation, conversation/media reads, product-detail reuse and request deduplication.

## Article / Messages contracts

Article tests should keep these semantics independent of future presentation work:

- reusable Article metadata/content behavior;
- body-free Messages Article bootstrap metadata;
- first-visit unread without support identity;
- persisted Article read IDs;
- support unread and Article unread independence;
- combined Messages badge calculation;
- generic `/articles/:articleId/` route;
- legacy FAQ compatibility;
- no extra media/config fetch solely for Article unread state.

Storefront promotional Article Card presentation is a separate C3 concern; test architecture cleanup must not pre-implement or falsely claim that UI.

## Local-first validation

PR-facing validation may use:

- repository guardrails;
- Prettier/ESLint/typecheck;
- local D1 migration application;
- unit/integration tests;
- production builds;
- Worker dry-run;
- local Playwright server/fixtures.

PR validation must not use production D1/R2 management resources or deploy the production Worker. Cloudflare release ownership is defined in `docs/development/cloudflare-ci.md`.

During implementation, run the narrowest owner closest to the changed contract. Do not wait for full PR CI to discover a locally reproducible formatting, type or targeted behavior failure.

## Final candidate

For L-level work:

```bash
pnpm verify
```

CI-contract tests under `tests/ci/` protect development-contract, classifier and release-gating behavior and are part of the repository test suite.

After push, final PR status is determined only by workflows on the exact latest PR HEAD SHA. See `docs/development/workflow.md`.
