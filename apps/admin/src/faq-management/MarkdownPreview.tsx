import { MarkdownContent } from '@site/storefront-ui/markdown-content';

export function MarkdownPreview({ source }: { source: string }) {
  if (!source.trim()) {
    return <div className="faq-markdown-empty">正文预览将在这里显示。</div>;
  }

  return (
    <div className="faq-markdown-preview">
      <MarkdownContent source={source} />
    </div>
  );
}
