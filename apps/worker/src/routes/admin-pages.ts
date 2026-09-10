import { Hono } from 'hono';
import { apiError } from '../http/api-response';
import type { AppEnvironment } from '../types';
import {
  createUpdateH5PublicSettingsStatement,
  getH5PublicSettings,
  normalizeH5PublicOrigin,
} from '../settings/h5-settings';
import {
  hasAdminRequestHeader,
  isRecord,
  jsonBodyError,
  readJsonBody,
} from './admin-section-shared';

const MAX_PAGE_BYTES = 30 * 1024 * 1024;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_FILES = 300;
const MAX_CTAS = 100;

type ManifestFile = { path: string; mimeType: string; byteSize: number };
type ManifestCta = { key: string; label: string; filePath: string; selector: string };
type PageManifest = {
  name: string;
  slug: string;
  files: ManifestFile[];
  ctas: ManifestCta[];
};

function hasControlCharacters(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
}

function validPath(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 512 &&
    !value.includes('\\') &&
    !value.startsWith('/') &&
    !value.split('/').some((part) => part === '' || part === '.' || part === '..') &&
    !hasControlCharacters(value)
  );
}

function parseManifest(value: unknown): PageManifest | null {
  if (!isRecord(value)) return null;
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  const slug = typeof value.slug === 'string' ? value.slug.trim().toLowerCase() : '';
  if (!name || name.length > 120 || !/^[a-z0-9][a-z0-9-]{0,63}$/u.test(slug)) return null;
  if (
    !Array.isArray(value.files) ||
    value.files.length < 1 ||
    value.files.length > MAX_FILES
  )
    return null;
  const files = value.files.map((file) => {
    if (!isRecord(file) || !validPath(file.path) || typeof file.mimeType !== 'string')
      return null;
    const byteSize = Number(file.byteSize);
    return Number.isInteger(byteSize) && byteSize > 0 && byteSize <= MAX_FILE_BYTES
      ? { path: file.path, mimeType: file.mimeType.slice(0, 120), byteSize }
      : null;
  });
  if (files.some((file) => file === null)) return null;
  const normalizedFiles = files.filter((file): file is ManifestFile => file !== null);
  if (new Set(normalizedFiles.map((file) => file.path)).size !== normalizedFiles.length)
    return null;
  if (!normalizedFiles.some((file) => file.path === 'index.html')) return null;
  const ctas = Array.isArray(value.ctas) ? value.ctas : [];
  if (ctas.length > MAX_CTAS) return null;
  const normalizedCtas = ctas.map((cta) => {
    if (
      !isRecord(cta) ||
      typeof cta.key !== 'string' ||
      typeof cta.label !== 'string' ||
      !validPath(cta.filePath) ||
      typeof cta.selector !== 'string'
    )
      return null;
    return {
      key: cta.key.slice(0, 120),
      label: cta.label.trim().slice(0, 200) || 'CTA',
      filePath: cta.filePath,
      selector: cta.selector.slice(0, 500),
    };
  });
  if (normalizedCtas.some((cta) => cta === null)) return null;
  return {
    name,
    slug,
    files: normalizedFiles,
    ctas: normalizedCtas.filter((cta): cta is ManifestCta => cta !== null),
  };
}

function mimeType(path: string, fallback: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  const known: Record<string, string> = {
    html: 'text/html; charset=utf-8',
    css: 'text/css; charset=utf-8',
    js: 'text/javascript; charset=utf-8',
    mjs: 'text/javascript; charset=utf-8',
    json: 'application/json; charset=utf-8',
    svg: 'image/svg+xml',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    ico: 'image/x-icon',
    woff: 'font/woff',
    woff2: 'font/woff2',
    mp4: 'video/mp4',
    webm: 'video/webm',
  };
  return (known[ext ?? ''] ?? fallback.slice(0, 120)) || 'application/octet-stream';
}

export const adminPageRoutes = new Hono<AppEnvironment>();

