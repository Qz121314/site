import { createContext, useContext, type ReactNode } from 'react';

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

/* Rollout/offline fallback only. Normal rendering uses the backend copy endpoint. */
export const FALLBACK_STOREFRONT_COPY: StorefrontCopy = {
  navigation: { home: 'Home', browse: 'Browse', messages: 'Messages', faq: 'FAQ' },
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
  },
};

type CopyGroupKey = keyof StorefrontCopy;

const CopyContext = createContext<StorefrontCopy>(FALLBACK_STOREFRONT_COPY);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeGroup<K extends CopyGroupKey>(
  value: unknown,
  fallback: StorefrontCopy[K],
): StorefrontCopy[K] {
  const record = isRecord(value) ? value : {};
  const output: Record<string, string> = {};
  for (const [key, fallbackValue] of Object.entries(fallback)) {
    const raw = record[key];
    output[key] = typeof raw === 'string' && raw.trim() ? raw.trim() : fallbackValue;
  }
  return output as StorefrontCopy[K];
}

function normalizeCopy(value: unknown): StorefrontCopy {
  const record = isRecord(value) ? value : {};
  return {
    navigation: normalizeGroup(record.navigation, FALLBACK_STOREFRONT_COPY.navigation),
    home: normalizeGroup(record.home, FALLBACK_STOREFRONT_COPY.home),
    browse: normalizeGroup(record.browse, FALLBACK_STOREFRONT_COPY.browse),
    section: normalizeGroup(record.section, FALLBACK_STOREFRONT_COPY.section),
    product: normalizeGroup(record.product, FALLBACK_STOREFRONT_COPY.product),
    faq: normalizeGroup(record.faq, FALLBACK_STOREFRONT_COPY.faq),
    messages: normalizeGroup(record.messages, FALLBACK_STOREFRONT_COPY.messages),
  };
}

export async function loadStorefrontCopy(signal?: AbortSignal): Promise<StorefrontCopy> {
  const init: RequestInit = {
    method: 'GET',
    cache: 'no-cache',
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  };
  if (signal) init.signal = signal;

  const response = await fetch('/api/public/storefront-copy/', init);
  if (!response.ok) throw new Error('STOREFRONT_COPY_UNAVAILABLE');
  const body = await response.json() as unknown;
  if (!isRecord(body)) throw new Error('STOREFRONT_COPY_INVALID');
  return normalizeCopy(body.copy);
}

export function StorefrontCopyProvider({
  value,
  children,
}: {
  value: StorefrontCopy;
  children: ReactNode;
}) {
  return <CopyContext.Provider value={value}>{children}</CopyContext.Provider>;
}

export function useStorefrontCopy(): StorefrontCopy {
  return useContext(CopyContext);
}
