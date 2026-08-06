import { describe, expect, it } from 'vitest';
import { parseMarkdown } from './markdown';

describe('parseMarkdown', () => {
  it('keeps plain text as paragraph lines', () => {
    expect(parseMarkdown('第一行\n第二行')).toEqual([
      {
        type: 'paragraph',
        lines: [
          [{ type: 'text', value: '第一行' }],
          [{ type: 'text', value: '第二行' }],
        ],
      },
    ]);
  });

  it('parses common markdown blocks', () => {
    const result = parseMarkdown('# 标题\n\n- 第一项\n- 第二项\n\n```js\nconst ok = true;\n```');

    expect(result).toEqual([
      {
        type: 'heading',
        level: 1,
        content: [{ type: 'text', value: '标题' }],
      },
      {
        type: 'unordered-list',
        items: [
          [{ type: 'text', value: '第一项' }],
          [{ type: 'text', value: '第二项' }],
        ],
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
});
