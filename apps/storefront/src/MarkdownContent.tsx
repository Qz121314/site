import { parseMarkdown, type MarkdownBlock, type MarkdownInlineNode } from '@site/shared';
import { Fragment, type ReactNode } from 'react';

function renderInline(nodes: MarkdownInlineNode[]): ReactNode {
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
        return <img alt={node.alt} key={key} loading="lazy" src={node.src} />;
      default:
        return <Fragment key={key}>{node.value}</Fragment>;
    }
  });
}

function renderLines(lines: MarkdownInlineNode[][]): ReactNode {
  return lines.map((line, index) => (
    <Fragment key={index}>
      {renderInline(line)}
      {index < lines.length - 1 ? <br /> : null}
    </Fragment>
  ));
}

function heading(block: Extract<MarkdownBlock, { type: 'heading' }>, key: number) {
  const content = renderInline(block.content);
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

function renderBlock(block: MarkdownBlock, key: number): ReactNode {
  switch (block.type) {
    case 'heading':
      return heading(block, key);
    case 'paragraph':
      return <p key={key}>{renderLines(block.lines)}</p>;
    case 'blockquote':
      return <blockquote key={key}>{renderLines(block.lines)}</blockquote>;
    case 'unordered-list':
      return (
        <ul key={key}>
          {block.items.map((item, index) => <li key={index}>{renderInline(item)}</li>)}
        </ul>
      );
    case 'ordered-list':
      return (
        <ol key={key}>
          {block.items.map((item, index) => <li key={index}>{renderInline(item)}</li>)}
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

export function MarkdownContent({ source }: { source: string }) {
  return <div className="markdown-content">{parseMarkdown(source).map(renderBlock)}</div>;
}
