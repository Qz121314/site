import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AdminApiError,
  batchDeleteSections,
  createSection,
  deleteSection,
  fetchSections,
  reorderSections,
  restoreSection,
  updateSection,
  type AdminSection,
  type SectionInput,
  type SectionScope,
} from './api';

const iconOptions = ['◈', '◎', '◇', '✦', '⌂', '◉', '◆', '▣', '✚', '✺', '⬡', '◫'] as const;

const emptyForm: SectionInput = {
  name: '',
  iconValue: iconOptions[0],
  sortOrder: 0,
  isEnabled: true,
};

type SectionManagementViewProps = {
  activeSections: AdminSection[];
  onActiveSectionsChange: (sections: AdminSection[]) => void;
  onSessionExpired: () => void;
};

function describeError(error: unknown): string {
  if (!(error instanceof AdminApiError)) {
    return '操作失败，请稍后重试。';
  }

  if (error.code === 'SECTION_HAS_DEPENDENCIES') {
    return `${error.message} 当前关联 ${error.productCount ?? 0} 个产品、${error.conversionMethodCount ?? 0} 个转化方式。`;
  }

  return error.message;
}

function isSessionError(error: unknown): boolean {
  return error instanceof AdminApiError && (error.status === 401 || error.code === 'SESSION_INVALID');
}

