export type StorefrontCopy = {
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

export const STOREFRONT_COPY: StorefrontCopy = {
  home: {
    sectionsKicker: 'Explore',
    sectionsTitle: 'Services',
    viewAll: 'More',
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
    searchPlaceholder: 'Search',
    sectionsTitle: 'Sections',
    productsTitle: 'Products',
    noResults: 'No matching content found.',
  },
  section: {
    backLabel: 'Back',
    kicker: 'Browse services',
    searchLabel: 'Search',
    searchPlaceholder: 'Search',
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

export function useStorefrontCopy(): StorefrontCopy {
  return STOREFRONT_COPY;
}
