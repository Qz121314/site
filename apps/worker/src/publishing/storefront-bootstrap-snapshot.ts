const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';
const BOOTSTRAP_PREFIX = 'public/bootstrap';

type JsonRecord = Record<string, unknown>;

export type StorefrontPublishedBootstrapSnapshot = {
  site: JsonRecord;
  sectionsIndex: JsonRecord;
  home: JsonRecord;
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

export function storefrontBootstrapSnapshotKey(pointerVersion: string): string {
  return `${BOOTSTRAP_PREFIX}/${encodeURIComponent(pointerVersion)}/bootstrap.json`;
}

function parseBootstrapSnapshot(
  value: unknown,
  pointerVersion: string,
): StorefrontPublishedBootstrapSnapshot | null {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    value.pointerVersion !== pointerVersion ||
    !isRecord(value.site) ||
    !isRecord(value.sectionsIndex) ||
    !isRecord(value.home)
  ) {
    return null;
  }
  return {
    site: value.site,
    sectionsIndex: value.sectionsIndex,
    home: value.home,
  };
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

  const pointerVersion = pointerValue.contentVersion;
  const snapshotKey = storefrontBootstrapSnapshotKey(pointerVersion);
  const cached = parseBootstrapSnapshot(
    await readPublishedJson(bucket, snapshotKey),
    pointerVersion,
  );
  if (cached) return cached;

  const sitePath = publishedFile(pointerValue.site, 'site.json');
  const sectionsPath = publishedFile(pointerValue.sectionsIndex, 'sections.json');
  if (!sitePath || !sectionsPath) return null;

  const [site, sectionsIndex, home] = await Promise.all([
    readPublishedJson(bucket, sitePath),
    readPublishedJson(bucket, sectionsPath),
    readPublishedJson(bucket, `public/home/${pointerVersion}/home.json`),
  ]);
  if (!isRecord(site) || !isRecord(sectionsIndex) || !isRecord(home)) return null;

  const snapshot: StorefrontPublishedBootstrapSnapshot = {
    site,
    sectionsIndex,
    home,
  };
  try {
    await bucket.put(
      snapshotKey,
      JSON.stringify({
        schemaVersion: 1,
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
        customMetadata: { pointerVersion, kind: 'storefront-bootstrap' },
      },
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'storefront.bootstrap_snapshot_write_failed',
        pointerVersion,
        errorName: error instanceof Error ? error.name : 'UnknownError',
        errorMessage:
          error instanceof Error ? error.message : 'Unknown bootstrap snapshot error',
      }),
    );
  }

  return snapshot;
}
