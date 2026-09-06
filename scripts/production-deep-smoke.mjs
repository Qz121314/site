const baseUrl = process.env.BASE_URL?.replace(/\/$/, '');
if (!baseUrl) throw new Error('BASE_URL is required for deep production smoke');

async function request(path, init) {
  const response = await fetch(`${baseUrl}${path}`, { ...init, signal: AbortSignal.timeout(15_000) });
  return response;
}

const root = await request('/');
if (!root.ok) throw new Error(`Root returned HTTP ${root.status}`);
const requiredHeaders = new Map([
  ['content-security-policy', "frame-ancestors 'none'"],
  ['x-content-type-options', 'nosniff'],
  ['x-frame-options', 'DENY'],
  ['referrer-policy', 'strict-origin-when-cross-origin'],
]);
for (const [name, expected] of requiredHeaders) {
  const value = root.headers.get(name) ?? '';
  if (!value.toLowerCase().includes(expected.toLowerCase())) {
    throw new Error(`Missing required ${name} contract`);
  }
}

const theme = await request('/api/public/theme');
if (!theme.ok) throw new Error(`/api/public/theme returned HTTP ${theme.status}`);
if (!(theme.headers.get('content-type') ?? '').includes('application/json')) throw new Error('Theme content-type contract failed');
if ((theme.headers.get('cache-control') ?? '') !== 'public, max-age=30, must-revalidate') {
  throw new Error('Theme cache-control contract failed');
}
const themePayload = await theme.json();
if (!themePayload?.theme?.key || !['light', 'dark'].includes(themePayload.theme.colorScheme)) {
  throw new Error('Theme runtime contract failed');
}

const auth = await request('/api/admin/auth/session');
if (!auth.ok) throw new Error(`Admin session probe returned HTTP ${auth.status}`);
const authPayload = await auth.json();
if (authPayload.authenticated !== false) throw new Error('Anonymous Admin session boundary failed');

const notFoundPath = `/sections/storefront-smoke-${process.env.GITHUB_SHA ?? 'local'}/products/not-found/`;
const notFound = await request(notFoundPath, {
  headers: { Accept: 'text/html', 'Sec-Fetch-Mode': 'navigate' },
});
if (notFound.status !== 404) throw new Error(`Storefront not-found route returned HTTP ${notFound.status}`);
if (!(notFound.headers.get('x-robots-tag') ?? '').toLowerCase().includes('noindex')) {
  throw new Error('Storefront not-found robots contract failed');
}
const notFoundBody = await notFound.text();
if (!notFoundBody.includes('class="boot-shell"')) throw new Error('Storefront not-found shell contract failed');

console.log('Deep production HTTP acceptance passed.');
