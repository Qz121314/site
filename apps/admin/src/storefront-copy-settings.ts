import { AdminApiError } from './api';

export type StorefrontCopy = {
  navigation: { home: string; browse: string; messages: string; faq: string };
  home: {
    sectionsKicker: string;
    sectionsTitle: string;
    viewAll: string;
    showLess: string;
    emptySections: string;
    featuredKicker: string;
    featuredTitle: string;
    latestKicker: string;
    latestTitle: string;
  };
  browse: {
    kicker: string;
    title: string;
    searchPlaceholder: string;
    sectionsTitle: string;
    productsTitle: string;
    noResults: string;
  };
  section: {
    backLabel: string;
    kicker: string;
    searchLabel: string;
    searchPlaceholder: string;
    typeLabel: string;
    allTypes: string;
    clearFilters: string;
    emptyResults: string;
    resultSingular: string;
    resultPlural: string;
    loading: string;
  };
  product: {
    onlineLabel: string;
    offlineLabel: string;
    onlineKicker: string;
    offlineKicker: string;
    typeLabel: string;
    aboutTitle: string;
    contactKicker: string;
    contactHint: string;
    mediaUnavailable: string;
    imageUnavailable: string;
    noMedia: string;
    loading: string;
  };
  faq: {
    kicker: string;
    title: string;
    loading: string;
    unavailable: string;
    retry: string;
    empty: string;
  };
  messages: {
    kicker: string;
    title: string;
    emptyTitle: string;
    emptyDescription: string;
    supportName: string;
    noActiveConversation: string;
    unavailableTitle: string;
    unavailableDescription: string;
    backLabel: string;
    inputPlaceholder: string;
    productLabel: string;
    waitingStatus: string;
    activeStatus: string;
    closedStatus: string;
    waitingPreview: string;
  };
};

type CopyGroupKey = keyof StorefrontCopy;

const COPY_FIELDS: { [K in CopyGroupKey]: readonly (keyof StorefrontCopy[K])[] } = {
  navigation: ['home', 'browse', 'messages', 'faq'],
  home: [
    'sectionsKicker', 'sectionsTitle', 'viewAll', 'showLess', 'emptySections',
    'featuredKicker', 'featuredTitle', 'latestKicker', 'latestTitle',
  ],
  browse: ['kicker', 'title', 'searchPlaceholder', 'sectionsTitle', 'productsTitle', 'noResults'],
  section: [
    'backLabel', 'kicker', 'searchLabel', 'searchPlaceholder', 'typeLabel', 'allTypes',
    'clearFilters', 'emptyResults', 'resultSingular', 'resultPlural', 'loading',
  ],
  product: [
    'onlineLabel', 'offlineLabel', 'onlineKicker', 'offlineKicker', 'typeLabel', 'aboutTitle',
    'contactKicker', 'contactHint', 'mediaUnavailable', 'imageUnavailable', 'noMedia', 'loading',
  ],
  faq: ['kicker', 'title', 'loading', 'unavailable', 'retry', 'empty'],
  messages: [
    'kicker', 'title', 'emptyTitle', 'emptyDescription', 'supportName', 'noActiveConversation',
    'unavailableTitle', 'unavailableDescription', 'backLabel', 'inputPlaceholder', 'productLabel',
    'waitingStatus', 'activeStatus', 'closedStatus', 'waitingPreview',
  ],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseStorefrontCopy(value: unknown): StorefrontCopy {
  if (!isRecord(value)) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '前端文案返回数据无效。');
  }

  const output = {} as StorefrontCopy;
  for (const groupKey of Object.keys(COPY_FIELDS) as CopyGroupKey[]) {
    const group = value[groupKey];
    if (!isRecord(group)) {
      throw new AdminApiError(500, 'INVALID_RESPONSE', '前端文案返回数据无效。');
    }
    const parsed: Record<string, string> = {};
    for (const fieldKey of COPY_FIELDS[groupKey]) {
      const fieldValue = group[String(fieldKey)];
      if (typeof fieldValue !== 'string' || !fieldValue.trim()) {
        throw new AdminApiError(500, 'INVALID_RESPONSE', '前端文案返回数据无效。');
      }
      parsed[String(fieldKey)] = fieldValue;
    }
    output[groupKey] = parsed as never;
  }
  return output;
}
