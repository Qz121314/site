import {
  MarkdownContent as SharedMarkdownContent,
  type MarkdownImageRenderer,
} from '@site/storefront-ui/markdown-content';
import '@site/storefront-ui/markdown-content.css';
import { ResilientImage } from './ResilientMedia';

const renderStorefrontImage: MarkdownImageRenderer = ({ alt, key, src }) => (
  <ResilientImage
    alt={alt}
    fallback={<span className="markdown-image-fallback" aria-hidden="true" />}
    key={key}
    loading="lazy"
    src={src}
  />
);

export function MarkdownContent({ source }: { source: string }) {
  return <SharedMarkdownContent source={source} renderImage={renderStorefrontImage} />;
}
