import type { Context } from 'hono';
import type { AppEnvironment } from '../types';

type JsonRecord = Record<string, unknown>;

type ModuleReference = {
  contentVersion: string;
  manifestKey: string;
  publishedAt: string;
};

type PublicPointer = {
  schemaVersion: 2;
  contentVersion: string;
  publishedAt: string;
  site: ModuleReference;
  sectionsIndex: ModuleReference;
  faq: ModuleReference;
  sections: Record<string, ModuleReference>;
};

type PublishedSite = {
  name: string;
  locationLabel: string;
};

type PublishedSection = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  browseBackgroundObjectKey: string | null;
};

type PublishedProduct = {
  id: string;
  slug: string;
  sectionId: string;
  title: string;
  address: string | null;
  coverObjectKey: string | null;
};

type ProductDetail = PublishedProduct & {
  body: string;
  media: Array<{ objectKey: string | null }>;
};

type FaqArticle = {
  id: string;
  title: string;
  body: string;
};

type PublishedContent = {
  pointer: PublicPointer;
  site: PublishedSite;
  sections: PublishedSection[];
};

type SeoPage = {
  status: 200 | 404;
  canonicalPath: string;
  title: string;
  description: string;
  imagePath: string | null;
  noindex: boolean;
  jsonLd: JsonRecord;
  redirectPath?: string;
};

const PAGE_CACHE_CONTROL = 'public, max-age=0, must-revalidate';
const SEO_CACHE_CONTROL = 'public, max-age=300, stale-while-revalidate=3600';

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value
    .replace(/!\[[^\]]*\]\([^)]*\)/gu, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, '$1')
    .replace(/<[^>]+>/gu, ' ')
    .replace(/[`*_>#~-]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
  if (!cleaned) return null;
  return cleaned.length <= maxLength
    ? cleaned
    : `${cleaned.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
}

function cleanRouteValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim();
  const hasControlCharacter = Array.from(cleaned).some(
    (character) => character.charCodeAt(0) < 32,
  );
  if (!cleaned || cleaned.length > 120 || cleaned.includes('/') || hasControlCharacter) {
    return null;
  }
  return cleaned;
}

function validReference(value: unknown): value is ModuleReference {
  return (
    isRecord(value) &&
    typeof value.contentVersion === 'string' &&
    typeof value.manifestKey === 'string' &&
    typeof value.publishedAt === 'string' &&
    /^public\/modules\/[A-Za-z0-9._/-]+\/manifest\.json$/u.test(value.manifestKey) &&
    !value.manifestKey.includes('..')
  );
}

function parsePointer(value: unknown): PublicPointer | null {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 2 ||
    typeof value.contentVersion !== 'string' ||
    typeof value.publishedAt !== 'string' ||
    !validReference(value.site) ||
    !validReference(value.sectionsIndex) ||
    !validReference(value.faq) ||
    !isRecord(value.sections)
  ) {
    return null;
  }
  const sections: Record<string, ModuleReference> = {};
  for (const [sectionId, reference] of Object.entries(value.sections)) {
    if (!sectionId || sectionId.length > 120 || !validReference(reference)) return null;
    sections[sectionId] = reference;
  }
  return {
    schemaVersion: 2,
    contentVersion: value.contentVersion,
    publishedAt: value.publishedAt,
    site: value.site,
    sectionsIndex: value.sectionsIndex,
    faq: value.faq,
    sections,
  };
}

async function readJson(bucket: R2Bucket, key: string): Promise<unknown | null> {
  const object = await bucket.get(key);
  if (!object) return null;
  try {
    return JSON.parse(await object.text()) as unknown;
  } catch {
    return null;
  }
}

function referenceFile(reference: ModuleReference, relativePath: string): string {
  return reference.manifestKey.replace(/manifest\.json$/u, relativePath);
}

function parseSite(value: unknown): PublishedSite | null {
  if (!isRecord(value) || !isRecord(value.site)) return null;
  const name = cleanText(value.site.name, 80);
  const locationLabel = cleanText(value.site.locationLabel, 180);
  return name && locationLabel ? { name, locationLabel } : null;
}

