import type { PreparedSupportImage } from './support-image-compress';

export type SupportUploadTarget = {
  mode: 'direct' | 'proxy';
  url: string;
  headers: Record<string, string>;
};

export function uploadSupportImage(
  target: SupportUploadTarget,
  image: PreparedSupportImage,
  onProgress?: (progress: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', target.url, true);
    for (const [name, value] of Object.entries(target.headers)) {
      xhr.setRequestHeader(name, value);
    }
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress?.(Math.min(1, event.loaded / event.total));
      }
    });
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1);
        resolve();
      } else {
        reject(new Error(`Image upload failed (${xhr.status}).`));
      }
    });
    xhr.addEventListener('error', () => reject(new Error('Image upload failed.')));
    xhr.addEventListener('abort', () => reject(new Error('Image upload was cancelled.')));
    xhr.send(image.blob);
  });
}
