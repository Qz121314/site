import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { AdminApiError } from './api';
import {
  batchDeleteFaqs,
  createFaq,
  deleteFaq,
  fetchFaqs,
  reorderFaqs,
  restoreFaq,
  updateFaq,
  type AdminFaq,
  type FaqInput,
} from './faq-management/api';
import { MarkdownPreview } from './faq-management/MarkdownPreview';

type FaqManagementViewProps = { onSessionExpired: () => void };
type EditorMode = 'edit' | 'preview';
type FaqScope = 'active' | 'trash';

const emptyFaqForm: FaqInput = { title: '', body: '', sortOrder: 0, isEnabled: true };

function isSessionError(error: unknown): boolean {
  return (
    error instanceof AdminApiError &&
    (error.status === 401 || error.code === 'SESSION_INVALID')
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN');
}

function bodySummary(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 150 ? `${normalized.slice(0, 150)}…` : normalized;
}

function sortFaqs(faqs: AdminFaq[]): AdminFaq[] {
  return [...faqs].sort(
    (a, b) => a.sortOrder - b.sortOrder || b.updatedAt.localeCompare(a.updatedAt),
  );
}

export function FaqManagementView({ onSessionExpired }: FaqManagementViewProps) {
  const [scope, setScope] = useState<FaqScope>('active');
  const [activeFaqs, setActiveFaqs] = useState<AdminFaq[]>([]);
  const [trashFaqs, setTrashFaqs] = useState<AdminFaq[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingFaq, setEditingFaq] = useState<AdminFaq | null>(null);
  const [form, setForm] = useState<FaqInput>(emptyFaqForm);
  const [editorMode, setEditorMode] = useState<EditorMode>('edit');
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [working, setWorking] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
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

  const loadActive = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      setActiveFaqs(sortFaqs(await fetchFaqs('active')));
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  useEffect(() => {
    void loadActive();
  }, [loadActive]);

  useEffect(() => {
    setSelectedIds(new Set());
    setErrorMessage('');
    setSuccessMessage('');
  }, [scope]);

  const sourceFaqs = scope === 'active' ? activeFaqs : trashFaqs;
  const filteredFaqs = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return keyword
      ? sourceFaqs.filter((faq) =>
          `${faq.title} ${faq.body}`.toLowerCase().includes(keyword),
        )
      : sourceFaqs;
  }, [search, sourceFaqs]);
  const allVisibleSelected =
    filteredFaqs.length > 0 && filteredFaqs.every((faq) => selectedIds.has(faq.id));
  const canReorder = scope === 'active' && search.trim().length === 0;

  async function changeScope(nextScope: FaqScope) {
    if (nextScope === scope) return;
    setScope(nextScope);
    if (nextScope !== 'trash') return;

    setLoading(true);
    try {
      setTrashFaqs(sortFaqs(await fetchFaqs('trash')));
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  }

  function openCreateEditor() {
    const sortOrder = activeFaqs.length
      ? Math.max(...activeFaqs.map((faq) => faq.sortOrder)) + 10
      : 0;
    setEditingFaq(null);
    setForm({ ...emptyFaqForm, sortOrder });
    setEditorMode('edit');
    setEditorOpen(true);
    setErrorMessage('');
    setSuccessMessage('');
  }

  function openEditEditor(faq: AdminFaq) {
    setEditingFaq(faq);
    setForm({
      title: faq.title,
      body: faq.body,
      sortOrder: faq.sortOrder,
      isEnabled: faq.isEnabled,
    });
    setEditorMode('edit');
    setEditorOpen(true);
    setErrorMessage('');
    setSuccessMessage('');
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
        setActiveFaqs((current) =>
          sortFaqs(current.map((faq) => (faq.id === updated.id ? updated : faq))),
        );
        setSuccessMessage(`FAQ“${updated.title}”已更新。`);
      } else {
        const created = await createFaq(form);
        setActiveFaqs((current) => sortFaqs([...current, created]));
        setSuccessMessage(`FAQ“${created.title}”已创建。`);
      }
      setEditorOpen(false);
    } catch (error) {
      handleError(error);
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled(faq: AdminFaq) {
    if (working) return;
    setWorking(true);
    setErrorMessage('');
    try {
      const updated = await updateFaq(faq.id, {
        title: faq.title,
        body: faq.body,
        sortOrder: faq.sortOrder,
        isEnabled: !faq.isEnabled,
      });
      setActiveFaqs((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setSuccessMessage(updated.isEnabled ? 'FAQ 已启用。' : 'FAQ 已停用。');
    } catch (error) {
      handleError(error);
    } finally {
      setWorking(false);
    }
  }

  async function moveFaq(faq: AdminFaq, direction: -1 | 1) {
    if (!canReorder || working) return;
    const ordered = sortFaqs(activeFaqs);
    const index = ordered.findIndex((item) => item.id === faq.id);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) return;

    const next = [...ordered];
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(targetIndex, 0, moved);
    const normalized = next.map((item, itemIndex) => ({
      ...item,
      sortOrder: itemIndex * 10,
    }));

    setWorking(true);
    try {
      await reorderFaqs(
        normalized.map((item) => ({ id: item.id, sortOrder: item.sortOrder })),
      );
      setActiveFaqs(normalized);
      setSuccessMessage('FAQ 顺序已更新。');
    } catch (error) {
      handleError(error);
      await loadActive();
    } finally {
      setWorking(false);
    }
  }

  async function confirmDelete() {
    if (pendingDeleteIds.length === 0 || working) return;
    const ids = [...pendingDeleteIds];
    setWorking(true);
    setErrorMessage('');
    try {
      if (ids.length === 1 && ids[0]) await deleteFaq(ids[0]);
      else await batchDeleteFaqs(ids);
      setActiveFaqs((current) => current.filter((faq) => !ids.includes(faq.id)));
      setSelectedIds(new Set());
      setPendingDeleteIds([]);
      setSuccessMessage(`已将 ${ids.length} 条 FAQ 移入回收站。`);
    } catch (error) {
      setPendingDeleteIds([]);
      handleError(error);
    } finally {
      setWorking(false);
    }
  }

  async function handleRestore(faq: AdminFaq) {
    if (working) return;
    setWorking(true);
    try {
      const restored = await restoreFaq(faq.id);
      setTrashFaqs((current) => current.filter((item) => item.id !== faq.id));
      setActiveFaqs((current) => sortFaqs([...current, restored]));
      setSuccessMessage(`FAQ“${restored.title}”已恢复。`);
    } catch (error) {
      handleError(error);
    } finally {
      setWorking(false);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((current) => {
      const next = new Set(current);
      filteredFaqs.forEach((faq) => {
        if (allVisibleSelected) next.delete(faq.id);
        else next.add(faq.id);
      });
      return next;
    });
  }

  return (
    <section className="faq-management" aria-label="FAQ 管理">
      <div className="faq-filter-bar">
        <div className="scope-tabs" role="tablist" aria-label="FAQ 状态">
          <button
            type="button"
            className={scope === 'active' ? 'is-active' : undefined}
            onClick={() => void changeScope('active')}
          >
            当前 FAQ <span>{activeFaqs.length}</span>
          </button>
          <button
            type="button"
            className={scope === 'trash' ? 'is-active' : undefined}
            onClick={() => void changeScope('trash')}
          >
            回收站 <span>{trashFaqs.length}</span>
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
        <button
          className="primary-button faq-create-button"
          type="button"
          onClick={openCreateEditor}
        >
          新增 FAQ
        </button>
      </div>

      {!editorOpen && errorMessage ? (
        <div className="notice notice-error" role="alert">
          {errorMessage}
        </div>
      ) : null}
      {successMessage ? (
        <div className="notice notice-success" role="status">
          {successMessage}
        </div>
      ) : null}

      {scope === 'active' && selectedIds.size > 0 ? (
        <div className="selection-toolbar">
          <span>已选择 {selectedIds.size} 条 FAQ</span>
          <button
            className="danger-button"
            type="button"
            disabled={working}
            onClick={() => setPendingDeleteIds([...selectedIds])}
          >
            批量删除
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="settings-card settings-loading">
          <div className="loading-indicator" />
          <p>正在读取 FAQ…</p>
        </div>
      ) : filteredFaqs.length ? (
        <div className="faq-list">
          {scope === 'active' ? (
            <label className="faq-select-all">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleSelectAll}
              />
              <span>全选当前结果</span>
            </label>
          ) : null}
          {filteredFaqs.map((faq, index) => (
            <article className="faq-card" key={faq.id}>
              <div className="faq-card-select">
                {scope === 'active' ? (
                  <input
                    type="checkbox"
                    checked={selectedIds.has(faq.id)}
                    onChange={() => toggleSelect(faq.id)}
                    aria-label={`选择 FAQ ${faq.title}`}
                  />
                ) : null}
              </div>
              <div className="faq-card-content">
                <div className="faq-card-title-line">
                  <h3>{faq.title}</h3>
                  <button
                    type="button"
                    className={`status-pill ${faq.isEnabled ? 'is-enabled' : 'is-disabled'}`}
                    disabled={scope === 'trash' || working}
                    onClick={() => void toggleEnabled(faq)}
                  >
                    {scope === 'trash' ? '已删除' : faq.isEnabled ? '已启用' : '已停用'}
                  </button>
                </div>
                <p>{bodySummary(faq.body)}</p>
                <small>
                  排序 {faq.sortOrder} · 更新于 {formatDate(faq.updatedAt)}
                </small>
              </div>
              <div className="faq-card-actions">
                {scope === 'active' ? (
                  <>
                    <button
                      type="button"
                      title={canReorder ? '上移' : '搜索状态下不可排序'}
                      disabled={working || !canReorder || index === 0}
                      onClick={() => void moveFaq(faq, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      title={canReorder ? '下移' : '搜索状态下不可排序'}
                      disabled={
                        working || !canReorder || index === filteredFaqs.length - 1
                      }
                      onClick={() => void moveFaq(faq, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      disabled={working}
                      onClick={() => openEditEditor(faq)}
                    >
                      编辑
                    </button>
                    <button
                      className="text-danger"
                      type="button"
                      disabled={working}
                      onClick={() => setPendingDeleteIds([faq.id])}
                    >
                      删除
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={working}
                    onClick={() => void handleRestore(faq)}
                  >
                    恢复
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="faq-empty-state">
          <strong>
            {search
              ? '没有符合条件的 FAQ'
              : scope === 'trash'
                ? '回收站为空'
                : '还没有 FAQ'}
          </strong>
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
              <button
                type="button"
                aria-label="关闭"
                disabled={saving}
                onClick={() => setEditorOpen(false)}
              >
                ×
              </button>
            </div>
            <form
              className="faq-editor-form"
              onSubmit={(event) => void handleSave(event)}
            >
              {errorMessage ? (
                <div className="notice notice-error" role="alert">
                  {errorMessage}
                </div>
              ) : null}
              <label>
                <span>标题</span>
                <input
                  type="text"
                  value={form.title}
                  autoFocus
                  required
                  maxLength={300}
                  onChange={(event) => {
                    setForm((current) => ({ ...current, title: event.target.value }));
                    setErrorMessage('');
                  }}
                />
              </label>
              <div className="faq-editor-meta-grid">
                <label>
                  <span>排序</span>
                  <input
                    type="number"
                    min={0}
                    max={1_000_000}
                    step={1}
                    required
                    value={form.sortOrder}
                    onChange={(event) => {
                      setForm((current) => ({
                        ...current,
                        sortOrder: Number(event.target.value),
                      }));
                      setErrorMessage('');
                    }}
                  />
                </label>
                <label className="faq-enabled-field">
                  <input
                    type="checkbox"
                    checked={form.isEnabled}
                    onChange={(event) => {
                      setForm((current) => ({
                        ...current,
                        isEnabled: event.target.checked,
                      }));
                      setErrorMessage('');
                    }}
                  />
                  <span>启用前台展示</span>
                </label>
              </div>
              <div className="faq-body-field">
                <div className="faq-body-label">
                  <div>
                    <strong>正文</strong>
                  </div>
                  <div className="faq-editor-tabs" role="tablist">
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
                    required
                    maxLength={20_000}
                    onChange={(event) => {
                      setForm((current) => ({ ...current, body: event.target.value }));
                      setErrorMessage('');
                    }}
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

      {pendingDeleteIds.length > 0 ? (
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
                <h3 id="faq-delete-title">移入回收站？</h3>
              </div>
            </div>
            <p className="delete-warning">
              将 {pendingDeleteIds.length} 条 FAQ 移入回收站，可随后恢复。
            </p>
            <div className="admin-dialog-actions">
              <button
                type="button"
                className="secondary-button"
                disabled={working}
                onClick={() => setPendingDeleteIds([])}
              >
                取消
              </button>
              <button
                type="button"
                className="danger-button"
                disabled={working}
                onClick={() => void confirmDelete()}
              >
                {working ? '正在删除…' : '确认删除'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
