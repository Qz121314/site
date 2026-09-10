import { MarkdownContent } from '@site/storefront-ui/markdown-content';

type MarkdownPreviewProps = {
  markdown: string;
};

export function MarkdownPreview({ markdown }: MarkdownPreviewProps) {
  if (!markdown.trim()) {
    return (
      <div className="article-markdown-preview article-markdown-preview-empty">
        输入正文后，这里会显示前台文章效果。
      </div>
    );
  }
  return (
    <div className="article-markdown-preview" data-markdown-preview>
      <MarkdownContent source={markdown} />
    </div>
  );
}
