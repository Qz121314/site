import { Hono } from 'hono';
import type { Context } from 'hono';
import {
  getConversionGroup,
  selectNextConversionTarget,
} from '../conversion-pool/conversion-pool';
import type { AppEnvironment } from '../types';
import { getH5PublicSettings } from '../settings/h5-settings';

function hasControlCharacters(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
}

function cleanPath(value: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(value || 'index.html').replaceAll('\\', '/');
  } catch {
    return null;
  }
  if (
    !decoded ||
    decoded.startsWith('/') ||
    decoded
      .split('/')
      .some(
        (part) => !part || part === '.' || part === '..' || hasControlCharacters(part),
      )
  )
    return null;
  return decoded;
}

function notFound(context: Context<AppEnvironment>) {
  context.header('Cache-Control', 'no-store');
  context.header('X-Robots-Tag', 'noindex, nofollow');
  return context.text('Not Found', 404);
}

function injectCtaScript(html: string, pageId: string): string {
  const script = `<script src="/pages/__runtime/${encodeURIComponent(pageId)}" defer></script>`;
  return /<\/body>/iu.test(html)
    ? html.replace(/<\/body>/iu, `${script}</body>`)
    : `${html}${script}`;
}

function runtimeResponse(
  pageId: string,
  ctas: Array<{
    id: string;
    label: string;
    selector: string;
    sectionId: string | null;
    conversionGroupId: string | null;
  }>,
): Response {
  const bindings = ctas.map((cta) => ({
    selector: cta.selector,
    label: cta.label,
    href:
      cta.sectionId && cta.conversionGroupId
        ? `/pages/cta/${encodeURIComponent(pageId)}/${encodeURIComponent(cta.id)}`
        : null,
  }));
  const serializedBindings = JSON.stringify(bindings);
  const source = `(function(){const b=${serializedBindings};function apply(){b.forEach(function(i){document.querySelectorAll(i.selector).forEach(function(e){if(i.label)e.textContent=i.label;if(i.href&&!e.dataset.siteCtaBound){e.dataset.siteCtaBound='1';e.addEventListener('click',function(event){event.preventDefault();window.location.href=i.href},{capture:true})}})})}if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',apply)}else{apply()}})();`;
  return new Response(source, {
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/javascript; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export const publicPageRoutes = new Hono<AppEnvironment>();

async function isConfiguredH5Host(context: Context<AppEnvironment>): Promise<boolean> {
  const configuredOrigin = (await getH5PublicSettings(context.env.DB)).publicOrigin;
  if (!configuredOrigin) return true;
  try {
    const configuredUrl = new URL(configuredOrigin);
    const requestUrl = new URL(context.req.url);
    return (
      (configuredUrl.protocol === 'https:' || configuredUrl.protocol === 'http:') &&
      configuredUrl.hostname === requestUrl.hostname
    );
  } catch {
    return false;
  }
}

publicPageRoutes.use('*', async (context, next) => {
  if (!(await isConfiguredH5Host(context))) return notFound(context);
  await next();
});

async function servePage(context: Context<AppEnvironment>) {
  const slug = context.req.param('slug')?.trim() ?? '';
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/u.test(slug)) return notFound(context);
  const rawPath = context.req.param('*') ?? '';
  const path = cleanPath(rawPath || 'index.html');
  if (!path) return notFound(context);
  const page = await context.env.DB.prepare(
    `SELECT id, published_version_id FROM h5_pages WHERE slug = ? AND status = 'published' AND deleted_at IS NULL`,
  )
    .bind(slug)
    .first<{ id: string; published_version_id: string | null }>();
  if (!page?.published_version_id) return notFound(context);
  const file = await context.env.DB.prepare(
    `SELECT object_key, mime_type FROM h5_page_files WHERE version_id = ? AND path = ?`,
  )
    .bind(page.published_version_id, path)
    .first<{ object_key: string; mime_type: string }>();
  if (!file) return notFound(context);
  const object = await context.env.ASSETS_BUCKET.get(file.object_key);
  if (!object) return notFound(context);
  const headers = new Headers();
  headers.set('Content-Type', object.httpMetadata?.contentType ?? file.mime_type);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('X-Robots-Tag', 'noindex, nofollow');
  headers.set(
    'Content-Security-Policy',
    "default-src 'self' https: data: blob:; script-src 'self' 'unsafe-inline' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' https: data: blob:; font-src 'self' https: data:; frame-ancestors 'none'",
  );
  headers.set(
    'Cache-Control',
    path === 'index.html' ? 'no-store' : 'public, max-age=31536000, immutable',
  );
  if (path !== 'index.html' || !file.mime_type.startsWith('text/html'))
    return new Response(object.body, { headers });
  const html = await object.text();
  return new Response(injectCtaScript(html, page.id), { headers });
}

publicPageRoutes.get('/__runtime/:pageId', async (context) => {
  const pageId = context.req.param('pageId');
  const page = await context.env.DB.prepare(
    `SELECT published_version_id FROM h5_pages WHERE id = ? AND status = 'published' AND deleted_at IS NULL`,
  )
    .bind(pageId)
    .first<{ published_version_id: string | null }>();
  if (!page?.published_version_id) return notFound(context);
  const ctas = await context.env.DB.prepare(
    `SELECT id, label, selector, section_id AS sectionId, conversion_group_id AS conversionGroupId FROM h5_page_ctas WHERE version_id = ?`,
  )
    .bind(page.published_version_id)
    .all<{
      id: string;
      label: string;
      selector: string;
      sectionId: string | null;
      conversionGroupId: string | null;
    }>();
  return runtimeResponse(pageId, ctas.results);
});

publicPageRoutes.get('/cta/:pageId/:ctaId', async (context) => {
  const pageId = context.req.param('pageId');
  const ctaId = context.req.param('ctaId');
  const cta = await context.env.DB.prepare(
    `SELECT section_id, conversion_group_id FROM h5_page_ctas c JOIN h5_page_versions v ON v.id = c.version_id JOIN h5_pages p ON p.id = v.page_id AND p.published_version_id = v.id WHERE p.id = ? AND c.id = ? AND p.status = 'published'`,
  )
    .bind(pageId, ctaId)
    .first<{ section_id: string | null; conversion_group_id: string | null }>();
  if (!cta?.section_id || !cta.conversion_group_id) return notFound(context);
  const group = await getConversionGroup(
    context.env.DB,
    cta.section_id,
    cta.conversion_group_id,
  );
  if (
    !group ||
    group.deletedAt ||
    !group.isEnabled ||
    group.activeTargetCount < 1 ||
    group.mode !== 'link'
  )
    return notFound(context);
  const target = await selectNextConversionTarget(
    context.env.DB,
    group,
    new Date().toISOString(),
  );
  if (!target?.endpointUrl) return notFound(context);
  context.header('Cache-Control', 'no-store, private');
  context.header('Referrer-Policy', 'no-referrer');
  return context.redirect(target.endpointUrl, 302);
});

publicPageRoutes.get('/:slug', servePage);
publicPageRoutes.get('/:slug/*', servePage);