function parseSections(value: unknown): PublishedSection[] | null {
  if (!isRecord(value) || !Array.isArray(value.sections)) return null;
  const sections: PublishedSection[] = [];
  for (const item of value.sections) {
    if (!isRecord(item)) return null;
    const id = cleanRouteValue(item.id);
    const slug = cleanRouteValue(item.slug);
    const name = cleanText(item.name, 120);
    if (!id || !name) return null;
    sections.push({
      id,
      slug: slug ?? id,
      name,
      description: cleanText(item.description, 180),
      browseBackgroundObjectKey:
        typeof item.browseBackgroundObjectKey === 'string'
          ? item.browseBackgroundObjectKey
          : null,
    });
  }
  return sections;
}

async function loadPublishedContent(bucket: R2Bucket): Promise<PublishedContent | null> {
  const pointer = parsePointer(await readJson(bucket, 'public/current.json'));
  if (!pointer) return null;
  const [siteValue, sectionsValue] = await Promise.all([
    readJson(bucket, referenceFile(pointer.site, 'site.json')),
    readJson(bucket, referenceFile(pointer.sectionsIndex, 'sections.json')),
  ]);
  const site = parseSite(siteValue);
  const sections = parseSections(sectionsValue);
  return site && sections ? { pointer, site, sections } : null;
}

function decodeRoutePart(value: string): string | null {
  try {
    const decoded = decodeURIComponent(value);
    return decoded && decoded.length <= 120 ? decoded : null;
  } catch {
    return null;
  }
}

function routePart(value: string): string {
  return encodeURIComponent(value);
}

function findSection(
  content: PublishedContent,
  reference: string,
): PublishedSection | null {
  return (
    content.sections.find((section) => section.id === reference) ??
    content.sections.find((section) => section.slug === reference) ??
    null
  );
}

function parseProducts(value: unknown): PublishedProduct[] {
  if (!isRecord(value) || !Array.isArray(value.products)) return [];
  return value.products.flatMap((item) => {
    if (!isRecord(item)) return [];
    const id = cleanRouteValue(item.id);
    const slug = cleanRouteValue(item.slug);
    const sectionId = cleanRouteValue(item.sectionId);
    const title = cleanText(item.title, 160);
    if (!id || !sectionId || !title) return [];
    return [
      {
        id,
        slug: slug ?? id,
        sectionId,
        title,
        address: cleanText(item.address, 180),
        coverObjectKey:
          typeof item.coverObjectKey === 'string' ? item.coverObjectKey : null,
      },
    ];
  });
}

async function loadSectionProducts(
  bucket: R2Bucket,
  content: PublishedContent,
  section: PublishedSection,
): Promise<PublishedProduct[]> {
  const reference = content.pointer.sections[section.id];
  if (!reference) return [];
  return parseProducts(await readJson(bucket, referenceFile(reference, 'section.json')));
}

async function loadProductDetail(
  bucket: R2Bucket,
  reference: ModuleReference,
  productId: string,
): Promise<ProductDetail | null> {
  const value = await readJson(
    bucket,
    referenceFile(reference, `products/${routePart(productId)}.json`),
  );
  if (!isRecord(value) || !isRecord(value.product)) return null;
  const product = value.product;
  const id = cleanRouteValue(product.id);
  const slug = cleanRouteValue(product.slug);
  const sectionId = cleanRouteValue(product.sectionId);
  const title = cleanText(product.title, 160);
  if (!id || !sectionId || !title) return null;
  return {
    id,
    slug: slug ?? id,
    sectionId,
    title,
    address: cleanText(product.address, 180),
    coverObjectKey:
      typeof product.coverObjectKey === 'string' ? product.coverObjectKey : null,
    body: typeof product.body === 'string' ? product.body : '',
    media: Array.isArray(product.media)
      ? product.media.flatMap((item) =>
          isRecord(item)
            ? [
                {
                  objectKey: typeof item.objectKey === 'string' ? item.objectKey : null,
                },
              ]
            : [],
        )
      : [],
  };
}

function parseFaqs(value: unknown): FaqArticle[] {
  if (!isRecord(value) || !Array.isArray(value.faqs)) return [];
  return value.faqs.flatMap((item) => {
    if (!isRecord(item)) return [];
    const id = cleanRouteValue(item.id);
    const title = cleanText(item.title, 180);
    if (!id || !title) return [];
    return [{ id, title, body: typeof item.body === 'string' ? item.body : '' }];
  });
}