export function SectionManagementView({
  activeSections,
  onActiveSectionsChange,
  onSessionExpired,
}: SectionManagementViewProps) {
  const [scope, setScope] = useState<SectionScope>('active');
  const [trashSections, setTrashSections] = useState<AdminSection[]>([]);
  const [loadingTrash, setLoadingTrash] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<AdminSection | null>(null);
  const [form, setForm] = useState<SectionInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [working, setWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);

  const sourceSections = scope === 'trash' ? trashSections : activeSections;
  const filteredSections = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) {
      return sourceSections;
    }
    return sourceSections.filter((section) =>
      `${section.name} ${section.slug}`.toLowerCase().includes(keyword),
    );
  }, [search, sourceSections]);

  const allVisibleSelected =
    filteredSections.length > 0 && filteredSections.every((section) => selectedIds.has(section.id));

  useEffect(() => {
    setSelectedIds(new Set());
    setErrorMessage('');
    setSuccessMessage('');
  }, [scope]);

  async function loadTrash() {
    setLoadingTrash(true);
    try {
      setTrashSections(await fetchSections('trash'));
    } catch (error) {
      if (isSessionError(error)) {
        onSessionExpired();
        return;
      }
      setErrorMessage(describeError(error));
    } finally {
      setLoadingTrash(false);
    }
  }

  async function refreshActive() {
    try {
      onActiveSectionsChange(await fetchSections('active'));
    } catch (error) {
      if (isSessionError(error)) {
        onSessionExpired();
        return;
      }
      setErrorMessage(describeError(error));
    }
  }

  async function changeScope(nextScope: SectionScope) {
    setScope(nextScope);
    if (nextScope === 'trash') {
      await loadTrash();
    }
  }

  function openCreateEditor() {
    const nextSortOrder = activeSections.length === 0
      ? 0
      : Math.max(...activeSections.map((section) => section.sortOrder)) + 10;
    setEditingSection(null);
    setForm({ ...emptyForm, sortOrder: nextSortOrder });
    setErrorMessage('');
    setEditorOpen(true);
  }

  function openEditEditor(section: AdminSection) {
    setEditingSection(section);
    setForm({
      name: section.name,
      iconValue: section.iconValue ?? iconOptions[0],
      sortOrder: section.sortOrder,
      isEnabled: section.isEnabled,
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
      if (editingSection) {
        const updated = await updateSection(editingSection.id, form);
        onActiveSectionsChange(
          activeSections
            .map((section) => (section.id === updated.id ? updated : section))
            .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)),
        );
        setSuccessMessage(`分区“${updated.name}”已更新。`);
      } else {
        const created = await createSection(form);
        onActiveSectionsChange(
          [...activeSections, created].sort(
            (left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name),
          ),
        );
        setSuccessMessage(`分区“${created.name}”已创建，左侧业务菜单已生成。`);
      }
      setEditorOpen(false);
    } catch (error) {
      if (isSessionError(error)) {
        onSessionExpired();
        return;
      }
      setErrorMessage(describeError(error));
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled(section: AdminSection) {
    setWorking(true);
    setErrorMessage('');
    try {
      const updated = await updateSection(section.id, {
        name: section.name,
        iconValue: section.iconValue ?? iconOptions[0],
        sortOrder: section.sortOrder,
        isEnabled: !section.isEnabled,
      });
      onActiveSectionsChange(
        activeSections.map((item) => (item.id === updated.id ? updated : item)),
      );
      setSuccessMessage(updated.isEnabled ? '分区已启用。' : '分区已停用。');
    } catch (error) {
      if (isSessionError(error)) {
        onSessionExpired();
        return;
      }
      setErrorMessage(describeError(error));
    } finally {
      setWorking(false);
    }
  }

  async function confirmDelete() {
    if (pendingDeleteIds.length === 0) {
      return;
    }

    setWorking(true);
    setErrorMessage('');
    try {
      if (pendingDeleteIds.length === 1) {
        await deleteSection(pendingDeleteIds[0] ?? '');
      } else {
        await batchDeleteSections(pendingDeleteIds);
      }
      onActiveSectionsChange(
        activeSections.filter((section) => !pendingDeleteIds.includes(section.id)),
      );
      setSelectedIds(new Set());
      setPendingDeleteIds([]);
      setSuccessMessage(`已将 ${pendingDeleteIds.length} 个分区移入回收站。`);
    } catch (error) {
      if (isSessionError(error)) {
        onSessionExpired();
        return;
      }
      setPendingDeleteIds([]);
      setErrorMessage(describeError(error));
    } finally {
      setWorking(false);
    }
  }

  async function handleRestore(section: AdminSection) {
    setWorking(true);
    setErrorMessage('');
    try {
      const restored = await restoreSection(section.id);
      setTrashSections((current) => current.filter((item) => item.id !== section.id));
      onActiveSectionsChange(
        [...activeSections, restored].sort(
          (left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name),
        ),
      );
      setSuccessMessage(`分区“${restored.name}”已恢复。`);
    } catch (error) {
      if (isSessionError(error)) {
        onSessionExpired();
        return;
      }
      setErrorMessage(describeError(error));
    } finally {
      setWorking(false);
    }
  }

  async function moveSection(section: AdminSection, direction: -1 | 1) {
    const ordered = [...activeSections].sort(
      (left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name),
    );
    const currentIndex = ordered.findIndex((item) => item.id === section.id);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= ordered.length) {
      return;
    }

    const target = ordered[targetIndex];
    if (!target) {
      return;
    }

    const next = ordered.map((item) => ({ ...item }));
    const currentCopy = next[currentIndex];
    const targetCopy = next[targetIndex];
    if (!currentCopy || !targetCopy) {
      return;
    }

    const currentOrder = currentCopy.sortOrder;
    currentCopy.sortOrder = targetCopy.sortOrder;
    targetCopy.sortOrder = currentOrder;
    next.sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));

    setWorking(true);
    setErrorMessage('');
    try {
      await reorderSections([
        { id: currentCopy.id, sortOrder: currentCopy.sortOrder },
        { id: targetCopy.id, sortOrder: targetCopy.sortOrder },
      ]);
      onActiveSectionsChange(next);
      setSuccessMessage('分区顺序已更新。');
    } catch (error) {
      if (isSessionError(error)) {
        onSessionExpired();
        return;
      }
      setErrorMessage(describeError(error));
      await refreshActive();
    } finally {
      setWorking(false);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        filteredSections.forEach((section) => next.delete(section.id));
      } else {
        filteredSections.forEach((section) => next.add(section.id));
      }
      return next;
    });
  }

  return (
    <section className="section-management" aria-labelledby="section-management-title">
      <div className="section-management-toolbar">
        <div>
          <p>动态业务结构</p>
          <h2 id="section-management-title">分区管理</h2>
          <span>分区名称将直接用于 English 用户前端和后台动态菜单。</span>
        </div>
        <button className="primary-button" type="button" onClick={openCreateEditor}>
          新增分区
        </button>
      </div>

      <div className="section-filter-bar">
        <div className="scope-tabs" role="tablist" aria-label="分区状态">
          <button
            type="button"
            className={scope === 'active' ? 'is-active' : undefined}
            onClick={() => void changeScope('active')}
          >
            当前分区 <span>{activeSections.length}</span>
          </button>
          <button
            type="button"
            className={scope === 'trash' ? 'is-active' : undefined}
            onClick={() => void changeScope('trash')}
          >
            回收站 <span>{trashSections.length}</span>
          </button>
        </div>
        <label className="section-search">
          <span>搜索</span>
          <input
            type="search"
            value={search}
            placeholder="名称或 slug"
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>

      {errorMessage ? <div className="notice notice-error" role="alert">{errorMessage}</div> : null}
      {successMessage ? <div className="notice notice-success" role="status">{successMessage}</div> : null}

      {scope === 'active' && selectedIds.size > 0 ? (
        <div className="selection-toolbar">
          <span>已选择 {selectedIds.size} 个分区</span>
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
        <table className="section-table">
          <thead>
            <tr>
              <th className="checkbox-cell">
                {scope === 'active' ? (
                  <input
                    type="checkbox"
                    aria-label="选择当前页全部分区"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAll}
                  />
                ) : null}
              </th>
              <th>分区</th>
              <th>排序</th>
              <th>状态</th>
              <th>关联内容</th>
              <th className="actions-cell">操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredSections.map((section, index) => (
              <tr key={section.id}>
                <td className="checkbox-cell">
                  {scope === 'active' ? (
                    <input
                      type="checkbox"
                      aria-label={`选择 ${section.name}`}
                      checked={selectedIds.has(section.id)}
                      onChange={() => toggleSelect(section.id)}
                    />
                  ) : null}
                </td>
                <td>
                  <div className="section-identity">
                    <span className="section-icon" aria-hidden="true">
                      {section.iconValue ?? '◈'}
                    </span>
                    <div>
                      <strong>{section.name}</strong>
                      <small>/{section.slug}</small>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="sort-controls">
                    <strong>{section.sortOrder}</strong>
                    {scope === 'active' ? (
                      <div>
                        <button
                          type="button"
                          aria-label={`上移 ${section.name}`}
                          disabled={working || index === 0}
                          onClick={() => void moveSection(section, -1)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          aria-label={`下移 ${section.name}`}
                          disabled={working || index === filteredSections.length - 1}
                          onClick={() => void moveSection(section, 1)}
                        >
                          ↓
                        </button>
                      </div>
                    ) : null}
                  </div>
                </td>
                <td>
                  {scope === 'trash' ? (
                    <span className="status-pill is-deleted">已删除</span>
                  ) : (
                    <button
                      className={`status-pill ${section.isEnabled ? 'is-enabled' : 'is-disabled'}`}
                      type="button"
                      disabled={working}
                      onClick={() => void toggleEnabled(section)}
                    >
                      {section.isEnabled ? '已启用' : '已停用'}
                    </button>
                  )}
                </td>
                <td>
                  <span className="relation-count">产品 {section.productCount}</span>
                  <span className="relation-count">转化 {section.conversionMethodCount}</span>
                </td>
                <td className="actions-cell">
                  {scope === 'trash' ? (
                    <button type="button" disabled={working} onClick={() => void handleRestore(section)}>
                      恢复
                    </button>
                  ) : (
                    <>
                      <button type="button" onClick={() => openEditEditor(section)}>
                        编辑
                      </button>
                      <button
                        className="text-danger"
                        type="button"
                        disabled={working}
                        onClick={() => setPendingDeleteIds([section.id])}
                      >
                        删除
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {(loadingTrash || filteredSections.length === 0) ? (
          <div className="section-table-empty">
            <strong>{loadingTrash ? '正在读取回收站…' : '没有符合条件的分区'}</strong>
            <p>{scope === 'active' ? '创建第一个分区后会立即生成左侧业务菜单。' : '已删除分区会显示在这里。'}</p>
          </div>
        ) : null}
      </div>

      {editorOpen ? (
        <div className="admin-dialog-backdrop" role="presentation">
          <section className="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="section-editor-title">
            <div className="admin-dialog-header">
              <div>
                <p>{editingSection ? '修改现有分区' : '创建业务分区'}</p>
                <h3 id="section-editor-title">{editingSection ? '编辑分区' : '新增分区'}</h3>
              </div>
              <button type="button" aria-label="关闭" onClick={() => setEditorOpen(false)}>×</button>
            </div>

            <form className="section-editor-form" onSubmit={handleSave}>
              <label>
                <span>分区名称</span>
                <input
                  type="text"
                  value={form.name}
                  placeholder="例如 Massage"
                  autoFocus
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                />
                <small>请输入用户前端实际显示的 English 名称。</small>
              </label>

              <fieldset>
                <legend>分区图标</legend>
                <div className="icon-picker">
                  {iconOptions.map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      className={form.iconValue === icon ? 'is-selected' : undefined}
                      aria-label={`选择图标 ${icon}`}
                      onClick={() => setForm((current) => ({ ...current, iconValue: icon }))}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </fieldset>

              <label>
                <span>排序</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.sortOrder}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, sortOrder: Number(event.target.value) }))
                  }
                />
                <small>数字越小越靠前，也可以在列表中使用上下移动。</small>
              </label>

              <label className="switch-row">
                <span>
                  <strong>是否启用</strong>
                  <small>停用后不进入用户前端发布内容。</small>
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
                <button type="button" className="secondary-button" onClick={() => setEditorOpen(false)}>
                  取消
                </button>
                <button type="submit" className="primary-button" disabled={saving}>
                  {saving ? '正在保存…' : editingSection ? '保存修改' : '创建分区'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {pendingDeleteIds.length > 0 ? (
        <div className="admin-dialog-backdrop" role="presentation">
          <section className="admin-dialog admin-dialog-small" role="alertdialog" aria-modal="true" aria-labelledby="delete-title">
            <div className="admin-dialog-header">
              <div>
                <p>软删除确认</p>
                <h3 id="delete-title">删除 {pendingDeleteIds.length} 个分区？</h3>
              </div>
            </div>
            <p className="delete-warning">
              分区将进入回收站并自动停用。存在关联产品或转化方式的分区不会被删除。
            </p>
            <div className="admin-dialog-actions">
              <button type="button" className="secondary-button" onClick={() => setPendingDeleteIds([])}>
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
