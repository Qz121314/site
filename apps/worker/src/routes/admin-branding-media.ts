import { Hono } from 'hono';
import { writeAuditLog } from '../audit/write-audit-log';
import { apiError } from '../http/api-response';
import {
  uploadBrandingImage,
  type BrandingImageKind,
} from '../media/branding-image-upload';
import type { AppEnvironment } from '../types';
import { hasAdminRequestHeader } from './admin-section-shared';

export const adminBrandingMediaRoutes = new Hono<AppEnvironment>();

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
  if (kindValue !== 'logo' && kindValue !== 'section-icon') {
    return apiError(context, 400, 'BRANDING_KIND_INVALID', '图片用途无效。', { field: 'kind' });
  }
  if (!(file instanceof File)) {
    return apiError(context, 400, 'IMAGE_REQUIRED', '请选择需要上传的图片。', { field: 'file' });
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

  await writeAuditLog(context.env.DB, {
    action: result.reused ? 'branding_media.reused' : 'branding_media.uploaded',
    entityType: 'media_asset',
    entityId: result.media.id,
    requestId: context.get('requestId'),
    metadata: {
      kind,
      objectKey: result.media.objectKey,
      byteSize: result.media.byteSize,
      width: result.media.width,
      height: result.media.height,
      reused: result.reused,
    },
  });

  return context.json({ media: result.media, reused: result.reused }, result.reused ? 200 : 201);
});
