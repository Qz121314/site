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

type ImageTransformRequestInit = RequestInit & {
  cf: {
    image: {
      width: number;
      height: number;
      fit: 'scale-down';
      anim: false;
      metadata: 'none';
      format: 'webp';
      quality: number;
    };
  };
};

const BRANDING_IMAGE_COMPRESSION_PROFILE = 'browser-branding-image-v1';
const ADMIN_THUMBNAIL_SIZE = 240;
const ADMIN_THUMBNAIL_QUALITY = 72;
const THUMBNAIL_TOKEN_NAMESPACE = 'admin-media-thumbnail-source:v1:';

export const adminBrandingMediaRoutes = new Hono<AppEnvironment>();
export const adminMediaThumbnailSourceRoutes = new Hono<AppEnvironment>();

function thumbnailSecret(env: AppEnvironment['Bindings']): string | null {
  const secret = env.SESSION_SECRET?.trim();
  return secret ? secret : null;
}

async function signThumbnailSource(secret: string, assetId: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(`${THUMBNAIL_TOKEN_NAMESPACE}${assetId}`),
    ),
  );
  return Array.from(signature, (value) => value.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

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

adminMediaThumbnailSourceRoutes.get('/:id/:token', async (context) => {
  const via = context.req.header('via') ?? '';
  const secret = thumbnailSecret(context.env);
  if (!/image-resizing/i.test(via) || !secret) {
    return new Response(null, { status: 404 });
  }

  const assetId = context.req.param('id');
  const expectedToken = await signThumbnailSource(secret, assetId);
  if (!constantTimeEqual(context.req.param('token'), expectedToken)) {
    return new Response(null, { status: 404 });
  }

  const asset = await loadImageAsset(context.env.DB, assetId);
  if (!asset) return new Response(null, { status: 404 });

  const object = await context.env.ASSETS_BUCKET.get(asset.object_key);
  if (!object) return new Response(null, { status: 404 });

  return new Response(object.body, {
    headers: {
      'content-type': object.httpMetadata?.contentType ?? asset.mime_type,
      'cache-control': 'public, max-age=86400, immutable',
      etag: object.httpEtag,
    },
  });
});

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
  const secret = thumbnailSecret(context.env);
  if (!secret) {
    return apiError(
      context,
      503,
      'MEDIA_THUMBNAIL_UNAVAILABLE',
      '后台缩略图服务暂不可用。',
    );
  }

  const assetId = context.req.param('id');
  const token = await signThumbnailSource(secret, assetId);
  const sourceUrl = new URL(
    `/__admin-media-thumbnail-source/${encodeURIComponent(assetId)}/${token}`,
    context.req.url,
  );

  const transformed = await fetch(sourceUrl, {
    cf: {
      image: {
        width: ADMIN_THUMBNAIL_SIZE,
        height: ADMIN_THUMBNAIL_SIZE,
        fit: 'scale-down',
        anim: false,
        metadata: 'none',
        format: 'webp',
        quality: ADMIN_THUMBNAIL_QUALITY,
      },
    },
  } as ImageTransformRequestInit);

  if (!transformed.ok) {
    if (transformed.status === 404) {
      return apiError(context, 404, 'MEDIA_ASSET_NOT_FOUND', '图片素材不存在或已删除。');
    }
    return apiError(context, 502, 'MEDIA_THUMBNAIL_FAILED', '后台缩略图生成失败。');
  }

  const headers = new Headers();
  headers.set('content-type', transformed.headers.get('content-type') ?? 'image/webp');
  headers.set('cache-control', 'private, max-age=3600');
  const etag = transformed.headers.get('etag');
  if (etag) headers.set('etag', etag);

  return new Response(transformed.body, { headers });
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
