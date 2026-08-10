import { useMemo, type ReactNode } from 'react';
import { parseMarkdown, type MarkdownBlock, type MarkdownInlineNode } from '@site/shared';

function renderInline(nodes: MarkdownInlineNode[], keyPrefix: string): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;
    switch (node.type) {
      case 'code':
        return <code key={key}>{node.value}</code>;
      case 'strong':
        return <strong key={key}>{node.value}</strong>;
      case 'emphasis':
        return <em key={key}>{node.value}</em>;
      case 'strike':
        return <del key={key}>{node.value}</del>;
      case 'link': {
        const external = /^https?:/i.test(node.href);
        return (
          <a
            key={key}
            href={node.href}
            {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
          >
            {node.value}
          </a>
        );
      }
      case 'image':
        return <img alt={node.alt} key={key} loading="lazy" src={node.src} />;
      default:
        return node.value;
    }
  });
}

function renderLines(lines: MarkdownInlineNode[][], keyPrefix: string): ReactNode[] {
  return lines.flatMap((line, index) => [
    ...renderInline(line, `${keyPrefix}-${index}`),
    ...(index < lines.length - 1 ? [<br key={`${keyPrefix}-br-${index}`} />] : []),
  ]);
}

function renderBlock(block: MarkdownBlock, index: number): ReactNode {
  const key = `faq-markdown-${index}`;
  switch (block.type) {
    case 'heading': {
      const content = renderInline(block.content, key);
      switch (block.level) {
        case 1:
          return <h1 key={key}>{content}</h1>;
        case 2:
          return <h2 key={key}>{content}</h2>;
        case 3:
          return <h3 key={key}>{content}</h3>;
        case 4:
          return <h4 key={key}>{content}</h4>;
        case 5:
          return <h5 key={key}>{content}</h5>;
        default:
          return <h6 key={key}>{content}</h6>;
      }
    }
    case 'blockquote':
      return <blockquote key={key}>{renderLines(block.lines, key)}</blockquote>;
    case 'unordered-list':
      return (
        <ul key={key}>
          {block.items.map((item, itemIndex) => (
            <li key={`${key}-${itemIndex}`}>
              {renderInline(item, `${key}-${itemIndex}`)}
            </li>
          ))}
        </ul>
      );
    case 'ordered-list':
      return (
        <ol key={key}>
          {block.items.map((item, itemIndex) => (
            <li key={`${key}-${itemIndex}`}>
              {renderInline(item, `${key}-${itemIndex}`)}
            </li>
          ))}
        </ol>
      );
    case 'code':
      return (
        <pre key={key} data-language={block.language ?? undefined}>
          <code>{block.value}</code>
        </pre>
      );
    case 'divider':
      return <hr key={key} />;
    default:
      return <p key={key}>{renderLines(block.lines, key)}</p>;
  }
}

export function MarkdownPreview({ source }: { source: string }) {
  const blocks = useMemo(() => parseMarkdown(source), [source]);

  if (blocks.length === 0) {
    return <div className="faq-markdown-empty">正文预览将在这里显示。</div>;
  }

  return <div className="faq-markdown-preview">{blocks.map(renderBlock)}</div>;
}
