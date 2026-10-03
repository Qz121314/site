import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { AdminApiError } from './api';
import { useAdminDirtySource } from './admin-unsaved-state';
import { MediaLibraryPickerDialog } from './asset-library/MediaLibraryPickerDialog';
import type { ManagedMediaAsset } from './asset-library/api';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { MarkdownPreview } from './faq-management/MarkdownPreview';
import { MarkdownQuickToolbar } from './MarkdownQuickToolbar';
import {
  fetchReviewsPage,
  saveReviewsPage,
  type ReviewsPage,
  type ReviewsPageInput,
} from './reviews-page/api';
import './reviews-page/reviews-page.css';

const emptyPage: ReviewsPageInput = {
  title: 'Reviews',
  body: '',
  isPublished: false,
};

function isSessionError(error: unknown): boolean {
  return (
    error instanceof AdminApiError &&
    (error.status === 401 || error.code === 'SESSION_INVALID')
  );
}

function pageInput(page: ReviewsPage | null): ReviewsPageInput {
  return page
    ? { title: page.title, body: page.body, isPublished: page.isPublished }
    : emptyPage;
}

export function ReviewsPageManagementView({
  onSessionExpired,
}: {
  onSessionExpired: () => void;
}) {
  const [savedPage, setSavedPage] = useState<ReviewsPage | null>(null);
  const [form, setForm] = useState<ReviewsPageInput>(emptyPage);
  const [previewing, setPreviewing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [markdownMediaPickerOpen, setMarkdownMediaPickerOpen] = useState(false);
  const markdownTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const dirty = useMemo(
    () =>
      !savedPage ||
      form.title !== savedPage.title ||
      form.body !== savedPage.body ||
      form.isPublished !== savedPage.isPublished,
    [form, savedPage],
  );
  useAdminDirtySource('reviews-page', 'Reviews 页面', dirty);

  const handleError = useCallback(
    (reason: unknown) => {
      if (isSessionError(reason)) {
        onSessionExpired();
        return;
      }
      setError(reason instanceof Error ? reason.message : 'Reviews 页面加载失败。');
    },
    [onSessionExpired],
  );

  useEffect(() => {
    void fetchReviewsPage()
      .then((page) => {
        setSavedPage(page);
        setForm(pageInput(page));
      })
      .catch(handleError)
      .finally(() => setLoading(false));
  }, [handleError]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const page = await saveReviewsPage(form);
      setSavedPage(page);
      setForm(pageInput(page));
      setSuccess('Reviews 页面已保存，请从顶部发布菜单发布前台内容。');
    } catch (reason) {
      handleError(reason);
    } finally {
      setSaving(false);
    }
  }

  function insertMarkdownImage(asset: ManagedMediaAsset) {
    if (!asset.publicUrl) {
      setError('该素材暂无公开地址，请先配置媒体域名后再插入正文。');
      return;
    }
    const textarea = markdownTextareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const altText = asset.fileName.replace(/\.[^.]+$/, '') || '图片';
    const replacement = `![${altText}](${asset.publicUrl})`;
    setForm({
      ...form,
      body: `${form.body.slice(0, start)}${replacement}${form.body.slice(end)}`,
    });
    setMarkdownMediaPickerOpen(false);
    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + replacement.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  if (loading) {
    return (
      <div className="notice" role="status">
        正在读取 Reviews 页面…
      </div>
    );
  }

  return (
    <section className="reviews-page-admin">
      <form className="reviews-page-admin-form" onSubmit={handleSave}>
        <header className="reviews-page-admin-heading">
          <div>
            <h2>Reviews 页面</h2>
            <p>单篇 Markdown 页面；保存后通过顶部发布菜单更新前台。</p>
          </div>
          <div className="reviews-page-admin-actions">
            <label className="reviews-page-status">
              <span>页面状态</span>
              <select
                value={form.isPublished ? 'published' : 'draft'}
                onChange={(event) =>
                  setForm({ ...form, isPublished: event.target.value === 'published' })
                }
              >
                <option value="published">发布</option>
                <option value="draft">草稿</option>
              </select>
            </label>
            <Button type="submit" loading={saving} disabled={!dirty}>
              保存修改
            </Button>
          </div>
        </header>

        {error ? (
          <div className="notice notice-error" role="alert">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="notice notice-success" role="status">
            {success}
          </div>
        ) : null}

        <label className="reviews-page-field">
          <span>页面标题</span>
          <Input
            value={form.title}
            maxLength={300}
            required
            onChange={(event) => setForm({ ...form, title: event.target.value })}
          />
        </label>

        <div className="reviews-page-body-heading">
          <div>
            <strong>页面正文（Markdown）</strong>
            <small>支持快捷格式、图片、提示卡和说明卡；右侧预览可查看渲染效果。</small>
          </div>
          <div className="reviews-page-mode">
            <Button
              type="button"
              variant={previewing ? 'secondary' : 'primary'}
              onClick={() => setPreviewing(false)}
            >
              编辑
            </Button>
            <Button
              type="button"
              variant={previewing ? 'primary' : 'secondary'}
              onClick={() => setPreviewing(true)}
            >
              预览
            </Button>
          </div>
        </div>
        {!previewing ? (
          <MarkdownQuickToolbar
            value={form.body}
            textareaRef={markdownTextareaRef}
            disabled={saving}
            showCta={false}
            onChange={(body) => setForm({ ...form, body })}
            onOpenImagePicker={() => setMarkdownMediaPickerOpen(true)}
          />
        ) : null}
        {previewing ? (
          <MarkdownPreview source={form.body} />
        ) : (
          <textarea
            ref={markdownTextareaRef}
            className="ui-textarea reviews-page-markdown-input"
            value={form.body}
            maxLength={20_000}
            required
            spellCheck={false}
            aria-label="Reviews 页面 Markdown 正文"
            placeholder="输入 Reviews 页面 Markdown 正文"
            onChange={(event) => setForm({ ...form, body: event.target.value })}
          />
        )}
        <footer className="reviews-page-body-footer">
          <span>支持主题色、高亮、标签、提示卡、说明卡和图片。</span>
          <span>{form.body.length}/20000</span>
        </footer>
      </form>
      {markdownMediaPickerOpen ? (
        <MediaLibraryPickerDialog
          title="插入 Reviews 图片"
          role="content"
          allowedKinds={['image', 'animated_image']}
          maxSelections={1}
          onSessionExpired={onSessionExpired}
          onClose={() => setMarkdownMediaPickerOpen(false)}
          onDone={() => setMarkdownMediaPickerOpen(false)}
          onSelect={insertMarkdownImage}
        />
      ) : null}
    </section>
  );
}
