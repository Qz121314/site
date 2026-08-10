import { useCallback, useMemo, useRef, useState } from 'react';
import { AdminApiError } from '../api';
import { uploadMediaAsset, type MediaRole } from './api';

export type MediaUploadQueueStatus =
  'queued' | 'processing' | 'uploaded' | 'reused' | 'error';

export type MediaUploadQueueItem = {
  id: string;
  file: File;
  fileName: string;
  byteSize: number;
  role: MediaRole;
  folderId: string | null;
  status: MediaUploadQueueStatus;
  message: string | null;
};

export type MediaUploadBatchSummary = {
  total: number;
  uploaded: number;
  reused: number;
  failed: number;
  skipped: number;
};

type UseMediaUploadQueueOptions = {
  onSessionExpired: () => void;
  onBatchComplete: () => void | Promise<void>;
};

const MAX_CONCURRENCY = 3;
const SUPPORTED_MEDIA_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
]);

const EMPTY_BATCH_SUMMARY: MediaUploadBatchSummary = {
  total: 0,
  uploaded: 0,
  reused: 0,
  failed: 0,
  skipped: 0,
};

function isSessionError(error: unknown): boolean {
  return (
    error instanceof AdminApiError &&
    (error.status === 401 || error.code === 'SESSION_INVALID')
  );
}

function inspectVideo(
  file: File,
): Promise<{ width: number; height: number; durationMs: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.onloadedmetadata = () => {
      const width = video.videoWidth;
      const height = video.videoHeight;
      const durationMs = Number.isFinite(video.duration)
        ? Math.round(video.duration * 1000)
        : 0;
      URL.revokeObjectURL(url);
      if (width < 1 || height < 1) {
        reject(new Error(`无法读取视频“${file.name}”的尺寸。`));
        return;
      }
      resolve({ width, height, durationMs });
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`无法读取视频“${file.name}”。`));
    };
    video.src = url;
  });
}

export function useMediaUploadQueue({
  onSessionExpired,
  onBatchComplete,
}: UseMediaUploadQueueOptions) {
  const [items, setItems] = useState<MediaUploadQueueItem[]>([]);
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);
  const callbacksRef = useRef({ onSessionExpired, onBatchComplete });
  callbacksRef.current = { onSessionExpired, onBatchComplete };

  const patchItem = useCallback(
    (id: string, patch: Partial<Pick<MediaUploadQueueItem, 'status' | 'message'>>) => {
      setItems((current) =>
        current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      );
    },
    [],
  );

  const runEntries = useCallback(
    async (
      entries: MediaUploadQueueItem[],
      skipped: number,
    ): Promise<MediaUploadBatchSummary> => {
      if (entries.length === 0) {
        return { ...EMPTY_BATCH_SUMMARY, skipped };
      }
      if (runningRef.current) return EMPTY_BATCH_SUMMARY;

      runningRef.current = true;
      setRunning(true);
      let nextIndex = 0;
      let uploaded = 0;
      let reused = 0;
      let failed = 0;
      let sessionExpired = false;

      const worker = async () => {
        while (!sessionExpired) {
          const index = nextIndex;
          nextIndex += 1;
          const entry = entries[index];
          if (!entry) return;

          patchItem(entry.id, { status: 'processing', message: null });
          try {
            const isVideo =
              entry.file.type === 'video/mp4' || entry.file.type === 'video/webm';
            const metadata = isVideo ? await inspectVideo(entry.file) : null;
            const result = await uploadMediaAsset({
              file: entry.file,
              role: entry.role,
              folderId: entry.folderId,
              width: metadata?.width,
              height: metadata?.height,
              durationMs: metadata?.durationMs,
            });
            if (result.reused) {
              reused += 1;
              patchItem(entry.id, { status: 'reused', message: '已复用现有素材' });
            } else {
              uploaded += 1;
              patchItem(entry.id, { status: 'uploaded', message: '上传完成' });
            }
          } catch (error) {
            failed += 1;
            if (isSessionError(error)) {
              sessionExpired = true;
              callbacksRef.current.onSessionExpired();
            }
            patchItem(entry.id, {
              status: 'error',
              message: error instanceof Error ? error.message : '素材处理失败。',
            });
          }
        }
      };

      try {
        const concurrency = Math.min(MAX_CONCURRENCY, entries.length);
        await Promise.all(Array.from({ length: concurrency }, () => worker()));
        if (!sessionExpired) await callbacksRef.current.onBatchComplete();
      } finally {
        runningRef.current = false;
        setRunning(false);
      }

      return {
        total: entries.length,
        uploaded,
        reused,
        failed,
        skipped,
      };
    },
    [patchItem],
  );

  const enqueue = useCallback(
    async (
      files: File[],
      role: MediaRole,
      folderId: string | null,
    ): Promise<MediaUploadBatchSummary> => {
      if (runningRef.current) return EMPTY_BATCH_SUMMARY;
      const supported = files.filter((file) =>
        SUPPORTED_MEDIA_TYPES.has(file.type.toLowerCase()),
      );
      const entries: MediaUploadQueueItem[] = supported.map((file) => ({
        id: crypto.randomUUID(),
        file,
        fileName: file.name,
        byteSize: file.size,
        role,
        folderId,
        status: 'queued',
        message: null,
      }));
      setItems(entries);
      return runEntries(entries, files.length - supported.length);
    },
    [runEntries],
  );

  const retryFailed = useCallback(async (): Promise<MediaUploadBatchSummary> => {
    if (runningRef.current) return EMPTY_BATCH_SUMMARY;
    const failedEntries = items
      .filter((item) => item.status === 'error')
      .map((item) => ({ ...item, status: 'queued' as const, message: null }));
    if (failedEntries.length === 0) return EMPTY_BATCH_SUMMARY;
    const failedIds = new Set(failedEntries.map((item) => item.id));
    setItems((current) =>
      current.map((item) =>
        failedIds.has(item.id) ? { ...item, status: 'queued', message: null } : item,
      ),
    );
    return runEntries(failedEntries, 0);
  }, [items, runEntries]);

  const clearFinished = useCallback(() => {
    if (runningRef.current) return;
    setItems((current) =>
      current.filter(
        (item) =>
          item.status === 'queued' ||
          item.status === 'processing' ||
          item.status === 'error',
      ),
    );
  }, []);

  const progress = useMemo(() => {
    const done = items.filter(
      (item) =>
        item.status === 'uploaded' || item.status === 'reused' || item.status === 'error',
    ).length;
    const failed = items.filter((item) => item.status === 'error').length;
    const active = items.filter((item) => item.status === 'processing').length;
    return { done, failed, active, total: items.length };
  }, [items]);

  return {
    items,
    running,
    progress,
    enqueue,
    retryFailed,
    clearFinished,
  };
}
