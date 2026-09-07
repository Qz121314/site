import { MarkdownContent } from '@site/storefront-ui/markdown-content';

type MarkdownPreviewProps = {
  markdown: string;
};

export function MarkdownPreview({ markdown }: MarkdownPreviewProps) {
  return (
    <div className="article-markdown-preview" data-markdown-preview>
      <MarkdownContent source={markdown} />
    </div>
  );
}