async function loadFaqs(
  bucket: R2Bucket,
  content: PublishedContent,
): Promise<FaqArticle[]> {
  return parseFaqs(
    await readJson(bucket, referenceFile(content.pointer.faq, 'faq.json')),
  );
}

function sameOriginMediaPath(objectKey: string | null): string | null {
  if (!objectKey || objectKey.includes('..')) return null;
  const segments = objectKey.split('/');
  if (segments.length < 2 || segments.some((segment) => !segment)) return null;
  return `/_media/${segments.map(routePart).join('/')}`;
}

function webpageJsonLd(
  origin: string,
  canonicalPath: string,
  title: string,
  description: string,
  siteName: string,
  imagePath: string | null,
): JsonRecord {
  return {
    '@context': 'https://schema.org',
    '@type': canonicalPath === '/' ? 'WebSite' : 'WebPage',
    name: title,
    description,
    url: new URL(canonicalPath, origin).toString(),
    ...(canonicalPath === '/' ? { alternateName: siteName } : {}),
    ...(imagePath ? { image: new URL(imagePath, origin).toString() } : {}),
    inLanguage: 'en',
  };
}

function basicPage(
  origin: string,
  content: PublishedContent,
  canonicalPath: string,
  title: string,
  description: string,
  imagePath: string | null = null,
  noindex = false,
): SeoPage {
  return {
    status: 200,
    canonicalPath,
    title,
    description,
    imagePath,
    noindex,
    jsonLd: webpageJsonLd(
      origin,
      canonicalPath,
      title,
      description,
      content.site.name,
      imagePath,
    ),
  };
}

function notFoundPage(origin: string, content: PublishedContent): SeoPage {
  const title = `Not Found · ${content.site.name}`;
  const description = content.site.locationLabel;
  return {
    ...basicPage(origin, content, '/', title, description, null, true),
    status: 404,
  };
}

