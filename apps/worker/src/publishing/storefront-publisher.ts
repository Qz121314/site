import {
  getModularPublishStatus,
  ModularPublicationError,
  normalizePublishModuleKey,
  publishModularStorefront as publishCore,
  readModularPointer,
  rollbackModularModule as rollbackCore,
  type ModularPublishResult,
  type ModularStorefrontPointer,
  type ModuleReference,
  type PublishModuleVersion,
} from './modular-publisher';

const DERIVED_HOME_PREFIX = 'public/home';
const DERIVED_SEARCH_PREFIX = 'public/search';
const DERIVED_SNAPSHOT_RETENTION = 3;
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';

type DerivedProductSummary = {
  id: string;
  slug: string;
  sectionId: string;
  title: string;
  serviceMode: 'online' | 'offline';
  address: string | null;
  category: { id: string | null; name: string | null };
  tags: Array<{ id: string; name: string; sortOrder: number }>;
  coverObjectKey: string | null;
  isFeatured: boolean;
  featuredOrder: number;
  publishedAt: string | null;
  sortOrder: number;
};

type SectionSnapshotEnvelope = {
  schemaVersion: 2;
  moduleKey: string;
  contentVersion: string;
  publishedAt: string;
  sectionId: string;
  products: DerivedProductSummary[];
};

type DerivedSnapshotSource = {
  pointer: ModularStorefrontPointer;
  products: DerivedProductSummary[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sectionSnapshotKey(sectionId: string, reference: ModuleReference): string {
  return `public/modules/sections/${encodeURIComponent(sectionId)}/${reference.contentVersion}/section.json`;
}

async function readSectionProducts(
  bucket: R2Bucket,
  sectionId: string,
  reference: ModuleReference,
): Promise<DerivedProductSummary[]> {
  const object = await bucket.get(sectionSnapshotKey(sectionId, reference));
  if (!object) {
    throw new Error(`Published section snapshot is missing for ${sectionId}.`);
  }
  const value = JSON.parse(await object.text()) as unknown;
  const moduleKey = `section:${sectionId}`;
  if (
    !isRecord(value) ||
    value.schemaVersion !== 2 ||
    value.moduleKey !== moduleKey ||
    value.contentVersion !== reference.contentVersion ||
    value.sectionId !== sectionId ||
    !Array.isArray(value.products)
  ) {
    throw new Error(`Published section snapshot is inconsistent for ${sectionId}.`);
  }
  return (value as SectionSnapshotEnvelope).products;
}

async function readDerivedSnapshotSource(
  bucket: R2Bucket,
): Promise<DerivedSnapshotSource | null> {
  const { pointer } = await readModularPointer(bucket);
  if (!pointer) return null;

  const products = (
    await Promise.all(
      Object.entries(pointer.sections).map(([sectionId, reference]) =>
        readSectionProducts(bucket, sectionId, reference),
      ),
    )
  ).flat();

  return { pointer, products };
}

async function pruneDerivedSnapshots(
  bucket: R2Bucket,
  prefix: string,
  fileName: string,
  currentKey: string,
): Promise<void> {
  const listed = await bucket.list({ prefix: `${prefix}/`, limit: 1000 });
  const snapshots = listed.objects
    .filter((object) => object.key.endsWith(`/${fileName}`))
    .sort((left, right) => right.uploaded.getTime() - left.uploaded.getTime());
  const stale = snapshots
    .filter((object) => object.key !== currentKey)
    .slice(Math.max(0, DERIVED_SNAPSHOT_RETENTION - 1));
  if (stale.length > 0) {
    await bucket.delete(stale.map((object) => object.key));
  }
}

async function writeDerivedHomeSnapshot(
  bucket: R2Bucket,
  source: DerivedSnapshotSource,
): Promise<string> {
  const { pointer, products } = source;
  const featuredProducts = products
    .filter((product) => product.isFeatured)
    .sort(
      (left, right) =>
        left.featuredOrder - right.featuredOrder || left.sortOrder - right.sortOrder,
    )
    .slice(0, 30);
  const latestProducts = [...products]
    .sort((left, right) =>
      (right.publishedAt ?? '').localeCompare(left.publishedAt ?? ''),
    )
    .slice(0, 30);

  const key = `${DERIVED_HOME_PREFIX}/${pointer.contentVersion}/home.json`;
  await bucket.put(
    key,
    JSON.stringify({
      schemaVersion: 2,
      pointerVersion: pointer.contentVersion,
      publishedAt: pointer.publishedAt,
      featuredProducts,
      latestProducts,
    }),
    {
      httpMetadata: {
        contentType: 'application/json; charset=utf-8',
        cacheControl: IMMUTABLE_CACHE,
      },
      customMetadata: { pointerVersion: pointer.contentVersion, kind: 'derived-home' },
    },
  );

  try {
    await pruneDerivedSnapshots(bucket, DERIVED_HOME_PREFIX, 'home.json', key);
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'storefront.derived_home_retention_failed',
        errorName: error instanceof Error ? error.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : 'Unknown retention error',
      }),
    );
  }
  return key;
}

