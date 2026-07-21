import { normalizeProductBodyLists } from "@/lib/admin/product-body-normalize";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderFormattedText(value: string): string {
  const codeSpans: string[] = [];
  let output = escapeHtml(value).replace(/`([^`\n]{1,1000})`/gu, (_match, code: string) => {
    const index = codeSpans.push(`<code>${code}</code>`) - 1;
    return `\u0000CODE${index}\u0000`;
  });

  output = output
    .replace(/\*\*([^*\n]{1,1000})\*\*/gu, "<strong>$1</strong>")
    .replace(/__([^_\n]{1,1000})__/gu, "<strong>$1</strong>")
    .replace(/(?<!\*)\*([^*\n]{1,1000})\*(?!\*)/gu, "<em>$1</em>")
    .replace(/(?<!_)_([^_\n]{1,1000})_(?!_)/gu, "<em>$1</em>");

  return output.replace(/\u0000CODE(\d+)\u0000/gu, (_match, index: string) => codeSpans[Number(index)] ?? "");
}

function safeLink(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.username || url.password) return null;
    if (url.protocol === "http:" || url.protocol === "https:") return url.toString();
    if (url.protocol === "mailto:" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value.slice(7))) return value;
    return null;
  } catch {
    return null;
  }
}

function renderInline(value: string): string {
  const linkPattern = /\[([^\]\n]{1,300})\]\(([^\s)]+)\)/gu;
  let output = "";
  let cursor = 0;

  for (const match of value.matchAll(linkPattern)) {
    const index = match.index ?? 0;
    const fullMatch = match[0] ?? "";
    const linkText = match[1] ?? "";
    const linkTarget = safeLink(match[2] ?? "");
    output += renderFormattedText(value.slice(cursor, index));
    output += linkTarget
      ? `<a href="${escapeHtml(linkTarget)}" rel="noopener noreferrer">${renderFormattedText(linkText)}</a>`
      : renderFormattedText(fullMatch);
    cursor = index + fullMatch.length;
  }

  output += renderFormattedText(value.slice(cursor));
  return output;
}

export function renderProductBody(source: string): string {
  const normalized = normalizeProductBodyLists(source).replace(/\r\n?/gu, "\n");
  if (!normalized.trim()) return "";

  const blocks: string[] = [];
  const paragraph: string[] = [];
  const listItems: string[] = [];
  const orderedItems: string[] = [];
  const quoteLines: string[] = [];
  let codeLines: string[] | null = null;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push(`<p>${paragraph.map(renderInline).join("<br>")}</p>`);
    paragraph.length = 0;
  };

  const flushLists = () => {
    if (listItems.length > 0) {
      blocks.push(`<ul>${listItems.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ul>`);
      listItems.length = 0;
    }
    if (orderedItems.length > 0) {
      blocks.push(`<ol>${orderedItems.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ol>`);
      orderedItems.length = 0;
    }
  };

  const flushQuote = () => {
    if (quoteLines.length === 0) return;
    blocks.push(`<blockquote>${quoteLines.map(renderInline).join("<br>")}</blockquote>`);
    quoteLines.length = 0;
  };

  const flushAll = () => {
    flushParagraph();
    flushLists();
    flushQuote();
  };

  for (const line of normalized.split("\n")) {
    const markerLine = line.trimStart();

    if (codeLines) {
      if (markerLine.startsWith("```")) {
        blocks.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        codeLines = null;
      } else {
        codeLines.push(line);
      }
      continue;
    }

    if (markerLine.startsWith("```")) {
      flushAll();
      codeLines = [];
      continue;
    }

    if (!line.trim()) {
      flushAll();
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/u.exec(markerLine);
    if (heading) {
      flushAll();
      const level = heading[1]?.length ?? 1;
      blocks.push(`<h${level}>${renderInline(heading[2] ?? "")}</h${level}>`);
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/u.test(markerLine)) {
      flushAll();
      blocks.push("<hr>");
      continue;
    }

    if (markerLine.startsWith("> ")) {
      flushParagraph();
      flushLists();
      quoteLines.push(markerLine.slice(2));
      continue;
    }

    if (/^[-*+]\s+/u.test(markerLine)) {
      flushParagraph();
      flushQuote();
      orderedItems.length = 0;
      listItems.push(markerLine.replace(/^[-*+]\s+/u, ""));
      continue;
    }

    if (/^\d+[.)]\s+/u.test(markerLine)) {
      flushParagraph();
      flushQuote();
      listItems.length = 0;
      orderedItems.push(markerLine.replace(/^\d+[.)]\s+/u, ""));
      continue;
    }

    flushLists();
    flushQuote();
    paragraph.push(line);
  }

  if (codeLines) blocks.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
  flushAll();
  return blocks.join("\n");
}
