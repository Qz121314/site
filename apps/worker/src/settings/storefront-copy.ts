export type StorefrontCopy = {
  navigation: {
    home: string;
    browse: string;
    messages: string;
    faq: string;
  };
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
    newConversationStatus: string;
    loadEarlier: string;
    sendLabel: string;
    attachmentLabel: string;
    selectConversationTitle: string;
    selectConversationDescription: string;
    sendingLabel: string;
    sentLabel: string;
    readLabel: string;
    unreadLabel: string;
    sendFailed: string;
    loadingConversation: string;
  };
};

export const DEFAULT_STOREFRONT_COPY: StorefrontCopy = {
  navigation: {
    home: 'Home',
    browse: 'Browse',
    messages: 'Messages',
    faq: 'FAQ',
  },
  home: {
    sectionsKicker: 'Explore',
    sectionsTitle: 'Services',
    viewAll: 'View all',
    showLess: 'Show less',
    emptySections: 'No services are published yet.',
    featuredKicker: 'Popular now',
    featuredTitle: 'Hot picks',
    latestKicker: 'Recently added',
    latestTitle: 'Latest services',
  },
  browse: {
    kicker: 'Explore',
    title: 'Browse',
    searchPlaceholder: 'Search sections, products, or tags',
    sectionsTitle: 'Sections',
    productsTitle: 'Products',
    noResults: 'No matching content found.',
  },
  section: {
    backLabel: 'Browse',
    kicker: 'Browse services',
    searchLabel: 'Search',
    searchPlaceholder: 'Name, type or tag',
    typeLabel: 'Service type',
    allTypes: 'All types',
    clearFilters: 'Clear filters',
    emptyResults: 'No services match these filters.',
    resultSingular: 'result',
    resultPlural: 'results',
    loading: 'Loading services…',
  },
  product: {
    onlineLabel: 'Online',
    offlineLabel: 'In person',
    onlineKicker: 'Online service',
    offlineKicker: 'In-person service',
    typeLabel: 'Service type',
    aboutTitle: 'About this service',
    contactKicker: 'Ready to connect?',
    contactHint: 'The available contact destination is selected when you continue.',
    mediaUnavailable: 'Media unavailable',
    imageUnavailable: 'Image unavailable',
    noMedia: 'No media available',
    loading: 'Loading service…',
  },
  faq: {
    kicker: 'Help',
    title: 'FAQ',
    loading: 'Loading FAQ…',
    unavailable: 'FAQ is temporarily unavailable.',
    retry: 'Try again',
    empty: 'No FAQs are published yet.',
  },
  messages: {
    kicker: 'Customer service',
    title: 'Messages',
    emptyTitle: 'No conversations yet',
    emptyDescription: 'Start a consultation from a product page. Your conversations will appear here.',
    supportName: 'Customer Support',
    noActiveConversation: 'No active conversation',
    unavailableTitle: 'Conversation not found or has ended',
    unavailableDescription: 'Go back to Messages, or start a new consultation from a product page.',
    backLabel: 'Back to messages',
    inputPlaceholder: 'Type a message',
    productLabel: 'Product',
    waitingStatus: 'Connecting to support',
    activeStatus: 'Customer support',
    closedStatus: 'Conversation ended',
    waitingPreview: 'Waiting for an agent…',
    newConversationStatus: 'New conversation',
    loadEarlier: 'Load earlier messages',
    sendLabel: 'Send message',
    attachmentLabel: 'Add attachment',
    selectConversationTitle: 'Select a conversation',
    selectConversationDescription: 'Choose a conversation from the list to continue messaging.',
    sendingLabel: 'Sending',
    sentLabel: 'Sent',
    readLabel: 'Read',
    unreadLabel: 'unread messages',
    sendFailed: 'Message could not be sent. Please try again.',
    loadingConversation: 'Loading conversation…',
  },
};

type CopyGroupKey = keyof StorefrontCopy;

type ValidationResult =
  | { ok: true; value: StorefrontCopy }
  | { ok: false; field: string; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readCopyField(value: unknown, field: string, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const normalized = value.replace(/\s+/gu, ' ').trim();
  return normalized && normalized.length <= 240 ? normalized : fallback;
}

function normalizeGroup<T>(value: unknown, fallback: T): T {
  const record = isRecord(value) ? value : {};
  const fallbackRecord = fallback as Record<string, string>;
  const normalized: Record<string, string> = {};
  for (const [key, fallbackValue] of Object.entries(fallbackRecord)) {
    normalized[key] = readCopyField(record[key], key, fallbackValue);
  }
  return normalized as T;
}

export function normalizeStorefrontCopy(value: unknown): StorefrontCopy {
  const record = isRecord(value) ? value : {};
  return {
    navigation: normalizeGroup(record.navigation, DEFAULT_STOREFRONT_COPY.navigation),
    home: normalizeGroup(record.home, DEFAULT_STOREFRONT_COPY.home),
    browse: normalizeGroup(record.browse, DEFAULT_STOREFRONT_COPY.browse),
    section: normalizeGroup(record.section, DEFAULT_STOREFRONT_COPY.section),
    product: normalizeGroup(record.product, DEFAULT_STOREFRONT_COPY.product),
    faq: normalizeGroup(record.faq, DEFAULT_STOREFRONT_COPY.faq),
    messages: normalizeGroup(record.messages, DEFAULT_STOREFRONT_COPY.messages),
  };
}

export function parseStorefrontCopyJson(value: unknown): StorefrontCopy {
  if (typeof value !== 'string' || !value.trim()) return DEFAULT_STOREFRONT_COPY;
  try {
    return normalizeStorefrontCopy(JSON.parse(value) as unknown);
  } catch {
    return DEFAULT_STOREFRONT_COPY;
  }
}

export function serializeStorefrontCopy(value: StorefrontCopy): string {
  return JSON.stringify(value);
}

export function validateStorefrontCopyInput(value: unknown): ValidationResult {
  if (!isRecord(value)) {
    return { ok: false, field: 'storefrontCopy', message: '前端文案配置无效。' };
  }

  const output = {} as StorefrontCopy;
  for (const groupKey of Object.keys(DEFAULT_STOREFRONT_COPY) as CopyGroupKey[]) {
    const groupValue = value[groupKey];
    if (!isRecord(groupValue)) {
      return { ok: false, field: `storefrontCopy.${groupKey}`, message: '前端文案分组无效。' };
    }
    const fallbackGroup = DEFAULT_STOREFRONT_COPY[groupKey];
    const normalized: Record<string, string> = {};
    for (const fieldKey of Object.keys(fallbackGroup)) {
      const raw = groupValue[fieldKey];
      if (typeof raw !== 'string') {
        return {
          ok: false,
          field: `storefrontCopy.${groupKey}.${fieldKey}`,
          message: '必须填写英文文案。',
        };
      }
      const text = raw.replace(/\s+/gu, ' ').trim();
      if (!text || text.length > 240) {
        return {
          ok: false,
          field: `storefrontCopy.${groupKey}.${fieldKey}`,
          message: '文案不能为空且不能超过 240 个字符。',
        };
      }
      normalized[fieldKey] = text;
    }
    output[groupKey] = normalized as never;
  }

  return { ok: true, value: output };
}