async function writeDerivedSearchSnapshot(
  bucket: R2Bucket,
  source: DerivedSnapshotSource,
): Promise<string> {
  const { pointer, products } = source;
  const key = `${DERIVED_SEARCH_PREFIX}/${pointer.contentVersion}/search.json`;
  await bucket.put(
    key,
    JSON.stringify({
      schemaVersion: 2,
      pointerVersion: pointer.contentVersion,
      publishedAt: pointer.publishedAt,
      products,
    }),
    {
      httpMetadata: {
        contentType: 'application/json; charset=utf-8',
        cacheControl: IMMUTABLE_CACHE,
      },
      customMetadata: { pointerVersion: pointer.contentVersion, kind: 'derived-search' },
    },
  );

  try {
    await pruneDerivedSnapshots(bucket, DERIVED_SEARCH_PREFIX, 'search.json', key);
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'storefront.derived_search_retention_failed',
        errorName: error instanceof Error ? error.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : 'Unknown retention error',
      }),
    );
  }
  return key;
}

export async function materializeDerivedHomeSnapshot(
  bucket: R2Bucket,
): Promise<string | null> {
  const source = await readDerivedSnapshotSource(bucket);
  return source ? writeDerivedHomeSnapshot(bucket, source) : null;
}

export async function materializeDerivedSearchSnapshot(
  bucket: R2Bucket,
): Promise<string | null> {
  const source = await readDerivedSnapshotSource(bucket);
  return source ? writeDerivedSearchSnapshot(bucket, source) : null;
}

async function materializeDerivedSnapshots(bucket: R2Bucket): Promise<void> {
  const source = await readDerivedSnapshotSource(bucket);
  if (!source) return;
  await Promise.all([
    writeDerivedHomeSnapshot(bucket, source),
    writeDerivedSearchSnapshot(bucket, source),
  ]);
}

async function refreshDerivedSnapshotsBestEffort(bucket: R2Bucket): Promise<void> {
  try {
    await materializeDerivedSnapshots(bucket);
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'storefront.derived_snapshots_failed',
        errorName: error instanceof Error ? error.name : 'UnknownError',
        errorMessage:
          error instanceof Error ? error.message : 'Unknown derived-snapshot error',
      }),
    );
  }
}

export async function publishModularStorefront(
  db: D1Database,
  bucket: R2Bucket,
  requestId: string,
  requestedModuleKey: string = 'all',
): Promise<ModularPublishResult> {
  const result = await publishCore(db, bucket, requestId, requestedModuleKey);
  await refreshDerivedSnapshotsBestEffort(bucket);
  return result;
}

export async function rollbackModularModule(
  db: D1Database,
  bucket: R2Bucket,
  moduleKey: string,
  contentVersion: string,
  requestId: string,
): Promise<PublishModuleVersion> {
  const result = await rollbackCore(db, bucket, moduleKey, contentVersion, requestId);
  await refreshDerivedSnapshotsBestEffort(bucket);
  return result;
}

export { getModularPublishStatus, ModularPublicationError, normalizePublishModuleKey };
