import type { SendSupportImageInput, SupportImageAttachment } from './support-contract';
import { getSupportVisitorIdentity } from './support-identity';
import { uploadSupportImage, type SupportUploadTarget } from './support-image-upload';

export type SupportMediaConnection = {
  clientApiUrl: string;
};

type RemoteMediaItem = {
  messageId: string;
  id: string;
  kind: 'image';
  mimeType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  originalName: string | null;
  status: 'ready';
};

type InitResponse = {
  media: { id: string };
  upload: SupportUploadTarget;
};

export async function loadConversationMedia(
  connection: SupportMediaConnection,
  conversationId: string,
  signal?: AbortSignal,
): Promise<Map<string, SupportImageAttachment[]>> {
  const identity = getSupportVisitorIdentity();
  const url = remoteUrl(
    connection,
    `/conversations/${encodeURIComponent(conversationId)}/media`,
  );
  url.searchParams.set('visitorId', identity.visitorId);
  const payload = await requestJson<{ items?: RemoteMediaItem[] }>(
    url.toString(),
    undefined,
    signal,
  );
  const result = new Map<string, SupportImageAttachment[]>();
  for (const item of payload.items ?? []) {
    if (!validMedia(item)) continue;
    const contentUrl = remoteUrl(
      connection,
      `/media/${encodeURIComponent(item.id)}/content`,
    );
    contentUrl.searchParams.set('visitorId', identity.visitorId);
    const attachment: SupportImageAttachment = {
      id: item.id,
      kind: 'image',
      mimeType: item.mimeType,
      byteSize: item.byteSize,
      width: item.width,
      height: item.height,
      originalName: item.originalName,
      url: contentUrl.toString(),
    };
    const current = result.get(item.messageId) ?? [];
    current.push(attachment);
    result.set(item.messageId, current);
  }
  return result;
}

export async function sendConversationImage(
  connection: SupportMediaConnection,
  conversationId: string,
  input: SendSupportImageInput,
  onProgress?: (progress: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  const identity = getSupportVisitorIdentity();
  const init = await requestJson<InitResponse>(
    remoteUrl(
      connection,
      `/conversations/${encodeURIComponent(conversationId)}/media/init`,
    ).toString(),
    {
      method: 'POST',
      body: JSON.stringify({
        visitorId: identity.visitorId,
        mimeType: input.mimeType,
        byteSize: input.byteSize,
        width: input.width,
        height: input.height,
        originalName: input.originalName,
      }),
    },
    signal,
  );
  if (!init?.media?.id || !init.upload?.url)
    throw new Error('Invalid media upload response.');
  await uploadSupportImage(init.upload, input, onProgress);
  await requestJson(
    remoteUrl(
      connection,
      `/media/${encodeURIComponent(init.media.id)}/complete`,
    ).toString(),
    {
      method: 'POST',
      body: JSON.stringify({ visitorId: identity.visitorId }),
    },
    signal,
  );
}

function remoteUrl(connection: SupportMediaConnection, path: string): URL {
  return new URL(`${connection.clientApiUrl.replace(/\/$/u, '')}${path}`);
}

async function requestJson<T>(
  url: string,
  init?: RequestInit,
  signal?: AbortSignal,
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Accept', 'application/json');
  if (init?.body !== undefined) headers.set('Content-Type', 'application/json');
  const response = await fetch(url, {
    ...init,
    cache: 'no-store',
    credentials: 'omit',
    mode: 'cors',
    redirect: 'error',
    headers,
    ...(signal ? { signal } : {}),
  });
  const payload = (await response.json().catch(() => ({}))) as T;
  if (!response.ok) throw new Error(`Media request failed (${response.status}).`);
  return payload;
}

function validMedia(value: RemoteMediaItem): boolean {
  return (
    typeof value?.messageId === 'string' &&
    typeof value?.id === 'string' &&
    value.kind === 'image' &&
    typeof value.mimeType === 'string' &&
    Number.isFinite(value.byteSize) &&
    value.status === 'ready'
  );
}
