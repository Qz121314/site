import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const [
  packageText,
  preCommit,
  prePush,
  prepushVerify,
  productionSmoke,
  ciWorkflow,
  prFullVerifyWorkflow,
  workflowNames,
  storefrontPackageText,
  storefrontRoot,
  productDetailSource,
  appShellStyles,
  routeActionSource,
  viewportRuntime,
  sectionStyles,
  legacyStyles,
  storefrontIndex,
  themeRuntime,
  themeRuntimeStyles,
  adminPackageText,
  adminButtonSource,
  adminButtonVariantsSource,
  adminInputSource,
  adminLoginSource,
  adminErrorBoundarySource,
  adminUiStyles,
  adminMain,
  adminStyleManifest,
] = await Promise.all([
  readFile('package.json', 'utf8'),
  readFile('.githooks/pre-commit', 'utf8'),
  readFile('.githooks/pre-push', 'utf8'),
  readFile('scripts/prepush-verify.mjs', 'utf8'),
  readFile('tests/e2e/production-smoke.spec.ts', 'utf8'),
  readFile('.github/workflows/ci.yml', 'utf8'),
  readFile('.github/workflows/pr-full-verify.yml', 'utf8'),
  readdir('.github/workflows'),
  readFile('apps/storefront/package.json', 'utf8'),
  readFile('apps/storefront/src/StorefrontRoot.tsx', 'utf8'),
  readFile('apps/storefront/src/ProductDetailPage.tsx', 'utf8'),
  readFile('apps/storefront/src/app-shell.css', 'utf8'),
  readFile('apps/storefront/src/StorefrontRouteAction.tsx', 'utf8'),
  readFile('apps/storefront/src/storefront-viewport-runtime.ts', 'utf8'),
  readFile('apps/storefront/src/section-ui.css', 'utf8'),
  readFile('apps/storefront/src/styles.css', 'utf8'),
  readFile('apps/storefront/index.html', 'utf8'),
  readFile('apps/storefront/src/theme-runtime.ts', 'utf8'),
  readFile('apps/storefront/src/theme-runtime.css', 'utf8'),
  readFile('apps/admin/package.json', 'utf8'),
  readFile('apps/admin/src/components/ui/button.tsx', 'utf8'),
  readFile('apps/admin/src/components/ui/button-variants.ts', 'utf8'),
  readFile('apps/admin/src/components/ui/input.tsx', 'utf8'),
  readFile('apps/admin/src/LoginView.tsx', 'utf8'),
  readFile('apps/admin/src/AdminErrorBoundary.tsx', 'utf8'),
  readFile('apps/admin/src/admin-ui-system.css', 'utf8'),
  readFile('apps/admin/src/main.tsx', 'utf8'),
  readFile('apps/admin/src/admin.css', 'utf8'),
]);

const packageJson = JSON.parse(packageText);
const scripts = packageJson.scripts ?? {};
const storefrontPackageJson = JSON.parse(storefrontPackageText);
const adminPackageJson = JSON.parse(adminPackageText);

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
assert.match(
  prePush,
  /node\s+scripts\/prepush-verify\.mjs/u,
  'pre-push must delegate to the fast pre-push verifier',
);
assert.ok(
  prepushVerify.includes('PREPUSH_BASE') && prepushVerify.includes('origin/main'),
  'fast pre-push verification must resolve a stable comparison base',
);
assert.ok(
  prepushVerify.includes('prettier') && prepushVerify.includes('eslint'),
  'fast pre-push verification must check changed-file formatting and lint',
);
assert.ok(
  prepushVerify.includes("['guardrails']") && prepushVerify.includes("['typecheck']"),
  'fast pre-push verification must retain repository guardrails and type safety',
);

