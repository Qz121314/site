import type {
  SendSupportImageInput,
  SupportContactCardKind,
  SupportMessage,
  SupportMessageAttachment,
} from './support-contract';
import {
  normalizeSupportContactCardValue,
  normalizeSupportPresetMessage,
} from './support-attachment-safety';
import { getSupportVisitorIdentity } from './support-identity';
import { uploadSupportImage, type SupportUploadTarget } from './support-image-upload';

export type SupportMediaConnection = {
  clientApiUrl: string;
};

type RemoteConversationAttachment = {
  messageId: string;
  id: string;
  kind: 'image' | SupportContactCardKind;
  label?: string | null;
  value?: string | null;
  presetMessage?: string | null;
  hasCustomIcon?: boolean;
  mimeType?: string | null;
  byteSize?: number | null;
  width?: number | null;
  height?: number | null;
  originalName?: string | null;
  source?: 'media' | 'snapshot';
};

type RemoteCompletedMedia = {
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

type CompleteResponse = {
  messageId: string;
  createdAt?: string;
  media: RemoteCompletedMedia;
};

export async function loadConversationMedia(
  connection: SupportMediaConnection,
  conversationId: string,
  signal?: AbortSignal,
): Promise<Map<string, SupportMessageAttachment[]>> {
  const identity = getSupportVisitorIdentity();
  const url = remoteUrl(
    connection,
    `/conversations/${encodeURIComponent(conversationId)}/media`,
  );
  url.searchParams.set('visitorId', identity.visitorId);
  if (identity.accessToken) url.searchParams.set('visitorToken', identity.accessToken);
  const payload = await requestJson<{ items?: RemoteConversationAttachment[] }>(
    url.toString(),
    undefined,
    signal,
  );
  const result = new Map<string, SupportMessageAttachment[]>();
  for (const item of payload.items ?? []) {
    const attachment = parseConversationAttachment(connection, identity, item);
    if (!attachment || typeof item.messageId !== 'string' || !item.messageId) continue;
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
): Promise<SupportMessage> {
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
        visitorToken: identity.accessToken,
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
  const complete = await requestJson<CompleteResponse>(
    remoteUrl(
      connection,
      `/media/${encodeURIComponent(init.media.id)}/complete`,
    ).toString(),
    {
      method: 'POST',
      body: JSON.stringify({
        visitorId: identity.visitorId,
        visitorToken: identity.accessToken,
      }),
    },
    signal,
  );
  if (!complete?.messageId || !complete.media || !validCompletedMedia(complete.media)) {
    throw new Error('Invalid media completion response.');
  }
  const contentUrl = remoteUrl(
    connection,
    `/media/${encodeURIComponent(complete.media.id)}/content`,
  );
  contentUrl.searchParams.set('visitorId', identity.visitorId);
  if (identity.accessToken)
    contentUrl.searchParams.set('visitorToken', identity.accessToken);
  return {
    id: complete.messageId,
    direction: 'customer',
    body: '',
    sentAt: complete.createdAt ?? new Date().toISOString(),
    delivery: 'sent',
    attachments: [
      {
        id: complete.media.id,
        kind: 'image',
        label: complete.media.originalName || 'Image',
        mimeType: complete.media.mimeType,
        byteSize: complete.media.byteSize,
        width: complete.media.width,
        height: complete.media.height,
        originalName: complete.media.originalName,
        url: contentUrl.toString(),
      },
    ],
  };
}

function isContactCardKind(value: unknown): value is SupportContactCardKind {
  return (
    value === 'sms' ||
    value === 'whatsapp' ||
    value === 'telegram' ||
    value === 'website'
  );
}

function parseConversationAttachment(
  connection: SupportMediaConnection,
  identity: ReturnType<typeof getSupportVisitorIdentity>,
  item: RemoteConversationAttachment,
): SupportMessageAttachment | null {
  if (!item || typeof item.id !== 'string' || !item.id) return null;
  const label =
    typeof item.label === 'string' && item.label.trim()
      ? item.label.trim()
      : item.kind === 'image'
        ? item.originalName || 'Image'
        : '';

  if (isContactCardKind(item.kind)) {
    const value = normalizeSupportContactCardValue(item.kind, item.value);
    const presetMessage = normalizeSupportPresetMessage(item.presetMessage);
    const hasPresetMessage =
      typeof item.presetMessage === 'string' && item.presetMessage.trim().length > 0;
    if (
      !value ||
      !label ||
      (hasPresetMessage && !presetMessage) ||
      (item.kind === 'website' && hasPresetMessage)
    ) {
      return null;
    }
    return {
      id: item.id,
      kind: item.kind,
      label,
      value,
      presetMessage: item.kind === 'website' ? null : presetMessage,
      hasCustomIcon: item.hasCustomIcon === true,
    };
  }

  if (
    item.kind !== 'image' ||
    typeof item.mimeType !== 'string' ||
    typeof item.byteSize !== 'number' ||
    !Number.isFinite(item.byteSize)
  ) {
    return null;
  }
  const contentUrl = remoteUrl(
    connection,
    item.source === 'snapshot'
      ? `/attachments/${encodeURIComponent(item.id)}/content`
      : `/media/${encodeURIComponent(item.id)}/content`,
  );
  contentUrl.searchParams.set('visitorId', identity.visitorId);
  if (identity.accessToken)
    contentUrl.searchParams.set('visitorToken', identity.accessToken);
  return {
    id: item.id,
    kind: 'image',
    label,
    mimeType: item.mimeType,
    byteSize: item.byteSize,
    width: typeof item.width === 'number' ? item.width : null,
    height: typeof item.height === 'number' ? item.height : null,
    originalName: typeof item.originalName === 'string' ? item.originalName : null,
    url: contentUrl.toString(),
  };
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

function validCompletedMedia(value: RemoteCompletedMedia): boolean {
  return (
    typeof value?.id === 'string' &&
    value.kind === 'image' &&
    typeof value.mimeType === 'string' &&
    Number.isFinite(value.byteSize) &&
    value.status === 'ready'
  );
}
