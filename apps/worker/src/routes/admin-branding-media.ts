import { Hono } from 'hono';
import { writeAuditLog } from '../audit/write-audit-log';
import { apiError } from '../http/api-response';
import {
  uploadBrandingImage,
  type BrandingImageKind,
} from '../media/branding-image-upload';
import type { AppEnvironment } from '../types';
import { hasAdminRequestHeader } from './admin-section-shared';

type MediaPreviewRow = {
  object_key: string;
  mime_type: string;
};

const BRANDING_IMAGE_COMPRESSION_PROFILE = 'browser-branding-image-v1';
const ADMIN_THUMBNAIL_SIZE = 240;
const ADMIN_THUMBNAIL_QUALITY = 72;

export const adminBrandingMediaRoutes = new Hono<AppEnvironment>();

async function loadImageAsset(
  db: AppEnvironment['Bindings']['DB'],
  assetId: string,
): Promise<MediaPreviewRow | null> {
  return db
    .prepare(
      `SELECT object_key, mime_type
         FROM media_assets
         WHERE id = ?
           AND status = 'ready'
           AND deleted_at IS NULL
           AND mime_type LIKE 'image/%'`,
    )
    .bind(assetId)
    .first<MediaPreviewRow>();
}

adminBrandingMediaRoutes.get('/assets/:id', async (context) => {
  const asset = await loadImageAsset(context.env.DB, context.req.param('id'));
  if (!asset) {
    return apiError(context, 404, 'MEDIA_ASSET_NOT_FOUND', '图片素材不存在或已删除。');
  }

  const object = await context.env.ASSETS_BUCKET.get(asset.object_key);
  if (!object) {
    return apiError(context, 404, 'R2_OBJECT_NOT_FOUND', 'R2 中不存在对应图片对象。');
  }

  return new Response(object.body, {
    headers: {
      'content-type': object.httpMetadata?.contentType ?? asset.mime_type,
      'cache-control': 'private, max-age=300',
      etag: object.httpEtag,
    },
  });
});

adminBrandingMediaRoutes.get('/assets/:id/thumbnail', async (context) => {
  const assetId = context.req.param('id');
  const asset = await loadImageAsset(context.env.DB, assetId);
  if (!asset) {
    return apiError(context, 404, 'MEDIA_ASSET_NOT_FOUND', '图片素材不存在或已删除。');
  }

  const object = await context.env.ASSETS_BUCKET.get(asset.object_key);
  if (!object) {
    return apiError(context, 404, 'R2_OBJECT_NOT_FOUND', 'R2 中不存在对应图片对象。');
  }

  try {
    const transformed = (
      await context.env.IMAGES.input(object.body)
        .transform({
          width: ADMIN_THUMBNAIL_SIZE,
          height: ADMIN_THUMBNAIL_SIZE,
          fit: 'scale-down',
        })
        .output({
          format: 'image/webp',
          quality: ADMIN_THUMBNAIL_QUALITY,
          anim: false,
        })
    ).response();

    const headers = new Headers(transformed.headers);
    headers.set('content-type', transformed.headers.get('content-type') ?? 'image/webp');
    headers.set('cache-control', 'private, max-age=3600');

    return new Response(transformed.body, {
      status: transformed.status,
      statusText: transformed.statusText,
      headers,
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'admin.media_thumbnail_failed',
        assetId,
        errorName: error instanceof Error ? error.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : 'Unknown thumbnail error',
      }),
    );
    return apiError(context, 502, 'MEDIA_THUMBNAIL_FAILED', '后台缩略图生成失败。');
  }
});

adminBrandingMediaRoutes.post('/branding', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }

  let formData: FormData;
  try {
    formData = await context.req.raw.formData();
  } catch {
    return apiError(context, 400, 'INVALID_MULTIPART_FORM', '图片上传表单无效。');
  }

  const kindValue = formData.get('kind');
  const file = formData.get('file');
  const compressionProfile = formData.get('compressionProfile');
  if (kindValue !== 'logo' && kindValue !== 'section-icon') {
    return apiError(context, 400, 'BRANDING_KIND_INVALID', '图片用途无效。', {
      field: 'kind',
    });
  }
  if (!(file instanceof File)) {
    return apiError(context, 400, 'IMAGE_REQUIRED', '请选择需要上传的图片。', {
      field: 'file',
    });
  }
  if (compressionProfile !== BRANDING_IMAGE_COMPRESSION_PROFILE) {
    return apiError(
      context,
      400,
      'BRANDING_COMPRESSION_REQUIRED',
      'Logo 和分区图标必须先在浏览器压缩，原图不会上传到 R2。',
      { field: 'file' },
    );
  }

  const kind: BrandingImageKind = kindValue;
  const result = await uploadBrandingImage(
    context.env.ASSETS_BUCKET,
    context.env.DB,
    kind,
    file,
  );
  if (!result.ok) {
    return apiError(context, 400, result.code, result.message, { field: result.field });
  }

  const role = kind === 'logo' ? 'logo' : 'icon';
  await context.env.DB.prepare(
    `INSERT INTO media_asset_roles (media_asset_id, role, created_at)
       VALUES (?, ?, ?)
       ON CONFLICT(media_asset_id, role) DO NOTHING`,
  )
    .bind(result.media.id, role, new Date().toISOString())
    .run();

  await writeAuditLog(context.env.DB, {
    action: result.reused ? 'branding_media.reused' : 'branding_media.uploaded',
    entityType: 'media_asset',
    entityId: result.media.id,
    requestId: context.get('requestId'),
    metadata: {
      kind,
      mediaRole: role,
      objectKey: result.media.objectKey,
      byteSize: result.media.byteSize,
      width: result.media.width,
      height: result.media.height,
      compressionProfile,
      reused: result.reused,
    },
  });

  return context.json(
    { media: result.media, reused: result.reused },
    result.reused ? 200 : 201,
  );
});
