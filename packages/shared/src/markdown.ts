export type MarkdownInlineNode =
  | { type: 'text'; value: string }
  | { type: 'code'; value: string }
  | { type: 'strong'; value: string }
  | { type: 'emphasis'; value: string }
  | { type: 'strike'; value: string }
  | { type: 'link'; value: string; href: string }
  | { type: 'image'; alt: string; src: string };

export type MarkdownBlock =
  | { type: 'paragraph'; lines: MarkdownInlineNode[][] }
  | { type: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; content: MarkdownInlineNode[] }
  | { type: 'blockquote'; lines: MarkdownInlineNode[][] }
  | { type: 'unordered-list'; items: MarkdownInlineNode[][] }
  | { type: 'ordered-list'; items: MarkdownInlineNode[][] }
  | { type: 'code'; value: string; language: string | null }
  | { type: 'divider' };

const INLINE_PATTERN =
  /(!\[[^\]\n]*\]\([^)\n]+\)|`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|\[[^\]\n]+\]\([^)\n]+\)|\*[^*\n]+\*|_[^_\n]+_)/g;

function safeHref(value: string): string | null {
  const href = value.trim();
  if (!href) return null;
  if (href.startsWith('/') || href.startsWith('#')) return href;

  try {
    const parsed = new URL(href);
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol) ? href : null;
  } catch {
    return null;
  }
}

function safeImageSrc(value: string): string | null {
  const src = value.trim();
  if (!src) return null;
  if (src.startsWith('/')) return src;

  try {
    const parsed = new URL(src);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? src : null;
  } catch {
    return null;
  }
}

function parseInlineToken(token: string): MarkdownInlineNode {
  if (token.startsWith('![')) {
    const match = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(token);
    const src = match ? safeImageSrc(match[2] ?? '') : null;
    if (match && src) {
      return { type: 'image', alt: match[1] ?? '', src };
    }
    return { type: 'text', value: token };
  }
  if (token.startsWith('`') && token.endsWith('`')) {
    return { type: 'code', value: token.slice(1, -1) };
  }
  if (
    (token.startsWith('**') && token.endsWith('**')) ||
    (token.startsWith('__') && token.endsWith('__'))
  ) {
    return { type: 'strong', value: token.slice(2, -2) };
  }
  if (token.startsWith('~~') && token.endsWith('~~')) {
    return { type: 'strike', value: token.slice(2, -2) };
  }
  if (
    (token.startsWith('*') && token.endsWith('*')) ||
    (token.startsWith('_') && token.endsWith('_'))
  ) {
    return { type: 'emphasis', value: token.slice(1, -1) };
  }
  if (token.startsWith('[')) {
    const match = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
    const href = match ? safeHref(match[2] ?? '') : null;
    if (match && href) {
      return { type: 'link', value: match[1] ?? '', href };
    }
  }

  return { type: 'text', value: token };
}

export function parseInlineMarkdown(value: string): MarkdownInlineNode[] {
  const nodes: MarkdownInlineNode[] = [];
  let cursor = 0;

  for (const match of value.matchAll(INLINE_PATTERN)) {
    const index = match.index;
    const token = match[0];
    if (index > cursor) {
      nodes.push({ type: 'text', value: value.slice(cursor, index) });
    }
    nodes.push(parseInlineToken(token));
    cursor = index + token.length;
  }

  if (cursor < value.length) {
    nodes.push({ type: 'text', value: value.slice(cursor) });
  }

  return nodes.length > 0 ? nodes : [{ type: 'text', value }];
}

function headingLevel(value: number): 1 | 2 | 3 | 4 | 5 | 6 {
  switch (value) {
    case 1:
    case 2:
    case 3:
    case 4:
    case 5:
      return value;
    default:
      return 6;
  }
}

function isDivider(line: string): boolean {
  return /^\s{0,3}(?:(?:-\s*){3,}|(?:\*\s*){3,}|(?:_\s*){3,})$/.test(line);
}

function isBlockStart(line: string): boolean {
  return (
    /^```/.test(line) ||
    /^#{1,6}\s+/.test(line) ||
    /^>\s?/.test(line) ||
    /^\s*[-*+]\s+/.test(line) ||
    /^\s*\d+[.)]\s+/.test(line) ||
    isDivider(line)
  );
}

export function parseMarkdown(source: string): MarkdownBlock[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? '';
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = /^```\s*([^\s`]*)\s*$/.exec(line);
    if (fence) {
      const language = fence[1]?.trim() || null;
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index] ?? '')) {
        codeLines.push(lines[index] ?? '');
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({ type: 'code', value: codeLines.join('\n'), language });
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      blocks.push({
        type: 'heading',
        level: headingLevel(heading[1]?.length ?? 6),
        content: parseInlineMarkdown(heading[2] ?? ''),
      });
      index += 1;
      continue;
    }

    if (isDivider(line)) {
      blocks.push({ type: 'divider' });
      index += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoteLines: MarkdownInlineNode[][] = [];
      while (index < lines.length) {
        const quote = /^>\s?(.*)$/.exec(lines[index] ?? '');
        if (!quote) break;
        quoteLines.push(parseInlineMarkdown(quote[1] ?? ''));
        index += 1;
      }
      blocks.push({ type: 'blockquote', lines: quoteLines });
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      const items: MarkdownInlineNode[][] = [];
      while (index < lines.length) {
        const item = /^\s*[-*+]\s+(.+)$/.exec(lines[index] ?? '');
        if (!item) break;
        items.push(parseInlineMarkdown(item[1] ?? ''));
        index += 1;
      }
      blocks.push({ type: 'unordered-list', items });
      continue;
    }

    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: MarkdownInlineNode[][] = [];
      while (index < lines.length) {
        const item = /^\s*\d+[.)]\s+(.+)$/.exec(lines[index] ?? '');
        if (!item) break;
        items.push(parseInlineMarkdown(item[1] ?? ''));
        index += 1;
      }
      blocks.push({ type: 'ordered-list', items });
      continue;
    }

    const paragraphLines: MarkdownInlineNode[][] = [];
    while (index < lines.length) {
      const paragraphLine = lines[index] ?? '';
      if (
        !paragraphLine.trim() ||
        (paragraphLines.length > 0 && isBlockStart(paragraphLine))
      ) {
        break;
      }
      paragraphLines.push(parseInlineMarkdown(paragraphLine));
      index += 1;
    }
    blocks.push({ type: 'paragraph', lines: paragraphLines });
  }

  return blocks;
}
