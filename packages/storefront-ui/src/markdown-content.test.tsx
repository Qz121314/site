import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MarkdownContent } from './markdown-content';

describe('MarkdownContent', () => {
  it('renders the common FAQ Markdown contract from raw source', () => {
    const html = renderToStaticMarkup(
      <MarkdownContent
        source={[
          '# Heading',
          '',
          '- First',
          '- Second',
          '',
          '[OpenAI](https://openai.com) and *emphasis* with `inline`.',
          '',
          '```js',
          'const ok = true;',
          '```',
        ].join('\n')}
      />,
    );

    expect(html).toContain('<h2>Heading</h2>');
    expect(html).toContain('<ul><li>First</li><li>Second</li></ul>');
    expect(html).toContain(
      '<a href="https://openai.com" rel="noopener noreferrer" target="_blank">OpenAI</a>',
    );
    expect(html).toContain('<em>emphasis</em>');
    expect(html).toContain('<code>inline</code>');
    expect(html).toContain('<pre><code>const ok = true;</code></pre>');
  });
});
