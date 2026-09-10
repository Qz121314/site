import { Hono } from 'hono';
import type { Context } from 'hono';
import {
  getConversionGroup,
  selectNextConversionTarget,
} from '../conversion-pool/conversion-pool';
import { getCustomerServiceConnection } from '../customer-service/customer-service-connections';
import { renderH5Runtime, type H5RuntimeBinding } from '../h5-support-runtime';
import type { AppEnvironment } from '../types';
import { getH5PublicSettings } from '../settings/h5-settings';
import { serveStorefrontDocument } from './public-seo';

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

function injectCtaScript(
  html: string,
  pageId: string,
  runtimePath = '/pages/__runtime',
): string {
  const script = `<script src="${runtimePath}/${encodeURIComponent(pageId)}" defer></script>`;
  return /<\/body>/iu.test(html)
    ? html.replace(/<\/body>/iu, `${script}</body>`)
    : `${html}${script}`;
}

function runtimeResponse(
  pageId: string,
  ctas: Array<{
    id: string;
    key: string;
    label: string;
    selector: string;
    sectionId: string | null;
    conversionGroupId: string | null;
    mode: 'customer_service' | 'link' | null;
  }>,
  ctaPath = '/pages/cta',
): Response {
  const bindings: H5RuntimeBinding[] = ctas.map((cta) => ({
    key: cta.key,
    selector: cta.selector,
    label: cta.label,
    href:
      cta.sectionId && cta.conversionGroupId
        ? `${ctaPath}/${encodeURIComponent(pageId)}/${encodeURIComponent(cta.id)}`
        : null,
    mode: cta.mode,
  }));
  const source = renderH5Runtime(bindings);
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
  return serveH5Version(context, page.id, page.published_version_id, path);
}

async function serveH5Version(
  context: Context<AppEnvironment>,
  pageId: string,
  versionId: string,
  path: string,
  runtimePath = '/pages/__runtime',
) {
  const file = await context.env.DB.prepare(
    `SELECT object_key, mime_type FROM h5_page_files WHERE version_id = ? AND path = ?`,
  )
    .bind(versionId, path)
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
    "default-src 'self' https: data: blob:; script-src 'self' 'unsafe-inline' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' https: data: blob:; font-src 'self' https: data:; connect-src 'self' https: wss:; frame-ancestors 'none'",
  );
  headers.set(
    'Cache-Control',
    path === 'index.html' ? 'no-store' : 'public, max-age=31536000, immutable',
  );
  if (path !== 'index.html' || !file.mime_type.startsWith('text/html'))
    return new Response(object.body, { headers });
  const html = await object.text();
  return new Response(injectCtaScript(html, pageId, runtimePath), { headers });
}

export async function serveH5Product(context: Context<AppEnvironment>) {
  const sectionRef = context.req.param('sectionSlug')?.trim() ?? '';
  const productRef = context.req.param('productSlug')?.trim() ?? '';
  if (!sectionRef || !productRef) return serveStorefrontDocument(context);
  const product = await context.env.DB.prepare(
    `SELECT p.id, h.id AS page_id, h.published_version_id
     FROM products p
     JOIN sections s ON s.id = p.section_id AND s.deleted_at IS NULL AND s.is_enabled = 1
     JOIN h5_pages h ON h.product_id = p.id AND h.deleted_at IS NULL
     WHERE p.presentation_mode = 'h5'
       AND p.status = 'published'
       AND p.deleted_at IS NULL
       AND (s.slug = ? OR s.id = ?)
       AND (p.slug = ? OR p.id = ?)`,
  )
    .bind(sectionRef, sectionRef, productRef, productRef)
    .first<{ id: string; page_id: string; published_version_id: string | null }>();
  if (!product?.published_version_id) return serveStorefrontDocument(context);
  const path = cleanPath(context.req.param('*') ?? 'index.html');
  if (!path) return notFound(context);
  return serveH5Version(
    context,
    product.page_id,
    product.published_version_id,
    path,
    '/h5-runtime',
  );
}

async function serveRuntime(context: Context<AppEnvironment>, ctaPath = '/pages/cta') {
  const pageId = context.req.param('pageId') ?? '';
  const page = await context.env.DB.prepare(
    `SELECT published_version_id FROM h5_pages WHERE id = ? AND status = 'published' AND deleted_at IS NULL`,
  )
    .bind(pageId)
    .first<{ published_version_id: string | null }>();
  if (!page?.published_version_id) return notFound(context);
  const ctas = await context.env.DB.prepare(
    `SELECT c.id, c.cta_key AS key, c.label, c.selector, c.section_id AS sectionId,
            c.conversion_group_id AS conversionGroupId, g.mode
     FROM h5_page_ctas c
     LEFT JOIN conversion_groups g
       ON g.section_id = c.section_id AND g.id = c.conversion_group_id
     WHERE c.version_id = ?`,
  )
    .bind(page.published_version_id)
    .all<{
      id: string;
      key: string;
      label: string;
      selector: string;
      sectionId: string | null;
      conversionGroupId: string | null;
      mode: 'customer_service' | 'link' | null;
    }>();
  return runtimeResponse(pageId, ctas.results, ctaPath);
}

