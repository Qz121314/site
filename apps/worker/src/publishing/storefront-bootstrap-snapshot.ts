const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';
const BOOTSTRAP_PREFIX = 'public/bootstrap';
const BOOTSTRAP_SCHEMA_VERSION = 4;

type JsonRecord = Record<string, unknown>;

type MessageArticleMetadata = {
  articleId: string;
  title: string;
  preview: string;
  backgroundObjectKey: string | null;
  sortOrder: number;
};

export type StorefrontPublishedBootstrapSnapshot = {
  site: JsonRecord;
  sectionsIndex: JsonRecord;
  home: JsonRecord;
  runtime: JsonRecord;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validPointerVersion(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 12 &&
    value.length <= 180 &&
    /^[A-Za-z0-9-]+$/u.test(value)
  );
}

function publishedFile(reference: unknown, fileName: string): string | null {
  if (!isRecord(reference) || typeof reference.manifestKey !== 'string') return null;
  const manifestKey = reference.manifestKey;
  if (
    !/^public\/modules\/[A-Za-z0-9._/-]+\/manifest\.json$/u.test(manifestKey) ||
    manifestKey.includes('..')
  ) {
    return null;
  }
  return manifestKey.replace(/manifest\.json$/u, fileName);
}

async function readPublishedJson(bucket: R2Bucket, key: string): Promise<unknown | null> {
  const object = await bucket.get(key);
  if (!object) return null;
  try {
    return JSON.parse(await object.text()) as unknown;
  } catch {
    return null;
  }
}

function sanitizeMessageArticles(value: unknown): MessageArticleMetadata[] {
  if (!Array.isArray(value)) return [];
  const articles: MessageArticleMetadata[] = [];
  for (const item of value) {
    if (
      !isRecord(item) ||
      typeof item.articleId !== 'string' ||
      typeof item.title !== 'string' ||
      typeof item.preview !== 'string' ||
      typeof item.sortOrder !== 'number' ||
      !Number.isInteger(item.sortOrder)
    ) {
      continue;
    }
    articles.push({
      articleId: item.articleId,
      title: item.title,
      preview: item.preview,
      backgroundObjectKey:
        typeof item.backgroundObjectKey === 'string' ? item.backgroundObjectKey : null,
      sortOrder: item.sortOrder,
    });
  }
  return articles;
}

function attachMessageArticles(siteEnvelope: JsonRecord, messages: unknown): JsonRecord {
  const site = isRecord(siteEnvelope.site) ? siteEnvelope.site : null;
  if (!site) return siteEnvelope;
  const navigation = isRecord(site.navigation) ? site.navigation : {};
  const messageArticles =
    isRecord(messages) && Array.isArray(messages.articles)
      ? sanitizeMessageArticles(messages.articles)
      : [];
  return {
    ...siteEnvelope,
    site: {
      ...site,
      navigation: {
        ...navigation,
        messageArticles,
      },
    },
  };
}

function sanitizeCachedSiteEnvelope(siteEnvelope: JsonRecord): JsonRecord | null {
  const site = isRecord(siteEnvelope.site) ? siteEnvelope.site : null;
  const navigation = site && isRecord(site.navigation) ? site.navigation : null;
  if (!navigation || !Array.isArray(navigation.messageArticles)) return null;
  return attachMessageArticles(siteEnvelope, { articles: navigation.messageArticles });
}

function runtimeFromSiteEnvelope(siteEnvelope: JsonRecord): JsonRecord | null {
  const site = isRecord(siteEnvelope.site) ? siteEnvelope.site : null;
  const runtime = site && isRecord(site.runtime) ? site.runtime : null;
  if (
    !runtime ||
    !(typeof runtime.mediaBaseUrl === 'string' || runtime.mediaBaseUrl === null) ||
    !isRecord(runtime.theme) ||
    !Array.isArray(runtime.bottomNavigation)
  ) {
    return null;
  }
  return runtime;
}

export function storefrontBootstrapSnapshotKey(pointerVersion: string): string {
  return `${BOOTSTRAP_PREFIX}/${encodeURIComponent(pointerVersion)}/bootstrap.json`;
}

function parseBootstrapSnapshot(
  value: unknown,
  pointerVersion: string,
): StorefrontPublishedBootstrapSnapshot | null {
  if (
    !isRecord(value) ||
    value.schemaVersion !== BOOTSTRAP_SCHEMA_VERSION ||
    value.pointerVersion !== pointerVersion ||
    !isRecord(value.site) ||
    !isRecord(value.sectionsIndex) ||
    !isRecord(value.home)
  ) {
    return null;
  }
  const site = sanitizeCachedSiteEnvelope(value.site);
  const runtime = site ? runtimeFromSiteEnvelope(site) : null;
  if (!site || !runtime) return null;
  return {
    site,
    sectionsIndex: value.sectionsIndex,
    home: value.home,
    runtime,
  };
}

export async function writeStorefrontPublishedBootstrap(
  bucket: R2Bucket,
  pointerValue: unknown,
): Promise<void> {
  if (!isRecord(pointerValue) || !validPointerVersion(pointerValue.contentVersion)) {
    throw new Error('Invalid published bootstrap pointer.');
  }
  const pointerVersion = pointerValue.contentVersion;
  const sitePath = publishedFile(pointerValue.site, 'site.json');
  const sectionsPath = publishedFile(pointerValue.sectionsIndex, 'sections.json');
  const messageArticlesPath = publishedFile(pointerValue.faq, 'messages.json');
  if (!sitePath || !sectionsPath)
    throw new Error('Published bootstrap modules are incomplete.');
  const [rawSite, sectionsIndex, home, messages] = await Promise.all([
    readPublishedJson(bucket, sitePath),
    readPublishedJson(bucket, sectionsPath),
    readPublishedJson(bucket, `public/home/${pointerVersion}/home.json`),
    messageArticlesPath ? readPublishedJson(bucket, messageArticlesPath) : null,
  ]);
  if (!isRecord(rawSite) || !isRecord(sectionsIndex) || !isRecord(home)) {
    throw new Error('Published bootstrap artifacts are incomplete.');
  }
  const site = attachMessageArticles(rawSite, messages);
  if (!runtimeFromSiteEnvelope(site))
    throw new Error('Published bootstrap runtime is incomplete.');
  await bucket.put(
    storefrontBootstrapSnapshotKey(pointerVersion),
    JSON.stringify({
      schemaVersion: BOOTSTRAP_SCHEMA_VERSION,
      pointerVersion,
      site,
      sectionsIndex,
      home,
    }),
    {
      httpMetadata: {
        contentType: 'application/json; charset=utf-8',
        cacheControl: IMMUTABLE_CACHE,
      },
    },
  );
}

export async function loadStorefrontPublishedBootstrap(
  bucket: R2Bucket,
  pointerValue: unknown,
): Promise<StorefrontPublishedBootstrapSnapshot | null> {
  if (
    !isRecord(pointerValue) ||
    pointerValue.schemaVersion !== 2 ||
    !validPointerVersion(pointerValue.contentVersion)
  ) {
    return null;
  }

  return parseBootstrapSnapshot(
    await readPublishedJson(
      bucket,
      storefrontBootstrapSnapshotKey(pointerValue.contentVersion),
    ),
    pointerValue.contentVersion,
  );
}
