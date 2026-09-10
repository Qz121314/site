import type { FormEvent } from 'react';
import { Button } from '../components/ui/button';
import { AdminDialog } from '../components/ui/dialog';
import {
  AdminSegmentedControl,
  AdminSegmentedItem,
} from '../components/ui/segmented-control';
import { Textarea } from '../components/ui/textarea';
import type { AdminArticle, ArticleInput } from './api';
import { MarkdownPreview } from './MarkdownPreview';

type ArticleEditorDialogProps = {
  editingArticle: AdminArticle | null;
  form: ArticleInput;
  previewing: boolean;
  saving: boolean;
  errorMessage: string;
  onFormChange: (form: ArticleInput) => void;
  onPreviewingChange: (previewing: boolean) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function ArticleEditorDialog({
  editingArticle,
  form,
  previewing,
  saving,
  errorMessage,
  onFormChange,
  onPreviewingChange,
  onClose,
  onSubmit,
}: ArticleEditorDialogProps) {
  const title = editingArticle ? '编辑文章' : '新建文章';

  return (
    <AdminDialog
      open
      title={title}
      eyebrow="素材 / 文章"
      description="编辑可复用的 Markdown 文章内容。"
      size="large"
      closeDisabled={saving}
      onClose={onClose}
      headerActions={
        <div className="article-editor-header-actions">
          <AdminSegmentedControl ariaLabel="文章状态">
            <AdminSegmentedItem
              type="button"
              selected={form.isActive}
              onClick={() => onFormChange({ ...form, isActive: true })}
            >
              启用
            </AdminSegmentedItem>
            <AdminSegmentedItem
              type="button"
              selected={!form.isActive}
              onClick={() => onFormChange({ ...form, isActive: false })}
            >
              停用
            </AdminSegmentedItem>
          </AdminSegmentedControl>
          <Button type="submit" form="article-editor-form" loading={saving}>
            {editingArticle ? '保存修改' : '创建文章'}
          </Button>
        </div>
      }
      footer={
        <Button variant="secondary" disabled={saving} onClick={onClose}>
          取消
        </Button>
      }
    >
      <form id="article-editor-form" className="article-editor-form" onSubmit={onSubmit}>
        {errorMessage ? (
          <div className="notice notice-error" role="alert">
            {errorMessage}
          </div>
        ) : null}

        <section className="article-editor-section article-editor-body-section">
          <div className="article-editor-heading-row">
            <div>
              <span className="article-field-label">文章内容（Markdown）</span>
              <small>
                标题和正文统一写在同一个 Markdown 文档中，使用 # 一级标题作为文章标题
              </small>
            </div>
            <AdminSegmentedControl ariaLabel="Markdown 编辑模式">
              <AdminSegmentedItem
                type="button"
                selected={!previewing}
                onClick={() => onPreviewingChange(false)}
              >
                编辑
              </AdminSegmentedItem>
              <AdminSegmentedItem
                type="button"
                selected={previewing}
                onClick={() => onPreviewingChange(true)}
              >
                预览
              </AdminSegmentedItem>
            </AdminSegmentedControl>
          </div>

          {previewing ? (
            <MarkdownPreview markdown={form.body} />
          ) : (
            <Textarea
              className="article-markdown-source"
              name="body"
              value={form.body}
              required
              maxLength={20000}
              spellCheck={false}
              placeholder={
                '请输入 Markdown 文档，例如：\n\n# 文章标题\n\n这里是文章正文。'
              }
              aria-label="文章正文 Markdown"
              onChange={(event) => onFormChange({ ...form, body: event.target.value })}
            />
          )}
          <div className="article-editor-body-footer">
            <span>使用 # 一级标题定义文章标题，支持段落、列表、链接和引用</span>
            <span>{form.body.length}/20000</span>
          </div>
        </section>
      </form>
    </AdminDialog>
  );
}