publicPageRoutes.get('/__runtime/:pageId', (context) => serveRuntime(context));

export const serveH5Runtime = (context: Context<AppEnvironment>) =>
  serveRuntime(context, '/h5-cta');

async function serveCta(context: Context<AppEnvironment>) {
  const pageId = context.req.param('pageId');
  const ctaId = context.req.param('ctaId');
  const cta = await context.env.DB.prepare(
    `SELECT c.section_id, c.conversion_group_id, c.cta_key,
            p.slug AS page_slug, p.name AS page_name, p.product_id,
            product.slug AS product_slug, product.title AS product_title,
            product.section_id AS product_section_id,
            product_section.slug AS product_section_slug,
            s.name AS section_name
     FROM h5_page_ctas c
     JOIN h5_page_versions v ON v.id = c.version_id
     JOIN h5_pages p ON p.id = v.page_id AND p.published_version_id = v.id
     JOIN sections s ON s.id = c.section_id AND s.deleted_at IS NULL AND s.is_enabled = 1
     LEFT JOIN products product ON product.id = p.product_id AND product.deleted_at IS NULL
     LEFT JOIN sections product_section
       ON product_section.id = product.section_id
      AND product_section.deleted_at IS NULL
     WHERE p.id = ? AND c.id = ? AND p.status = 'published'`,
  )
    .bind(pageId, ctaId)
    .first<{
      section_id: string | null;
      conversion_group_id: string | null;
      cta_key: string;
      page_slug: string;
      page_name: string;
      product_id: string | null;
      product_slug: string | null;
      product_title: string | null;
      product_section_id: string | null;
      product_section_slug: string | null;
      section_name: string;
    }>();
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
    (group.mode === 'link' && group.activeTargetCount < 1)
  )
    return notFound(context);
  if (group.mode === 'customer_service') {
    if (!group.customerServiceConnectionId) return notFound(context);
    const connection = await getCustomerServiceConnection(
      context.env.DB,
      group.customerServiceConnectionId,
    );
    if (
      !connection ||
      connection.deletedAt ||
      !connection.isEnabled ||
      !connection.clientApiUrl ||
      !connection.realtimeUrl ||
      !connection.verifiedAt
    )
      return notFound(context);
    context.header('Cache-Control', 'no-store, private');
    context.header('Referrer-Policy', 'no-referrer');
    const product =
      cta.product_id && cta.product_slug && cta.product_section_slug
        ? {
            id: cta.product_id,
            title: cta.product_title ?? cta.page_name,
            href: `/sections/${encodeURIComponent(cta.product_section_slug)}/products/${encodeURIComponent(cta.product_slug)}/`,
            coverUrl: null,
            sectionId: cta.product_section_id ?? cta.section_id,
            sectionName: cta.section_name,
            categoryId: null,
            categoryName: null,
            isEnabled: true,
            sourceType: 'product' as const,
            presentationMode: 'h5' as const,
            h5PageId: pageId,
          }
        : {
            id: `h5-page:${pageId}`,
            title: cta.page_name,
            href: `/pages/${encodeURIComponent(cta.page_slug)}/`,
            coverUrl: null,
            sectionId: cta.section_id,
            sectionName: cta.section_name,
            categoryId: null,
            categoryName: null,
            isEnabled: true,
            sourceType: 'h5_page' as const,
            pageId,
            pageSlug: cta.page_slug,
          };
    const source = cta.product_id
      ? {
          type: 'product' as const,
          productId: cta.product_id,
          presentationMode: 'h5' as const,
          h5PageId: pageId,
          pageName: cta.page_name,
          pageSlug: cta.page_slug,
          ctaId,
          ctaKey: cta.cta_key,
        }
      : {
          type: 'h5_page' as const,
          pageId,
          pageName: cta.page_name,
          pageSlug: cta.page_slug,
          ctaId,
          ctaKey: cta.cta_key,
        };
    return context.json({
      mode: 'customer_service',
      handoffId: crypto.randomUUID(),
      connection: {
        id: connection.id,
        clientApiUrl: connection.clientApiUrl,
        realtimeUrl: connection.realtimeUrl,
        protocolVersion: 'v1',
      },
      product,
      source,
    });
  }
  const target = await selectNextConversionTarget(
    context.env.DB,
    group,
    new Date().toISOString(),
  );
  if (!target?.endpointUrl) return notFound(context);
  context.header('Cache-Control', 'no-store, private');
  context.header('Referrer-Policy', 'no-referrer');
  return context.redirect(target.endpointUrl, 302);
}

publicPageRoutes.get('/cta/:pageId/:ctaId', serveCta);
export const serveH5Cta = serveCta;

publicPageRoutes.get('/:slug', servePage);
publicPageRoutes.get('/:slug/*', servePage);
