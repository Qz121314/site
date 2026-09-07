import { parseMarkdown, type MarkdownBlock, type MarkdownInlineNode } from '@site/shared';
import { Fragment, type Key, type ReactNode } from 'react';

export type MarkdownImageRenderProps = {
  alt: string;
  src: string;
  key: Key;
};

export type MarkdownImageRenderer = (props: MarkdownImageRenderProps) => ReactNode;

type MarkdownContentProps = {
  source: string;
  renderImage?: MarkdownImageRenderer;
};

function renderInline(
  nodes: MarkdownInlineNode[],
  renderImage?: MarkdownImageRenderer,
): ReactNode {
  return nodes.map((node, index) => {
    const key = `${node.type}-${index}`;
    switch (node.type) {
      case 'code':
        return <code key={key}>{node.value}</code>;
      case 'strong':
        return <strong key={key}>{node.value}</strong>;
      case 'emphasis':
        return <em key={key}>{node.value}</em>;
      case 'strike':
        return <s key={key}>{node.value}</s>;
      case 'link': {
        const external = /^https?:/i.test(node.href);
        return (
          <a
            href={node.href}
            key={key}
            rel={external ? 'noopener noreferrer' : undefined}
            target={external ? '_blank' : undefined}
          >
            {node.value}
          </a>
        );
      }
      case 'image':
        return renderImage ? (
          renderImage({ alt: node.alt, src: node.src, key })
        ) : (
          <img alt={node.alt} key={key} loading="lazy" src={node.src} />
        );
      default:
        return <Fragment key={key}>{node.value}</Fragment>;
    }
  });
}

function renderLines(
  lines: MarkdownInlineNode[][],
  renderImage?: MarkdownImageRenderer,
): ReactNode {
  return lines.map((line, index) => (
    <Fragment key={index}>
      {renderInline(line, renderImage)}
      {index < lines.length - 1 ? <br /> : null}
    </Fragment>
  ));
}

function heading(
  block: Extract<MarkdownBlock, { type: 'heading' }>,
  key: number,
  renderImage?: MarkdownImageRenderer,
) {
  const content = renderInline(block.content, renderImage);
  switch (block.level) {
    case 1:
      return <h2 key={key}>{content}</h2>;
    case 2:
      return <h3 key={key}>{content}</h3>;
    case 3:
      return <h4 key={key}>{content}</h4>;
    case 4:
      return <h5 key={key}>{content}</h5>;
    default:
      return <h6 key={key}>{content}</h6>;
  }
}

function renderBlock(
  block: MarkdownBlock,
  key: number,
  renderImage?: MarkdownImageRenderer,
): ReactNode {
  switch (block.type) {
    case 'heading':
      return heading(block, key, renderImage);
    case 'paragraph':
      return <p key={key}>{renderLines(block.lines, renderImage)}</p>;
    case 'blockquote':
      return <blockquote key={key}>{renderLines(block.lines, renderImage)}</blockquote>;
    case 'unordered-list':
      return (
        <ul key={key}>
          {block.items.map((item, index) => (
            <li key={index}>{renderInline(item, renderImage)}</li>
          ))}
        </ul>
      );
    case 'ordered-list':
      return (
        <ol key={key}>
          {block.items.map((item, index) => (
            <li key={index}>{renderInline(item, renderImage)}</li>
          ))}
        </ol>
      );
    case 'code':
      return (
        <pre key={key}>
          <code>{block.value}</code>
        </pre>
      );
    case 'divider':
      return <hr key={key} />;
  }
}

export function MarkdownContent({ source, renderImage }: MarkdownContentProps) {
  return (
    <div className="markdown-content">
      {parseMarkdown(source).map((block, index) =>
        renderBlock(block, index, renderImage),
      )}
    </div>
  );
}