async function resolveSeoPage(
  bucket: R2Bucket,
  origin: string,
  pathname: string,
): Promise<SeoPage | null> {
  const content = await loadPublishedContent(bucket);
  if (!content) return null;
  const { site } = content;

  if (pathname === '/') {
    return basicPage(origin, content, '/', site.name, site.locationLabel);
  }
  if (pathname === '/browse' || pathname === '/discover' || pathname === '/discover/') {
    return {
      ...basicPage(
        origin,
        content,
        '/browse/',
        `Browse · ${site.name}`,
        site.locationLabel,
      ),
      redirectPath: '/browse/',
    };
  }
  if (pathname === '/browse/') {
    return basicPage(
      origin,
      content,
      '/browse/',
      `Browse · ${site.name}`,
      site.locationLabel,
    );
  }
  if (pathname === '/messages' || pathname === '/messages/') {
    const page = basicPage(
      origin,
      content,
      '/messages/',
      `Messages · ${site.name}`,
      site.locationLabel,
      null,
      true,
    );
    return pathname === '/messages' ? { ...page, redirectPath: '/messages/' } : page;
  }
  if (/^\/messages\/(?:new|[^/]+)\/?$/u.test(pathname)) {
    return basicPage(
      origin,
      content,
      '/messages/',
      `Messages · ${site.name}`,
      site.locationLabel,
      null,
      true,
    );
  }
  if (pathname === '/faq' || pathname === '/faq/') {
    const page = basicPage(
      origin,
      content,
      '/faq/',
      `FAQ · ${site.name}`,
      site.locationLabel,
    );
    return pathname === '/faq' ? { ...page, redirectPath: '/faq/' } : page;
  }

  const faqMatch = /^\/faq\/([^/]+)\/?$/u.exec(pathname);
  if (faqMatch) {
    const articleRef = decodeRoutePart(faqMatch[1] ?? '');
    const article = articleRef
      ? (await loadFaqs(bucket, content)).find((item) => item.id === articleRef)
      : null;
    if (!article) return notFoundPage(origin, content);
    const canonicalPath = `/faq/${routePart(article.id)}/`;
    const page = basicPage(
      origin,
      content,
      canonicalPath,
      `${article.title} · ${site.name}`,
      cleanText(article.body, 160) ?? site.locationLabel,
    );
    return pathname !== canonicalPath ? { ...page, redirectPath: canonicalPath } : page;
  }

  const sectionMatch = /^\/sections\/([^/]+)\/?$/u.exec(pathname);
  if (sectionMatch) {
    const sectionRef = decodeRoutePart(sectionMatch[1] ?? '');
    const section = sectionRef ? findSection(content, sectionRef) : null;
    if (!section || !content.pointer.sections[section.id]) {
      return notFoundPage(origin, content);
    }
    const canonicalPath = `/sections/${routePart(section.slug || section.id)}/`;
    const page = basicPage(
      origin,
      content,
      canonicalPath,
      `${section.name} · ${site.name}`,
      section.description ?? site.locationLabel,
      sameOriginMediaPath(section.browseBackgroundObjectKey),
    );
    return pathname !== canonicalPath ? { ...page, redirectPath: canonicalPath } : page;
  }

  const productMatch = /^\/sections\/([^/]+)\/products\/([^/]+)\/?$/u.exec(pathname);
  if (productMatch) {
    const sectionRef = decodeRoutePart(productMatch[1] ?? '');
    const productRef = decodeRoutePart(productMatch[2] ?? '');
    const section = sectionRef ? findSection(content, sectionRef) : null;
    const reference = section ? content.pointer.sections[section.id] : null;
    if (!section || !reference || !productRef) return notFoundPage(origin, content);
    const products = await loadSectionProducts(bucket, content, section);
    const product =
      products.find((item) => item.id === productRef) ??
      products.find((item) => item.slug === productRef) ??
      null;
    if (!product) return notFoundPage(origin, content);
    const detail = await loadProductDetail(bucket, reference, product.id);
    const canonicalPath = `/sections/${routePart(section.slug || section.id)}/products/${routePart(product.slug || product.id)}/`;
    const description =
      cleanText(detail?.body, 160) ??
      product.address ??
      section.description ??
      site.locationLabel;
    const imageKey =
      product.coverObjectKey ??
      detail?.media.find((item) => item.objectKey)?.objectKey ??
      null;
    const page = basicPage(
      origin,
      content,
      canonicalPath,
      `${product.title} · ${site.name}`,
      description,
      sameOriginMediaPath(imageKey),
    );
    return pathname !== canonicalPath ? { ...page, redirectPath: canonicalPath } : page;
  }

  const legacyProductMatch = /^\/products\/([^/]+)\/?$/u.exec(pathname);
  if (legacyProductMatch) {
    const productRef = decodeRoutePart(legacyProductMatch[1] ?? '');
    if (!productRef) return notFoundPage(origin, content);
    for (const section of content.sections) {
      const products = await loadSectionProducts(bucket, content, section);
      const product =
        products.find((item) => item.id === productRef) ??
        products.find((item) => item.slug === productRef) ??
        null;
      if (!product) continue;
      const canonicalPath = `/sections/${routePart(section.slug || section.id)}/products/${routePart(product.slug || product.id)}/`;
      return {
        ...basicPage(
          origin,
          content,
          canonicalPath,
          `${product.title} · ${site.name}`,
          product.address ?? section.description ?? site.locationLabel,
          sameOriginMediaPath(product.coverObjectKey),
        ),
        redirectPath: canonicalPath,
      };
    }
  }

  return notFoundPage(origin, content);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeXml(value: string): string {
  return escapeHtml(value);
}

function absoluteUrl(origin: string, path: string): string {
  return new URL(path, origin).toString();
}

function metadataMarkup(page: SeoPage, origin: string): string {
  const canonical = absoluteUrl(origin, page.canonicalPath);
  const image = page.imagePath ? absoluteUrl(origin, page.imagePath) : null;
  const robots = page.noindex
    ? 'noindex, nofollow'
    : 'index, follow, max-image-preview:large';
  const jsonLd = JSON.stringify(page.jsonLd).replaceAll('<', '\\u003c');
  return [
    `<meta name="description" content="${escapeHtml(page.description)}" />`,
    `<meta name="robots" content="${robots}" />`,
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
    '<meta property="og:type" content="website" />',
    `<meta property="og:site_name" content="${escapeHtml(page.title.split(' · ').at(-1) ?? page.title)}" />`,
    `<meta property="og:title" content="${escapeHtml(page.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(page.description)}" />`,
    `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
    ...(image ? [`<meta property="og:image" content="${escapeHtml(image)}" />`] : []),
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />`,
    `<meta name="twitter:title" content="${escapeHtml(page.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(page.description)}" />`,
    ...(image ? [`<meta name="twitter:image" content="${escapeHtml(image)}" />`] : []),
    `<script type="application/ld+json">${jsonLd}</script>`,
  ].join('\n    ');
}

async function storefrontShell(context: Context<AppEnvironment>): Promise<Response> {
  const url = new URL('/index.html', context.req.url);
  return context.env.ASSETS.fetch(
    new Request(url, {
      method: 'GET',
      headers: context.req.raw.headers,
    }),
  );
}

function withPageHeaders(response: Response, page: SeoPage): Headers {
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('etag');
  headers.set('cache-control', PAGE_CACHE_CONTROL);
  headers.set('content-type', 'text/html; charset=utf-8');
  if (page.noindex) headers.set('x-robots-tag', 'noindex, nofollow');
  return headers;
}

export async function serveStorefrontDocument(context: Context<AppEnvironment>) {
  const requestUrl = new URL(context.req.url);
  const page = await resolveSeoPage(
    context.env.ASSETS_BUCKET,
    requestUrl.origin,
    requestUrl.pathname,
  );
  if (!page) return context.text('Not Found', 404);
  if (page.redirectPath) {
    return context.redirect(absoluteUrl(requestUrl.origin, page.redirectPath), 308);
  }

  const shell = await storefrontShell(context);
  if (!shell.ok) return context.text('Not Found', 404);
  let html = await shell.text();
  html = html.replace(
    /<title>[^<]*<\/title>/u,
    `<title>${escapeHtml(page.title)}</title>`,
  );
  html = html.replace(
    '</head>',
    `    ${metadataMarkup(page, requestUrl.origin)}\n  </head>`,
  );
  const headers = withPageHeaders(shell, page);
  return new Response(context.req.method === 'HEAD' ? null : html, {
    status: page.status,
    headers,
  });
}

export async function serveStaticAsset(context: Context<AppEnvironment>) {
  const response = await context.env.ASSETS.fetch(context.req.raw);
  if (response.ok) return response;
  return new Response(null, {
    status: 404,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}

export async function serveRobots(context: Context<AppEnvironment>) {
  const origin = new URL(context.req.url).origin;
  const body = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin/',
    'Disallow: /api/',
    'Disallow: /public/',
    'Disallow: /messages/',
    `Sitemap: ${absoluteUrl(origin, '/sitemap.xml')}`,
    '',
  ].join('\n');
  return new Response(context.req.method === 'HEAD' ? null : body, {
    headers: {
      'Cache-Control': SEO_CACHE_CONTROL,
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function serveSitemap(context: Context<AppEnvironment>) {
  const requestUrl = new URL(context.req.url);
  const content = await loadPublishedContent(context.env.ASSETS_BUCKET);
  if (!content) return context.text('Not Found', 404);
  const entries = new Map<string, string>();
  entries.set('/', content.pointer.site.publishedAt);
  entries.set('/browse/', content.pointer.sectionsIndex.publishedAt);
  entries.set('/faq/', content.pointer.faq.publishedAt);

  const [faqs, ...productLists] = await Promise.all([
    loadFaqs(context.env.ASSETS_BUCKET, content),
    ...content.sections.map((section) =>
      loadSectionProducts(context.env.ASSETS_BUCKET, content, section),
    ),
  ]);
  for (const article of faqs) {
    entries.set(`/faq/${routePart(article.id)}/`, content.pointer.faq.publishedAt);
  }
  for (const [index, section] of content.sections.entries()) {
    const reference = content.pointer.sections[section.id];
    if (!reference) continue;
    entries.set(
      `/sections/${routePart(section.slug || section.id)}/`,
      reference.publishedAt,
    );
    for (const product of productLists[index] ?? []) {
      entries.set(
        `/sections/${routePart(section.slug || section.id)}/products/${routePart(product.slug || product.id)}/`,
        reference.publishedAt,
      );
    }
  }

  const urls = [...entries.entries()]
    .map(
      ([path, lastModified]) =>
        `  <url><loc>${escapeXml(absoluteUrl(requestUrl.origin, path))}</loc><lastmod>${escapeXml(lastModified)}</lastmod></url>`,
    )
    .join('\n');
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(context.req.method === 'HEAD' ? null : body, {
    headers: {
      'Cache-Control': SEO_CACHE_CONTROL,
      'Content-Type': 'application/xml; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