for (const requiredCommand of [
  'pnpm guardrails',
  'pnpm format',
  'pnpm lint',
  'pnpm typecheck',
  'pnpm db:migrate:local',
  'pnpm test',
  'pnpm build',
  'pnpm cf:check',
]) {
  assert.ok(
    prFullVerifyWorkflow.includes(requiredCommand),
    `PR full verification must cover: ${requiredCommand}`,
  );
}
assert.match(
  prFullVerifyWorkflow,
  /strategy:[\s\S]*fail-fast:\s*false[\s\S]*matrix:/u,
  'PR full verification must expose independent checks in parallel instead of serially masking later failures',
);
assert.match(
  prFullVerifyWorkflow,
  /actions\/upload-artifact@v4/u,
  'PR full verification must retain per-check diagnostics',
);
assert.doesNotMatch(
  prFullVerifyWorkflow,
  /run:\s*pnpm\s+verify/u,
  'PR full verification must not collapse all checks back into one serial pnpm verify step',
);
assert.match(
  storefrontPackageJson.scripts?.build ?? '',
  /check-storefront-bundle-budget\.mjs/u,
  'Storefront build must continue enforcing the existing bundle budget',
);

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
assert.match(
  storefrontRoot,
  /className="storefront-bottom-chrome"/u,
  'App Shell must expose one shared Bottom Chrome for navigation and route actions',
);
assert.match(
  storefrontRoot,
  /className="storefront-route-action-host"/u,
  'product route actions must mount inside the shared Bottom Chrome',
);
assert.doesNotMatch(
  appShellStyles,
  /html\[data-storefront-presentation='push'\]\s+\.app-shell > \.topbar/u,
  'navigation presentation must not own App Shell header visibility',
);
assert.match(
  appShellStyles,
  /\.storefront-bottom-chrome \{[\s\S]*position: fixed/u,
  'App Shell Bottom Chrome must be the only viewport-fixed bottom owner',
);
assert.doesNotMatch(
  appShellStyles,
  /\.storefront-route-action-host \{[\s\S]{0,220}position: fixed/u,
  'Route Action host must inherit positioning from shared Bottom Chrome',
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
  /--app-bottom-chrome-height/u,
  'viewport runtime must publish one measured Bottom Chrome height',
);
assert.doesNotMatch(
  viewportRuntime,
  /--app-bottom-nav-height|--app-route-action-height/u,
  'viewport runtime must not maintain separate Bottom Navigation and Route Action height systems',
);
assert.doesNotMatch(
  viewportRuntime,
  /navigator\.(?:userAgent|platform|vendor)|navigator\.userAgentData/u,
  'viewport geometry must not use navigator UA/platform sniffing',
);
assert.doesNotMatch(
  viewportRuntime,
  /['"`](?:iPhone|Android|Safari|Chrome)['"`]/u,
  'viewport geometry must not branch on literal device or browser identities',
);
assert.match(
  appShellStyles,
  /\.app-shell > \.topbar \{[\s\S]*position: fixed;[\s\S]*var\(--app-viewport-top/u,
  'App Shell Header must stay fixed to the live visual viewport',
);
assert.match(
  appShellStyles,
  /\.storefront-bottom-chrome \{[\s\S]*var\(--app-viewport-bottom/u,
  'App Shell Bottom Chrome must clear dynamic browser chrome',
);
assert.match(
  appShellStyles,
  /var\(--app-header-height/u,
  'App Shell content must clear the measured Header height',
);
assert.match(
  appShellStyles,
  /var\(--app-bottom-chrome-height/u,
  'Storefront content must clear the measured Bottom Chrome height',
);
assert.doesNotMatch(
  appShellStyles,
  /--app-bottom-nav-height|--app-route-action-height/u,
  'App Shell layout must not keep separate bottom chrome height formulas',
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
  /var\(--app-bottom-chrome-height/u,
  'mobile Section geometry must clear the measured shared Bottom Chrome',
);
assert.doesNotMatch(
  sectionStyles,
  /--app-bottom-nav-height|100dvh\s*-\s*68px/u,
  'mobile Section geometry must not duplicate an old Bottom Navigation height model',
);
assert.doesNotMatch(
  legacyStyles,
  /\.app-shell\s*\{[\s\S]{0,120}padding-bottom/u,
  'global styles must not regain App Shell layout ownership',
);
assert.doesNotMatch(
  themeRuntimeStyles,
  /\.app-shell\s*\{[\s\S]{0,160}padding-bottom|--app-bottom-nav-height|--app-route-action-height|\.mobile-cta-bar/u,
  'theme runtime styles must not own App Shell bottom geometry or legacy fixed CTA layout',
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

for (const dependency of [
  '@radix-ui/react-slot',
  'class-variance-authority',
  'clsx',
  'lucide-react',
  'tailwind-merge',
]) {
  assert.equal(
    typeof adminPackageJson.dependencies?.[dependency],
    'string',
    `Admin UI foundation dependency is missing: ${dependency}`,
  );
}

assert.match(
  `${adminButtonSource}\n${adminButtonVariantsSource}`,
  /Slot[\s\S]*buttonVariants|buttonVariants[\s\S]*Slot/u,
  'Admin Button must keep the source-owned shadcn composition boundary',
);
assert.match(
  adminInputSource,
  /className=\{cn\('ui-input'/u,
  'Admin Input must keep the shared component class boundary',
);
assert.match(adminLoginSource, /<Button/u, 'Admin login must use shared Button');
assert.match(adminLoginSource, /<Input/u, 'Admin login must use shared Input');
assert.match(
  adminErrorBoundarySource,
  /CircleAlert[\s\S]*<Button/u,
  'Admin recovery UI must use Lucide and shared Button components',
);
assert.match(
  adminUiStyles,
  /\.ui-button[\s\S]*\.ui-input/u,
  'Admin UI stylesheet must own shared control presentation',
);

const adminCssImports = [
  ...adminMain.matchAll(/^import\s+['"]([^'"]+\.css)['"];?$/gmu),
].map((match) => match[1]);
assert.deepEqual(
  adminCssImports,
  ['./admin.css'],
  'Admin runtime must load one CSS manifest; keep cascade ownership in admin.css',
);
for (const requiredAdminOwner of [
  "@import './admin-ui-system.css';",
  "@import '@site/storefront-ui/theme-contract.css';",
]) {
  assert.ok(
    adminStyleManifest.includes(requiredAdminOwner),
    `Admin CSS manifest must retain owner: ${requiredAdminOwner}`,
  );
}

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
