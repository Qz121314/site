import { describe, expect, it } from 'vitest';
import { parseMarkdown } from './markdown';

describe('parseMarkdown', () => {
  it('keeps plain text as paragraph lines', () => {
    expect(parseMarkdown('第一行\n第二行')).toEqual([
      {
        type: 'paragraph',
        lines: [[{ type: 'text', value: '第一行' }], [{ type: 'text', value: '第二行' }]],
      },
    ]);
  });

  it('parses common markdown blocks', () => {
    const result = parseMarkdown(
      '# 标题\n\n- 第一项\n- 第二项\n\n```js\nconst ok = true;\n```',
    );

    expect(result).toEqual([
      {
        type: 'heading',
        level: 1,
        content: [{ type: 'text', value: '标题' }],
      },
      {
        type: 'unordered-list',
        items: [[{ type: 'text', value: '第一项' }], [{ type: 'text', value: '第二项' }]],
      },
      {
        type: 'code',
        value: 'const ok = true;',
        language: 'js',
      },
    ]);
  });

  it('rejects unsafe links while preserving their text', () => {
    expect(parseMarkdown('[点击](javascript:alert)')).toEqual([
      {
        type: 'paragraph',
        lines: [[{ type: 'text', value: '[点击](javascript:alert)' }]],
      },
    ]);
  });

  it('parses safe Markdown images', () => {
    expect(parseMarkdown('![封面](https://assets.example.com/media/demo.webp)')).toEqual([
      {
        type: 'paragraph',
        lines: [
          [
            {
              type: 'image',
              alt: '封面',
              src: 'https://assets.example.com/media/demo.webp',
            },
          ],
        ],
      },
    ]);
  });

  it('parses theme-aware inline styles and callout blocks', () => {
    expect(
      parseMarkdown(
        '{accent}重点{/accent} {highlight}高亮{/highlight}\n\n:::notice Important Note\n请先确认可用时间。\n:::',
      ),
    ).toEqual([
      {
        type: 'paragraph',
        lines: [
          [
            { type: 'styled', style: 'accent', value: '重点' },
            { type: 'text', value: ' ' },
            { type: 'styled', style: 'highlight', value: '高亮' },
          ],
        ],
      },
      {
        type: 'callout',
        variant: 'notice',
        title: [{ type: 'text', value: 'Important Note' }],
        lines: [[{ type: 'text', value: '请先确认可用时间。' }]],
      },
    ]);
  });

  it('keeps an unfinished callout directive as regular text', () => {
    expect(parseMarkdown(':::tip\n尚未结束')).toEqual([
      {
        type: 'paragraph',
        lines: [
          [{ type: 'text', value: ':::tip' }],
          [{ type: 'text', value: '尚未结束' }],
        ],
      },
    ]);
  });

  it('rejects unsafe Markdown image sources as plain text', () => {
    expect(parseMarkdown('![bad](javascript:alert)')).toEqual([
      {
        type: 'paragraph',
        lines: [[{ type: 'text', value: '![bad](javascript:alert)' }]],
      },
    ]);
    expect(parseMarkdown('![bad](data:image/png;base64,abc)')).toEqual([
      {
        type: 'paragraph',
        lines: [[{ type: 'text', value: '![bad](data:image/png;base64,abc)' }]],
      },
    ]);
  });
});
