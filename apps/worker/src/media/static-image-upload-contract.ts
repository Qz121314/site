export const STATIC_IMAGE_COMPRESSION_PROFILE = 'browser-static-image-v1';

const STATIC_IMAGE_SOURCE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const STATIC_IMAGE_OUTPUT_TYPES = new Set(['image/jpeg', 'image/webp']);

export type StaticImageUploadContractInput = {
  mimeType: string;
  compressionProfile: string | null;
  sourceByteSize: number | null;
};

export type StaticImageUploadContractError = {
  code: 'MEDIA_COMPRESSION_REQUIRED';
  message: string;
} | null;

export function validateStaticImageUploadContract(
  input: StaticImageUploadContractInput,
): StaticImageUploadContractError {
  const mimeType = input.mimeType.toLowerCase();
  if (!STATIC_IMAGE_SOURCE_TYPES.has(mimeType)) return null;

  if (
    input.compressionProfile !== STATIC_IMAGE_COMPRESSION_PROFILE ||
    !STATIC_IMAGE_OUTPUT_TYPES.has(mimeType) ||
    !Number.isInteger(input.sourceByteSize) ||
    (input.sourceByteSize ?? 0) <= 0
  ) {
    return {
      code: 'MEDIA_COMPRESSION_REQUIRED',
      message: '静态图片必须先在浏览器压缩，原图不会上传到 R2。',
    };
  }

  return null;
}
