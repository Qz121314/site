export const publicLanguage = 'en' as const;

export type PublicLanguage = typeof publicLanguage;

export const appVersion = '0.1.0';

export {
  defaultStorefrontLayoutConfig,
  resolveStorefrontLayoutConfig,
  storefrontLayoutPages,
  type StorefrontLayoutConfig,
  type StorefrontLayoutKey,
  type StorefrontLayoutPage,
} from './layout';

export {
  parseInlineMarkdown,
  parseMarkdown,
  type MarkdownBlock,
  type MarkdownInlineNode,
} from './markdown';
