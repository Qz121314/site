import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { AdminApiError } from './api';
import {
  createFaq,
  deleteFaq,
  fetchFaqs,
  updateFaq,
  type AdminFaq,
  type FaqInput,
} from './faq-management/api';
import { MarkdownPreview } from './faq-management/MarkdownPreview';

type FaqManagementViewProps = {
  onSessionExpired: () => void;
};

type EditorMode = 'edit' | 'preview';

const emptyFaqForm: FaqInput = {
  title: '',
  body: '',
};

function isSessionError(error: unknown): boolean {
  return error instanceof AdminApiError && (error.status === 401 || error.code === 'SESSION_INVALID');
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN');
}

function bodySummary(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 180 ? `${normalized.slice(0, 180)}…` : normalized;
}

export function FaqManagementView({ onSessionExpired }: FaqManagementViewProps) {
  const [faqs, setFaqs] = useState<AdminFaq[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingFaq, setEditingFaq] = useState<AdminFaq | null>(null);
  const [form, setForm] = useState<FaqInput>(emptyFaqForm);
  const [editorMode, setEditorMode] = useState<EditorMode>('edit');
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AdminFaq | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleError = useCallback(
    (error: unknown) => {
      if (isSessionError(error)) {
        onSessionExpired();
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : 'FAQ 操作失败。');
    },
    [onSessionExpired],
  );

  const loadFaqs = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      setFaqs(await fetchFaqs());
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  useEffect(() => {
    void loadFaqs();
  }, [loadFaqs]);

  const filteredFaqs = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return faqs;
    return faqs.filter((faq) => `${faq.title} ${faq.body}`.toLowerCase().includes(keyword));
  }, [faqs, search]);

  function openCreateEditor() {
    setEditingFaq(null);
    setForm(emptyFaqForm);
    setEditorMode('edit');
    setErrorMessage('');
    setSuccessMessage('');
    setEditorOpen(true);
  }

  function openEditEditor(faq: AdminFaq) {
    setEditingFaq(faq);
    setForm({ title: faq.title, body: faq.body });
    setEditorMode('edit');
    setErrorMessage('');
    setSuccessMessage('');
    setEditorOpen(true);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      if (editingFaq) {
        const updated = await updateFaq(editingFaq.id, form);
        setFaqs((current) => current.map((faq) => (faq.id === updated.id ? updated : faq)));
        setSuccessMessage(`FAQ“${updated.title}”已更新。`);
      } else {
        const created = await createFaq(form);
        setFaqs((current) => [created, ...current]);
        setSuccessMessage(`FAQ“${created.title}”已创建。`);
      }
      setEditorOpen(false);
    } catch (error) {
      handleError(error);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete || deleting) return;

    setDeleting(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const deletedId = await deleteFaq(pendingDelete.id);
      setFaqs((current) => current.filter((faq) => faq.id !== deletedId));
      setSuccessMessage(`FAQ“${pendingDelete.title}”已删除。`);
      setPendingDelete(null);
    } catch (error) {
      setPendingDelete(null);
      handleError(error);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="faq-management" aria-labelledby="faq-management-title">
      <div className="faq-management-heading">
        <div>
          <p className="eyebrow">全站公共内容</p>
          <h2 id="faq-management-title">FAQ 管理</h2>
          <span>每条 FAQ 只有标题和正文。正文可直接输入普通文本，也可以使用 Markdown。</span>
        </div>
        <button className="primary-button" type="button" onClick={openCreateEditor}>
          新增 FAQ
        </button>
      </div>

      <label className="faq-search">
        <span>搜索</span>
        <input
          type="search"
          value={search}
          placeholder="搜索标题或正文"
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>

      {errorMessage ? <div className="notice notice-error" role="alert">{errorMessage}</div> : null}
      {successMessage ? <div className="notice notice-success" role="status">{successMessage}</div> : null}

      {loading ? (
        <div className="settings-card settings-loading" aria-live="polite">
          <div className="loading-indicator" aria-hidden="true" />
          <p>正在读取 FAQ…</p>
        </div>
      ) : filteredFaqs.length > 0 ? (
        <div className="faq-list">
          {filteredFaqs.map((faq) => (
            <article className="faq-card" key={faq.id}>
              <div className="faq-card-content">
                <h3>{faq.title}</h3>
                <p>{bodySummary(faq.body)}</p>
                <small>更新于 {formatDate(faq.updatedAt)}</small>
              </div>
              <div className="faq-card-actions">
                <button type="button" onClick={() => openEditEditor(faq)}>
                  编辑
                </button>
                <button className="text-danger" type="button" onClick={() => setPendingDelete(faq)}>
                  删除
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="faq-empty-state">
          <strong>{search ? '没有符合条件的 FAQ' : '还没有 FAQ'}</strong>
          <p>{search ? '调整搜索内容后重试。' : '点击“新增 FAQ”录入第一条内容。'}</p>
        </div>
      )}

      {editorOpen ? (
        <div className="admin-dialog-backdrop" role="presentation">
          <section
            className="admin-dialog faq-editor-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="faq-editor-title"
          >
            <div className="admin-dialog-header">
              <div>
                <p>FAQ 内容</p>
                <h3 id="faq-editor-title">{editingFaq ? '编辑 FAQ' : '新增 FAQ'}</h3>
              </div>
              <button type="button" aria-label="关闭" disabled={saving} onClick={() => setEditorOpen(false)}>
                ×
              </button>
            </div>

            <form className="faq-editor-form" onSubmit={(event) => void handleSave(event)}>
              <label>
                <span>标题</span>
                <input
                  type="text"
                  value={form.title}
                  autoFocus
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                />
              </label>

              <div className="faq-body-field">
                <div className="faq-body-label">
                  <div>
                    <strong>正文</strong>
                    <small>普通文本可直接输入；需要格式时使用 Markdown 语法。</small>
                  </div>
                  <div className="faq-editor-tabs" role="tablist" aria-label="正文编辑模式">
                    <button
                      type="button"
                      className={editorMode === 'edit' ? 'is-active' : undefined}
                      onClick={() => setEditorMode('edit')}
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      className={editorMode === 'preview' ? 'is-active' : undefined}
                      onClick={() => setEditorMode('preview')}
                    >
                      预览
                    </button>
                  </div>
                </div>

                {editorMode === 'edit' ? (
                  <textarea
                    value={form.body}
                    placeholder={'普通文本直接输入。\n\nMarkdown 示例：\n## 小标题\n- 列表项目\n**加粗内容**'}
                    onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
                  />
                ) : (
                  <MarkdownPreview source={form.body} />
                )}
              </div>

              <div className="admin-dialog-actions">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={saving}
                  onClick={() => setEditorOpen(false)}
                >
                  取消
                </button>
                <button className="primary-button" type="submit" disabled={saving}>
                  {saving ? '正在保存…' : '保存 FAQ'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {pendingDelete ? (
        <div className="admin-dialog-backdrop" role="presentation">
          <section
            className="admin-dialog admin-dialog-small"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="faq-delete-title"
          >
            <div className="admin-dialog-header">
              <div>
                <p>删除 FAQ</p>
                <h3 id="faq-delete-title">删除“{pendingDelete.title}”？</h3>
              </div>
            </div>
            <p className="delete-warning">删除后不可恢复。标题和正文会从数据库中直接移除。</p>
            <div className="admin-dialog-actions">
              <button
                type="button"
                className="secondary-button"
                disabled={deleting}
                onClick={() => setPendingDelete(null)}
              >
                取消
              </button>
              <button
                type="button"
                className="danger-button"
                disabled={deleting}
                onClick={() => void confirmDelete()}
              >
                {deleting ? '正在删除…' : '确认删除'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
