import type { RefObject } from 'react';
import './markdown-quick-toolbar.css';

type MarkdownAction = {
  label: string;
  title: string;
  before: string;
  after?: string;
  placeholder: string;
};

const markdownActions: MarkdownAction[] = [
  { label: 'H2', title: '插入二级标题', before: '## ', placeholder: '小标题' },
  {
    label: '粗体',
    title: '加粗选中文字',
    before: '**',
    after: '**',
    placeholder: '重点文字',
  },
  { label: '列表', title: '插入列表项', before: '- ', placeholder: '列表内容' },
  { label: '提示', title: '插入提示引用块', before: '> ', placeholder: '提示内容' },
  {
    label: '链接',
    title: '插入安全链接',
    before: '[',
    after: '](https://example.com)',
    placeholder: '链接文字',
  },
  {
    label: '代码',
    title: '插入行内代码',
    before: '`',
    after: '`',
    placeholder: '代码内容',
  },
  { label: '分隔线', title: '插入分隔线', before: '---', placeholder: '' },
  {
    label: '品牌色',
    title: '插入跟随当前主题的品牌色文字',
    before: '{accent}',
    after: '{/accent}',
    placeholder: '重点文字',
  },
  {
    label: '高亮',
    title: '插入带背景的高亮文字',
    before: '{highlight}',
    after: '{/highlight}',
    placeholder: '高亮文字',
  },
  {
    label: '弱化',
    title: '插入辅助说明文字',
    before: '{muted}',
    after: '{/muted}',
    placeholder: '辅助说明',
  },
  {
    label: '标签',
    title: '插入主题化小标签',
    before: '{badge}',
    after: '{/badge}',
    placeholder: '标签文字',
  },
  {
    label: '提示卡',
    title: '插入重要提示卡片',
    before: ':::notice Important Note\n',
    after: '\n:::',
    placeholder: '提示内容',
  },
  {
    label: '说明卡',
    title: '插入普通说明卡片',
    before: ':::tip\n',
    after: '\n:::',
    placeholder: '说明内容',
  },
  {
    label: 'CTA',
    title: '插入正文转化卡片',
    before: ':::cta Ready to continue?\n',
    after: '\n:::',
    placeholder: 'Use the product action button below to continue.',
  },
];

type MarkdownQuickToolbarProps = {
  value: string;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  disabled?: boolean;
  showCta?: boolean;
  onChange: (value: string) => void;
  onOpenImagePicker?: () => void;
};

export function MarkdownQuickToolbar({
  value,
  textareaRef,
  disabled = false,
  showCta = true,
  onChange,
  onOpenImagePicker,
}: MarkdownQuickToolbarProps) {
  function applyMarkdownAction(action: MarkdownAction) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end);
    const content = selected || action.placeholder;
    const replacement = `${action.before}${content}${action.after ?? ''}`;
    const nextBody = `${value.slice(0, start)}${replacement}${value.slice(end)}`;
    onChange(nextBody);

    requestAnimationFrame(() => {
      textarea.focus();
      const selectionStart = start + action.before.length;
      textarea.setSelectionRange(selectionStart, selectionStart + content.length);
    });
  }

  return (
    <div className="markdown-quick-toolbar" aria-label="Markdown 快捷格式">
      {markdownActions
        .filter((action) => showCta || action.label !== 'CTA')
        .map((action) => (
          <button
            key={action.label}
            type="button"
            title={action.title}
            disabled={disabled}
            onClick={() => applyMarkdownAction(action)}
          >
            {action.label}
          </button>
        ))}
      {onOpenImagePicker ? (
        <button
          type="button"
          title="从素材中心插入图片"
          disabled={disabled}
          onClick={onOpenImagePicker}
        >
          图片
        </button>
      ) : null}
    </div>
  );
}