adminPageRoutes.get('/', async (context) => {
  const configured = await getH5PublicSettings(context.env.DB);
  const h5Origin = configured.publicOrigin;
  const rows = (
    await context.env.DB.prepare(
      `SELECT p.id, p.slug, p.name, p.status, p.published_version_id,
              p.created_at, p.updated_at, v.version_number,
              (SELECT COUNT(*) FROM h5_page_ctas c WHERE c.version_id = v.id) AS cta_count
       FROM h5_pages p
       LEFT JOIN h5_page_versions v ON v.id = p.published_version_id
       WHERE p.deleted_at IS NULL
       ORDER BY p.updated_at DESC, p.name COLLATE NOCASE ASC`,
    ).all<{
      id: string;
      slug: string;
      name: string;
      status: string;
      published_version_id: string | null;
      created_at: string;
      updated_at: string;
      version_number: number | null;
      cta_count: number;
    }>()
  ).results;
  return context.json({
    pages: rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      status: row.status,
      publishedVersionId: row.published_version_id,
      versionNumber: row.version_number,
      ctaCount: row.cta_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      publicUrl: h5Origin ? `${h5Origin}/pages/${row.slug}/` : `/pages/${row.slug}/`,
    })),
  });
});

adminPageRoutes.get('/settings', async (context) => {
  context.header('Cache-Control', 'no-store');
  return context.json({ settings: await getH5PublicSettings(context.env.DB) });
});

adminPageRoutes.put('/settings', async (context) => {
  if (!hasAdminRequestHeader(context))
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  let body: unknown;
  try {
    body = await readJsonBody(context);
  } catch (error) {
    return jsonBodyError(context, error);
  }
  if (!isRecord(body) || !('publicOrigin' in body)) {
    return apiError(context, 400, 'INVALID_H5_PUBLIC_ORIGIN', 'H5 公共域名设置无效。');
  }
  let publicOrigin: string | null;
  try {
    publicOrigin = normalizeH5PublicOrigin(body.publicOrigin);
  } catch (error) {
    return apiError(
      context,
      400,
      'INVALID_H5_PUBLIC_ORIGIN',
      error instanceof Error ? error.message : 'H5 公共域名无效。',
    );
  }
  const updatedAt = new Date().toISOString();
  await context.env.DB.batch([
    createUpdateH5PublicSettingsStatement(context.env.DB, publicOrigin, updatedAt),
  ]);
  return context.json({ settings: { publicOrigin, updatedAt } });
});

adminPageRoutes.get('/:pageId', async (context) => {
  const page = await context.env.DB.prepare(
    `SELECT id, slug, name, status, published_version_id FROM h5_pages WHERE id = ? AND deleted_at IS NULL`,
  )
    .bind(context.req.param('pageId'))
    .first<{
      id: string;
      slug: string;
      name: string;
      status: string;
      published_version_id: string | null;
    }>();
  if (!page) return apiError(context, 404, 'PAGE_NOT_FOUND', '页面不存在。');
  const version = await context.env.DB.prepare(
    `SELECT id, version_number, created_at, published_at FROM h5_page_versions WHERE page_id = ? ORDER BY version_number DESC LIMIT 1`,
  )
    .bind(page.id)
    .first<{
      id: string;
      version_number: number;
      created_at: string;
      published_at: string | null;
    }>();
  if (!version)
    return apiError(context, 404, 'PAGE_VERSION_NOT_FOUND', '页面版本不存在。');
  const ctas = (
    await context.env.DB.prepare(
      `SELECT id, cta_key, label, file_path, selector, section_id, conversion_group_id
       FROM h5_page_ctas WHERE version_id = ? ORDER BY rowid ASC`,
    )
      .bind(version.id)
      .all<{
        id: string;
        cta_key: string;
        label: string;
        file_path: string;
        selector: string;
        section_id: string | null;
        conversion_group_id: string | null;
      }>()
  ).results;
  return context.json({
    page: {
      id: page.id,
      slug: page.slug,
      name: page.name,
      status: page.status,
      publishedVersionId: page.published_version_id,
      versionId: version.id,
      versionNumber: version.version_number,
      createdAt: version.created_at,
      publishedAt: version.published_at,
      ctas: ctas.map((cta) => ({
        id: cta.id,
        key: cta.cta_key,
        label: cta.label,
        filePath: cta.file_path,
        selector: cta.selector,
        sectionId: cta.section_id,
        conversionGroupId: cta.conversion_group_id,
      })),
    },
  });
});

