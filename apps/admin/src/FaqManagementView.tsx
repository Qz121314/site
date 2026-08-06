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
  type FaqScope,
} from './faq-management/api';

type FaqManagementViewProps = {
  onSessionExpired: () => void;
};

const emptyFaqForm: FaqInput = {
  question: '',
  answer: '',
  sortOrder: 0,
  isEnabled: true,
};

function sortFaqs(faqs: AdminFaq[]): AdminFaq[] {
  return [...faqs].sort(
    (left, right) => left.sortOrder - right.sortOrder || left.question.localeCompare(right.question),
  );
}

function isSessionError(error: unknown): boolean {
  return error instanceof AdminApiError && (error.status === 401 || error.code === 'SESSION_INVALID');
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN');
}

export function FaqManagementView({ onSessionExpired }: FaqManagementViewProps) {
  const [scope, setScope] = useState<Exclude<FaqScope, 'all'>>('active');
  const [activeFaqs, setActiveFaqs] = useState<AdminFaq[]>([]);
  const [trashFaqs, setTrashFaqs] = useState<AdminFaq[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingFaq, setEditingFaq] = useState<AdminFaq | null>(null);
  const [form, setForm] = useState<FaqInput>(emptyFaqForm);
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
      setActiveFaqs(await fetchFaqs('active'));
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
    if (!keyword) return sourceFaqs;
    return sourceFaqs.filter((faq) =>
      `${faq.question} ${faq.answer}`.toLowerCase().includes(keyword),
    );
  }, [search, sourceFaqs]);

  const allVisibleSelected =
    filteredFaqs.length > 0 && filteredFaqs.every((faq) => selectedIds.has(faq.id));

  async function changeScope(nextScope: Exclude<FaqScope, 'all'>) {
    setScope(nextScope);
    if (nextScope === 'trash') {
      setLoading(true);
      try {
        setTrashFaqs(await fetchFaqs('trash'));
      } catch (error) {
        handleError(error);
      } finally {
        setLoading(false);
      }
    }
  }

  function openCreateEditor() {
    const sortOrder = activeFaqs.length
      ? Math.max(...activeFaqs.map((faq) => faq.sortOrder)) + 10
      : 0;
    setEditingFaq(null);
    setForm({ ...emptyFaqForm, sortOrder });
    setErrorMessage('');
    setEditorOpen(true);
  }

  function openEditEditor(faq: AdminFaq) {
    setEditingFaq(faq);
    setForm({
      question: faq.question,
      answer: faq.answer,
      sortOrder: faq.sortOrder,
      isEnabled: faq.isEnabled,
    });
    setErrorMessage('');
    setEditorOpen(true);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      if (editingFaq) {
        const updated = await updateFaq(editingFaq.id, form);
        setActiveFaqs((current) =>
          sortFaqs(current.map((faq) => (faq.id === updated.id ? updated : faq))),
        );
        setSuccessMessage('FAQ 已更新。');
      } else {
        const created = await createFaq(form);
        setActiveFaqs((current) => sortFaqs([...current, created]));
        setSuccessMessage('FAQ 已创建。');
      }
      setEditorOpen(false);
    } catch (error) {
      handleError(error);
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled(faq: AdminFaq) {
    setWorking(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const updated = await updateFaq(faq.id, {
        question: faq.question,
        answer: faq.answer,
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
    const ordered = sortFaqs(activeFaqs).map((item) => ({ ...item }));
    const currentIndex = ordered.findIndex((item) => item.id === faq.id);
    const targetIndex = currentIndex + direction;
    const current = ordered[currentIndex];
    const target = ordered[targetIndex];
    if (!current || !target) return;

    const currentOrder = current.sortOrder;
    current.sortOrder = target.sortOrder;
    target.sortOrder = currentOrder;

    setWorking(true);
    setErrorMessage('');
    try {
      await reorderFaqs([
        { id: current.id, sortOrder: current.sortOrder },
        { id: target.id, sortOrder: target.sortOrder },
      ]);
      setActiveFaqs(sortFaqs(ordered));
      setSuccessMessage('FAQ 顺序已更新。');
    } catch (error) {
      handleError(error);
      await loadActive();
    } finally {
      setWorking(false);
    }
  }

  async function confirmDelete() {
    if (pendingDeleteIds.length === 0) return;

    const deletingIds = [...pendingDeleteIds];
    setWorking(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const firstId = deletingIds[0];
      if (deletingIds.length === 1 && firstId) {
        await deleteFaq(firstId);
      } else {
        await batchDeleteFaqs(deletingIds);
      }
      setActiveFaqs((current) => current.filter((faq) => !deletingIds.includes(faq.id)));
      setSelectedIds(new Set());
      setPendingDeleteIds([]);
      setSuccessMessage(`已将 ${deletingIds.length} 条 FAQ 移入回收站。`);
    } catch (error) {
      setPendingDeleteIds([]);
      handleError(error);
    } finally {
      setWorking(false);
    }
  }

  async function handleRestore(faq: AdminFaq) {
    setWorking(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const restored = await restoreFaq(faq.id);
      setTrashFaqs((current) => current.filter((item) => item.id !== faq.id));
      setActiveFaqs((current) => sortFaqs([...current, restored]));
      setSuccessMessage('FAQ 已恢复。');
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
    <section className="faq-management section-management" aria-labelledby="faq-management-title">
      <div className="section-management-toolbar">
        <div>
          <p>全站公共内容</p>
          <h2 id="faq-management-title">FAQ 管理</h2>
          <span>FAQ 不属于任何分区，启用后将用于 English 用户前端。</span>
        </div>
        <button className="primary-button" type="button" onClick={openCreateEditor}>
          新增 FAQ
        </button>
      </div>

      <div className="section-filter-bar">
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
        <label className="section-search">
          <span>搜索</span>
          <input
            type="search"
            value={search}
            placeholder="问题或答案"
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>

      {errorMessage ? <div className="notice notice-error" role="alert">{errorMessage}</div> : null}
      {successMessage ? <div className="notice notice-success" role="status">{successMessage}</div> : null}

      {scope === 'active' && selectedIds.size > 0 ? (
        <div className="selection-toolbar">
          <span>已选择 {selectedIds.size} 条 FAQ</span>
          <button
            type="button"
            className="danger-button"
            disabled={working}
            onClick={() => setPendingDeleteIds([...selectedIds])}
          >
            批量删除
          </button>
        </div>
      ) : null}

      <div className="section-table-wrap">
        {loading ? (
          <div className="section-table-empty" aria-live="polite">
            <strong>正在读取 FAQ…</strong>
          </div>
        ) : filteredFaqs.length === 0 ? (
          <div className="section-table-empty">
            <strong>{scope === 'active' ? '还没有 FAQ' : '回收站为空'}</strong>
            <p>{scope === 'active' ? '点击“新增 FAQ”录入第一条内容。' : '删除的 FAQ 会显示在这里。'}</p>
          </div>
        ) : (
          <table className="section-table faq-table">
            <thead>
              <tr>
                <th className="checkbox-cell">
                  {scope === 'active' ? (
                    <input
                      type="checkbox"
                      aria-label="选择当前搜索结果中的全部 FAQ"
                      checked={allVisibleSelected}
                      disabled={working}
                      onChange={toggleSelectAll}
                    />
                  ) : null}
                </th>
                <th>问题与答案</th>
                <th>排序</th>
                <th>状态</th>
                <th>更新时间</th>
                <th className="actions-cell">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredFaqs.map((faq, index) => (
                <tr key={faq.id}>
                  <td className="checkbox-cell">
                    {scope === 'active' ? (
                      <input
                        type="checkbox"
                        aria-label={`选择 ${faq.question}`}
                        checked={selectedIds.has(faq.id)}
                        disabled={working}
                        onChange={() => toggleSelect(faq.id)}
                      />
                    ) : null}
                  </td>
                  <td>
                    <div className="faq-content-cell">
                      <strong>{faq.question}</strong>
                      <p>{faq.answer}</p>
                    </div>
                  </td>
                  <td>
                    {scope === 'active' ? (
                      <div className="sort-controls">
                        <span>{faq.sortOrder}</span>
                        <div>
                          <button
                            type="button"
                            aria-label="上移"
                            disabled={working || index === 0}
                            onClick={() => void moveFaq(faq, -1)}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            aria-label="下移"
                            disabled={working || index === filteredFaqs.length - 1}
                            onClick={() => void moveFaq(faq, 1)}
                          >
                            ↓
                          </button>
                        </div>
                      </div>
                    ) : (
                      faq.sortOrder
                    )}
                  </td>
                  <td>
                    {scope === 'active' ? (
                      <button
                        type="button"
                        className={`status-pill ${faq.isEnabled ? 'is-enabled' : 'is-disabled'}`}
                        disabled={working}
                        onClick={() => void toggleEnabled(faq)}
                      >
                        {faq.isEnabled ? '已启用' : '已停用'}
                      </button>
                    ) : (
                      <span className="status-pill is-deleted">已删除</span>
                    )}
                  </td>
                  <td>{formatDate(faq.updatedAt)}</td>
                  <td className="actions-cell">
                    {scope === 'active' ? (
                      <>
                        <button type="button" disabled={working} onClick={() => openEditEditor(faq)}>
                          编辑
                        </button>
                        <button
                          type="button"
                          className="text-danger"
                          disabled={working}
                          onClick={() => setPendingDeleteIds([faq.id])}
                        >
                          删除
                        </button>
                      </>
                    ) : (
                      <button type="button" disabled={working} onClick={() => void handleRestore(faq)}>
                        恢复
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

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
                <p>{editingFaq ? '编辑内容' : '新增内容'}</p>
                <h3 id="faq-editor-title">{editingFaq ? '编辑 FAQ' : '新增 FAQ'}</h3>
              </div>
              <button type="button" aria-label="关闭" disabled={saving} onClick={() => setEditorOpen(false)}>
                ×
              </button>
            </div>
            <form className="section-editor-form faq-editor-form" onSubmit={(event) => void handleSave(event)}>
              <label>
                <span>问题</span>
                <input
                  type="text"
                  required
                  maxLength={300}
                  value={form.question}
                  onChange={(event) => setForm((current) => ({ ...current, question: event.target.value }))}
                />
              </label>
              <label>
                <span>答案</span>
                <textarea
                  required
                  maxLength={5000}
                  rows={9}
                  value={form.answer}
                  onChange={(event) => setForm((current) => ({ ...current, answer: event.target.value }))}
                />
              </label>
              <label>
                <span>排序</span>
                <input
                  type="number"
                  min={0}
                  max={1000000}
                  step={1}
                  value={form.sortOrder}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, sortOrder: Number(event.target.value) }))
                  }
                />
              </label>
              <label className="switch-row">
                <span>
                  <strong>前端启用</strong>
                  <small>停用后保留内容，但不在用户前端展示。</small>
                </span>
                <input
                  type="checkbox"
                  checked={form.isEnabled}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, isEnabled: event.target.checked }))
                  }
                />
              </label>
              <div className="admin-dialog-actions">
                <button type="button" className="secondary-button" disabled={saving} onClick={() => setEditorOpen(false)}>
                  取消
                </button>
                <button type="submit" className="primary-button" disabled={saving}>
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
                <p>删除确认</p>
                <h3 id="faq-delete-title">删除 {pendingDeleteIds.length} 条 FAQ？</h3>
              </div>
            </div>
            <p className="delete-warning">FAQ 将进入回收站并停止在用户前端展示，之后仍可恢复。</p>
            <div className="admin-dialog-actions">
              <button type="button" className="secondary-button" disabled={working} onClick={() => setPendingDeleteIds([])}>
                取消
              </button>
              <button type="button" className="danger-button" disabled={working} onClick={() => void confirmDelete()}>
                {working ? '正在删除…' : '确认删除'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
