import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const [
  packageText,
  preCommit,
  prePush,
  productionSmoke,
  ciWorkflow,
  workflowNames,
  productDetailSource,
  appShellStyles,
  routeActionSource,
  viewportRuntime,
  sectionStyles,
  legacyStyles,
  storefrontIndex,
  themeRuntime,
] = await Promise.all([
  readFile('package.json', 'utf8'),
  readFile('.githooks/pre-commit', 'utf8'),
  readFile('.githooks/pre-push', 'utf8'),
  readFile('tests/e2e/production-smoke.spec.ts', 'utf8'),
  readFile('.github/workflows/ci.yml', 'utf8'),
  readdir('.github/workflows'),
  readFile('apps/storefront/src/ProductDetailPage.tsx', 'utf8'),
  readFile('apps/storefront/src/app-shell.css', 'utf8'),
  readFile('apps/storefront/src/StorefrontRouteAction.tsx', 'utf8'),
  readFile('apps/storefront/src/storefront-viewport-runtime.ts', 'utf8'),
  readFile('apps/storefront/src/section-ui.css', 'utf8'),
  readFile('apps/storefront/src/styles.css', 'utf8'),
  readFile('apps/storefront/index.html', 'utf8'),
  readFile('apps/storefront/src/theme-runtime.ts', 'utf8'),
]);

const packageJson = JSON.parse(packageText);
const scripts = packageJson.scripts ?? {};

for (const scriptName of [
  'format',
  'lint',
  'typecheck',
  'db:migrate:local',
  'test',
  'build',
  'cf:check',
  'preflight',
  'verify',
]) {
  assert.equal(
    typeof scripts[scriptName],
    'string',
    `Required package script is missing: ${scriptName}`,
  );
}

for (const requiredStep of [
  'pnpm guardrails',
  'pnpm format',
  'pnpm lint',
  'pnpm typecheck',
]) {
  assert.match(
    scripts.preflight,
    new RegExp(requiredStep.replaceAll(' ', '\\s+'), 'u'),
    `preflight must include: ${requiredStep}`,
  );
}

for (const requiredStep of [
  'pnpm preflight',
  'pnpm db:migrate:local',
  'pnpm test',
  'pnpm build',
  'pnpm cf:check',
]) {
  assert.match(
    scripts.verify,
    new RegExp(requiredStep.replaceAll(' ', '\\s+'), 'u'),
    `verify must include: ${requiredStep}`,
  );
}

assert.match(preCommit, /pnpm\s+preflight/u, 'pre-commit must run pnpm preflight');
assert.match(prePush, /pnpm\s+verify/u, 'pre-push must run pnpm verify');