adminPageRoutes.put('/:pageId', async (context) => {
  if (!hasAdminRequestHeader(context))
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  let body: unknown;
  try {
    body = await readJsonBody(context);
  } catch (error) {
    return jsonBodyError(context, error);
  }
  if (
    !isRecord(body) ||
    typeof body.name !== 'string' ||
    !body.name.trim() ||
    body.name.trim().length > 120
  )
    return apiError(
      context,
      400,
      'INVALID_PAGE_NAME',
      '页面名称不能为空且不能超过 120 个字符。',
    );

  const pageId = context.req.param('pageId');
  const page = await context.env.DB.prepare(
    'SELECT id FROM h5_pages WHERE id = ? AND deleted_at IS NULL',
  )
    .bind(pageId)
    .first<{ id: string }>();
  if (!page) return apiError(context, 404, 'PAGE_NOT_FOUND', '页面不存在。');

  await context.env.DB.prepare(
    'UPDATE h5_pages SET name = ?, updated_at = ? WHERE id = ?',
  )
    .bind(body.name.trim(), new Date().toISOString(), pageId)
    .run();
  return context.json({ ok: true });
});

adminPageRoutes.delete('/:pageId', async (context) => {
  if (!hasAdminRequestHeader(context))
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');

  const pageId = context.req.param('pageId');
  const page = await context.env.DB.prepare(
    'SELECT id FROM h5_pages WHERE id = ? AND deleted_at IS NULL',
  )
    .bind(pageId)
    .first<{ id: string }>();
  if (!page) return apiError(context, 404, 'PAGE_NOT_FOUND', '页面不存在。');

  const files = (
    await context.env.DB.prepare(
      `SELECT f.object_key
       FROM h5_page_files f
       INNER JOIN h5_page_versions v ON v.id = f.version_id
       WHERE v.page_id = ?`,
    )
      .bind(pageId)
      .all<{ object_key: string }>()
  ).results;

  // Remove the stored page files before deleting the database record. If storage
  // cleanup fails, the database record is kept so the operation can be retried.
  await Promise.all(
    files.map((file) => context.env.ASSETS_BUCKET.delete(file.object_key)),
  );
  await context.env.DB.prepare('DELETE FROM h5_pages WHERE id = ?').bind(pageId).run();

  return context.json({ ok: true });
});

