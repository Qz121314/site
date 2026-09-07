import type { FormEvent } from 'react';
import { Button } from '../components/ui/button';
import { AdminDialog } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
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
      footer={
        <>
          <Button variant="secondary" disabled={saving} onClick={onClose}>
            取消
          </Button>
          <Button type="submit" form="article-editor-form" loading={saving}>
            {editingArticle ? '保存修改' : '创建文章'}
          </Button>
        </>
      }
    >
      <form id="article-editor-form" className="article-editor-form" onSubmit={onSubmit}>
        {errorMessage ? (
          <div className="notice notice-error" role="alert">
            {errorMessage}
          </div>
        ) : null}

        <label className="article-field">
          <span>标题</span>
          <Input
            name="title"
            value={form.title}
            maxLength={300}
            required
            autoComplete="off"
            onChange={(event) => onFormChange({ ...form, title: event.target.value })}
          />
        </label>

        <div className="article-editor-heading-row">
          <span className="article-field-label">正文</span>
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
            onChange={(event) => onFormChange({ ...form, body: event.target.value })}
          />
        )}

        <div className="article-editor-meta-grid">
          <label className="article-field">
            <span>排序</span>
            <Input
              name="sortOrder"
              type="number"
              min={0}
              max={1000000}
              step={1}
              value={form.sortOrder}
              required
              onChange={(event) =>
                onFormChange({
                  ...form,
                  sortOrder: Number(event.target.value),
                })
              }
            />
          </label>

          <div className="article-field">
            <span>状态</span>
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
          </div>
        </div>
      </form>
    </AdminDialog>
  );
}