const brittleProductionPatterns = [
  {
    pattern:
      /fontPack:\s*'[^']+'|mediaStyle:\s*'[^']+'|motionStyle:\s*'[^']+'|navigationStyle:\s*'[^']+'/u,
    reason: 'production smoke must read mutable theme recipe values at runtime',
  },
  {
    pattern: /boxShadow[\s\S]{0,160}\.toBe\(/u,
    reason: 'production smoke must not lock mutable theme shadows to exact values',
  },
  {
    pattern: /\.toBe\('\d+(?:\.\d+)?px'\)/u,
    reason: 'production smoke must not lock mutable visual dimensions to exact pixels',
  },
];

for (const { pattern, reason } of brittleProductionPatterns) {
  assert.doesNotMatch(productionSmoke, pattern, reason);
}

assert.doesNotMatch(
  productDetailSource,
  /createPortal|document\.body/u,
  'route pages must not mount persistent chrome directly to document.body',
);
assert.match(
  productDetailSource,
  /StorefrontRouteAction/u,
  'product detail must declare its bottom action through the App Shell route-action slot',
);
assert.match(
  routeActionSource,
  /createPortal\(children, host\)/u,
  'route actions must portal only into the App Shell-owned host',
);
assert.doesNotMatch(
  appShellStyles,
  /html\[data-storefront-presentation='push'\]\s+\.app-shell > \.topbar/u,
  'navigation presentation must not own App Shell header visibility',
);
assert.match(
  appShellStyles,
  /\.storefront-route-action-host \{[\s\S]*position: fixed/u,
  'App Shell must own the viewport-fixed route action host',
);

assert.match(
  viewportRuntime,
  /window\.visualViewport/u,
  'Storefront fixed chrome must derive live browser geometry from VisualViewport when available',
);
assert.match(
  viewportRuntime,
  /ResizeObserver/u,
  'Storefront App Shell chrome clearance must use measured DOM geometry',
);
assert.match(
  viewportRuntime,
  /--app-header-height/u,
  'viewport runtime must publish measured Header height',
);
assert.match(
  viewportRuntime,
  /--app-bottom-nav-height/u,
  'viewport runtime must publish measured Bottom Navigation height',
);
assert.match(
  viewportRuntime,
  /--app-route-action-height/u,
  'viewport runtime must publish measured Route Action height',
);
assert.doesNotMatch(
  viewportRuntime,
  /userAgent|navigator\.platform|iPhone|Android|Safari|Chrome/u,
  'viewport geometry must not use UA or device-specific offset branches',
);
assert.match(
  appShellStyles,
  /\.app-shell > \.topbar \{[\s\S]*position: fixed;[\s\S]*var\(--app-viewport-top/u,
  'App Shell Header must stay fixed to the live visual viewport',
);
assert.match(
  appShellStyles,
  /\.storefront-route-action-host \{[\s\S]*var\(--app-viewport-bottom/u,
  'App Shell Route Action must clear dynamic browser chrome',
);
assert.match(
  appShellStyles,
  /var\(--app-header-height/u,
  'App Shell content must clear the measured Header height',
);
assert.match(
  appShellStyles,
  /var\(--app-route-action-height/u,
  'Product content must clear the measured Route Action height',
);
assert.doesNotMatch(
  appShellStyles,
  /max\(var\(--theme-detail-cta-height[\s\S]{0,180}\+ 58px/u,
  'Product viewport clearance must not duplicate CTA and Header design constants',
);
assert.match(
  sectionStyles,
  /var\(--app-viewport-height/u,
  'mobile Section geometry must derive from the live viewport runtime',
);
assert.match(
  sectionStyles,
  /var\(--app-bottom-nav-height/u,
  'mobile Section geometry must clear the measured Bottom Navigation',
);
assert.doesNotMatch(
  sectionStyles,
  /100dvh\s*-\s*68px/u,
  'mobile Section geometry must not duplicate a fixed Bottom Navigation height',
);
assert.doesNotMatch(
  legacyStyles,
  /\.app-shell\s*\{[\s\S]{0,120}padding-bottom/u,
  'global styles must not regain App Shell layout ownership',
);
assert.match(
  storefrontIndex,
  /interactive-widget=resizes-content/u,
  'mobile viewport metadata must request content resizing for interactive widgets',
);
assert.match(
  themeRuntime,
  /syncThemeColor\(theme\.tokens\.pageBg\)/u,
  'browser chrome theme-color must blend with the current page background',
);

assert.doesNotMatch(
  ciWorkflow,
  /^\s{2}deploy:\s*$/mu,
  'CI must not allocate a second hosted runner job only for production deployment',
);
assert.doesNotMatch(
  ciWorkflow,
  /needs:\s*validate/u,
  'main deployment must continue in the same hosted runner after validation',
);
assert.match(
  ciWorkflow,
  /cancel-in-progress:\s*\$\{\{\s*github\.event_name != 'push' \|\| github\.ref != 'refs\/heads\/main'\s*\}\}/u,
  'main production runs must not cancel an in-progress deployment',
);

const temporaryWorkflow = workflowNames.find((name) =>
  /debug|temporary|diagnostic/iu.test(name),
);
assert.equal(
  temporaryWorkflow,
  undefined,
  `Temporary workflow must not be committed: ${temporaryWorkflow ?? ''}`,
);

console.log('Repository guardrails passed.');