adminPageRoutes.post('/upload', async (context) => {
  if (!hasAdminRequestHeader(context))
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  let formData: FormData;
  try {
    formData = await context.req.raw.formData();
  } catch {
    return apiError(context, 400, 'INVALID_MULTIPART_FORM', '页面包上传表单无效。');
  }
  const manifestValue = formData.get('manifest');
  if (typeof manifestValue !== 'string')
    return apiError(context, 400, 'INVALID_MANIFEST', '页面包清单无效。');
  let manifest: PageManifest | null = null;
  try {
    manifest = parseManifest(JSON.parse(manifestValue));
  } catch {
    manifest = null;
  }
  if (!manifest)
    return apiError(
      context,
      400,
      'INVALID_MANIFEST',
      '页面包必须包含有效的 index.html 和文件清单。',
    );
  const files = formData
    .getAll('files')
    .filter((value): value is File => value instanceof File);
  if (files.length !== manifest.files.length)
    return apiError(
      context,
      400,
      'FILE_LIST_MISMATCH',
      '页面包文件清单与上传内容不一致。',
    );
  const fileMap = new Map(files.map((file) => [file.name, file]));
  let totalBytes = 0;
  for (const item of manifest.files) {
    const file = fileMap.get(item.path);
    if (!file || file.size !== item.byteSize || file.size > MAX_FILE_BYTES)
      return apiError(context, 400, 'FILE_LIST_MISMATCH', `页面文件无效：${item.path}`);
    totalBytes += file.size;
  }
  if (totalBytes > MAX_PAGE_BYTES)
    return apiError(context, 413, 'PAGE_TOO_LARGE', '页面包不能超过 30 MB。');
  const exists = await context.env.DB.prepare(
    'SELECT id FROM h5_pages WHERE slug = ? AND deleted_at IS NULL',
  )
    .bind(manifest.slug)
    .first<{ id: string }>();
  if (exists)
    return apiError(context, 409, 'PAGE_SLUG_EXISTS', '页面标识已存在，请更换后再上传。');

  const pageId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const now = new Date().toISOString();
  const objectKeys: string[] = [];
  const ctaRows = manifest.ctas.map((cta) => ({ ...cta, id: crypto.randomUUID() }));
  try {
    for (const item of manifest.files) {
      const file = fileMap.get(item.path)!;
      const key = `h5-pages/${pageId}/v1/${item.path}`;
      objectKeys.push(key);
      await context.env.ASSETS_BUCKET.put(key, file.stream(), {
        httpMetadata: { contentType: mimeType(item.path, file.type) },
      });
    }
    const statements = [
      context.env.DB.prepare(
        `INSERT INTO h5_pages (id, slug, name, status, published_version_id, created_at, updated_at) VALUES (?, ?, ?, 'draft', NULL, ?, ?)`,
      ).bind(pageId, manifest.slug, manifest.name, now, now),
      context.env.DB.prepare(
        `INSERT INTO h5_page_versions (id, page_id, version_number, entry_path, manifest_json, created_at) VALUES (?, ?, 1, 'index.html', ?, ?)`,
      ).bind(versionId, pageId, JSON.stringify(manifest), now),
      ...manifest.files.map((item) =>
        context.env.DB.prepare(
          `INSERT INTO h5_page_files (id, version_id, path, object_key, mime_type, byte_size) VALUES (?, ?, ?, ?, ?, ?)`,
        ).bind(
          crypto.randomUUID(),
          versionId,
          item.path,
          `h5-pages/${pageId}/v1/${item.path}`,
          mimeType(item.path, item.mimeType),
          item.byteSize,
        ),
      ),
      ...ctaRows.map((cta) =>
        context.env.DB.prepare(
          `INSERT INTO h5_page_ctas (id, version_id, cta_key, label, file_path, selector, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ).bind(cta.id, versionId, cta.key, cta.label, cta.filePath, cta.selector, now),
      ),
    ];
    await context.env.DB.batch(statements);
  } catch (error) {
    await Promise.all(objectKeys.map((key) => context.env.ASSETS_BUCKET.delete(key)));
    if (error instanceof Error && error.message.includes('UNIQUE'))
      return apiError(
        context,
        409,
        'PAGE_SLUG_EXISTS',
        '页面标识已存在，请更换后再上传。',
      );
    throw error;
  }
  return context.json(
    {
      id: pageId,
      versionId,
      slug: manifest.slug,
      ctas: ctaRows.map((cta) => ({ id: cta.id, key: cta.key, label: cta.label })),
    },
    201,
  );
});

adminPageRoutes.put('/:pageId/ctas', async (context) => {
  if (!hasAdminRequestHeader(context))
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  let body: unknown;
  try {
    body = await readJsonBody(context);
  } catch (error) {
    return jsonBodyError(context, error);
  }
  if (
    !isRecord(body) ||
    typeof body.versionId !== 'string' ||
    !Array.isArray(body.bindings)
  )
    return apiError(context, 400, 'INVALID_CTA_BINDINGS', 'CTA 绑定数据无效。');
  const pageId = context.req.param('pageId');
  const version = await context.env.DB.prepare(
    'SELECT id FROM h5_page_versions WHERE id = ? AND page_id = ?',
  )
    .bind(body.versionId, pageId)
    .first<{ id: string }>();
  if (!version) return apiError(context, 404, 'PAGE_NOT_FOUND', '页面不存在。');
  const bindings = body.bindings;
  const ctas = await context.env.DB.prepare(
    'SELECT id FROM h5_page_ctas WHERE version_id = ?',
  )
    .bind(version.id)
    .all<{ id: string }>();
  const validIds = new Set(ctas.results.map((cta) => cta.id));
  if (
    bindings.length > MAX_CTAS ||
    bindings.some(
      (binding) =>
        !isRecord(binding) ||
        typeof binding.ctaId !== 'string' ||
        !validIds.has(binding.ctaId) ||
        typeof binding.label !== 'string' ||
        !binding.label.trim() ||
        binding.label.trim().length > 200 ||
        !(binding.sectionId === null || typeof binding.sectionId === 'string') ||
        !(
          binding.conversionGroupId === null ||
          typeof binding.conversionGroupId === 'string'
        ),
    )
  )
    return apiError(context, 400, 'INVALID_CTA_BINDINGS', 'CTA 绑定数据无效。');
  const statements = [];
  for (const binding of bindings) {
    if ((binding.sectionId === null) !== (binding.conversionGroupId === null))
      return apiError(
        context,
        400,
        'INVALID_CONVERSION_GROUP',
        '分区和转化池需要同时填写或同时留空。',
      );
    if (binding.sectionId && binding.conversionGroupId) {
      const validGroup = await context.env.DB.prepare(
        'SELECT id FROM conversion_groups WHERE section_id = ? AND id = ? AND deleted_at IS NULL AND is_enabled = 1',
      )
        .bind(binding.sectionId, binding.conversionGroupId)
        .first<{ id: string }>();
      if (!validGroup)
        return apiError(
          context,
          400,
          'INVALID_CONVERSION_GROUP',
          '所选转化池不存在或未启用。',
        );
    }
    statements.push(
      context.env.DB.prepare(
        'UPDATE h5_page_ctas SET label = ?, section_id = ?, conversion_group_id = ? WHERE id = ? AND version_id = ?',
      ).bind(
        binding.label.trim(),
        binding.sectionId,
        binding.conversionGroupId,
        binding.ctaId,
        version.id,
      ),
    );
  }
  if (statements.length) await context.env.DB.batch(statements);
  return context.json({ ok: true });
});

adminPageRoutes.post('/:pageId/publish', async (context) => {
  if (!hasAdminRequestHeader(context))
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  const pageId = context.req.param('pageId');
  const row = await context.env.DB.prepare(
    'SELECT v.id, v.version_number FROM h5_page_versions v WHERE v.page_id = ? ORDER BY v.version_number DESC LIMIT 1',
  )
    .bind(pageId)
    .first<{ id: string; version_number: number }>();
  if (!row) return apiError(context, 404, 'PAGE_NOT_FOUND', '页面不存在。');
  const now = new Date().toISOString();
  await context.env.DB.batch([
    context.env.DB.prepare(
      `UPDATE h5_pages SET status = 'published', published_version_id = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
    ).bind(row.id, now, pageId),
    context.env.DB.prepare(
      'UPDATE h5_page_versions SET published_at = ? WHERE id = ?',
    ).bind(now, row.id),
  ]);
  return context.json({ ok: true, versionId: row.id, versionNumber: row.version_number });
});

adminPageRoutes.post('/:pageId/archive', async (context) => {
  if (!hasAdminRequestHeader(context))
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  await context.env.DB.prepare(
    `UPDATE h5_pages SET status = 'archived', updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
  )
    .bind(new Date().toISOString(), context.req.param('pageId'))
    .run();
  return context.json({ ok: true });
});
