import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { AdminApiError } from './api';
import {
  batchDeleteCustomerServiceConnections,
  createCustomerServiceConnection,
  deleteCustomerServiceConnection,
  fetchCustomerServiceConnections,
  restoreCustomerServiceConnection,
  testCustomerServiceConnection,
  updateCustomerServiceConnection,
  type CustomerServiceConnection,
  type CustomerServiceConnectionInput,
} from './customer-service/api';

type CustomerServiceViewProps = {
  onSessionExpired: () => void;
};

type Scope = 'active' | 'trash';

type Draft = {
  name: string;
  baseUrl: string;
  projectId: string;
  apiToken: string;
  privateConfig: string;
  isEnabled: boolean;
};

const emptyDraft: Draft = {
  name: '',
  baseUrl: '',
  projectId: '',
  apiToken: '',
  privateConfig: '',
  isEnabled: true,
};

function isSessionError(error: unknown): boolean {
  return error instanceof AdminApiError && (error.status === 401 || error.code === 'SESSION_INVALID');
}

function sortConnections(items: CustomerServiceConnection[]) {
  return [...items].sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
}

function toDraft(connection: CustomerServiceConnection): Draft {
  return {
    name: connection.name,
    baseUrl: connection.baseUrl,
    projectId: connection.projectId ?? '',
    apiToken: '',
    privateConfig: connection.privateConfig ?? '',
    isEnabled: connection.isEnabled,
  };
}

function toInput(draft: Draft, editing: CustomerServiceConnection | null): CustomerServiceConnectionInput {
  const token = draft.apiToken.trim();
  return {
    name: draft.name.trim(),
    provider: 'generic_v1',
    baseUrl: draft.baseUrl.trim(),
    projectId: draft.projectId.trim() || null,
    ...(editing && !token ? {} : { apiToken: token || null }),
    privateConfig: draft.privateConfig.trim() || null,
    isEnabled: draft.isEnabled,
  };
}

export function CustomerServiceView({ onSessionExpired }: CustomerServiceViewProps) {
  const [scope, setScope] = useState<Scope>('active');
  const [activeConnections, setActiveConnections] = useState<CustomerServiceConnection[]>([]);
  const [trashConnections, setTrashConnections] = useState<CustomerServiceConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingConnection, setEditingConnection] = useState<CustomerServiceConnection | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleError = useCallback(
    (error: unknown) => {
      if (isSessionError(error)) {
        onSessionExpired();
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : '客服系统操作失败。');
    },
    [onSessionExpired],
  );

  const loadActive = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      setActiveConnections(sortConnections(await fetchCustomerServiceConnections('active')));
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
    setSearch('');
    setErrorMessage('');
    setSuccessMessage('');
  }, [scope]);

  const source = scope === 'active' ? activeConnections : trashConnections;
  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return source;
    return source.filter((connection) =>
      `${connection.name} ${connection.baseUrl} ${connection.projectId ?? ''}`
        .toLowerCase()
        .includes(keyword),
    );
  }, [search, source]);
  const allVisibleSelected =
    filtered.length > 0 && filtered.every((connection) => selectedIds.has(connection.id));

  async function changeScope(next: Scope) {
    setScope(next);
    if (next === 'trash') {
      setLoading(true);
      try {
        setTrashConnections(sortConnections(await fetchCustomerServiceConnections('trash')));
      } catch (error) {
        handleError(error);
      } finally {
        setLoading(false);
      }
    }
  }

  function openCreate() {
    setEditingConnection(null);
    setDraft(emptyDraft);
    setEditorOpen(true);
    setErrorMessage('');
    setSuccessMessage('');
  }

  function openEdit(connection: CustomerServiceConnection) {
    setEditingConnection(connection);
    setDraft(toDraft(connection));
    setEditorOpen(true);
    setErrorMessage('');
    setSuccessMessage('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      if (editingConnection) {
        const updated = await updateCustomerServiceConnection(
          editingConnection.id,
          toInput(draft, editingConnection),
        );
        setActiveConnections((current) =>
          sortConnections(current.map((item) => (item.id === updated.id ? updated : item))),
        );
        setSuccessMessage(`客服系统“${updated.name}”已更新。`);
      } else {
        const created = await createCustomerServiceConnection(toInput(draft, null));
        setActiveConnections((current) => sortConnections([...current, created]));
        setSuccessMessage(`客服系统“${created.name}”已添加。`);
      }
      setEditorOpen(false);
    } catch (error) {
      handleError(error);
    } finally {
      setSaving(false);
    }
  }

  async function testConnection(connection: CustomerServiceConnection) {
    setTestingId(connection.id);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const result = await testCustomerServiceConnection(connection.id);
      setSuccessMessage(`“${connection.name}”连接正常，读取到 ${result.groupCount} 个客服分组。`);
    } catch (error) {
      handleError(error);
    } finally {
      setTestingId(null);
    }
  }

  async function restore(connection: CustomerServiceConnection) {
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const restored = await restoreCustomerServiceConnection(connection.id);
      setTrashConnections((current) => current.filter((item) => item.id !== restored.id));
      setActiveConnections((current) => sortConnections([...current, restored]));
      setSuccessMessage(`客服系统“${restored.name}”已恢复。`);
    } catch (error) {
      handleError(error);
    }
  }

  async function confirmDelete() {
    if (pendingDeleteIds.length === 0) return;
    setSaving(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const ids = [...pendingDeleteIds];
      if (ids.length === 1) {
        await deleteCustomerServiceConnection(ids[0] as string);
      } else {
        await batchDeleteCustomerServiceConnections(ids);
      }
      setActiveConnections((current) => current.filter((item) => !ids.includes(item.id)));
      setSelectedIds((current) => {
        const next = new Set(current);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      setPendingDeleteIds([]);
      setSuccessMessage(ids.length === 1 ? '客服系统已移入回收站。' : `已删除 ${ids.length} 个客服系统。`);
    } catch (error) {
      handleError(error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="customer-service-workbench">
      <div className="customer-service-commandbar">
        <div className="segmented-control" aria-label="客服系统范围">
          <button
            type="button"
            className={scope === 'active' ? 'is-active' : undefined}
            onClick={() => void changeScope('active')}
          >
            客服系统
          </button>
          <button
            type="button"
            className={scope === 'trash' ? 'is-active' : undefined}
            onClick={() => void changeScope('trash')}
          >
            回收站
          </button>
        </div>
        <input
          className="customer-service-search"
          type="search"
          value={search}
          placeholder="搜索名称 / API 地址 / 项目 ID"
          onChange={(event) => setSearch(event.target.value)}
        />
        {scope === 'active' ? (
          <button className="primary-button" type="button" onClick={openCreate}>
            添加客服系统
          </button>
        ) : null}
      </div>

      {errorMessage ? <p className="inline-status is-error">{errorMessage}</p> : null}
      {successMessage ? <p className="inline-status is-success">{successMessage}</p> : null}

      {scope === 'active' && selectedIds.size > 0 ? (
        <div className="selection-toolbar customer-service-selection-toolbar">
          <strong>已选择 {selectedIds.size} 项</strong>
          <button
            className="danger-button"
            type="button"
            onClick={() => setPendingDeleteIds([...selectedIds])}
          >
            批量删除
          </button>
        </div>
      ) : null}

      <div className="customer-service-table-wrap">
        <table className="customer-service-table">
          <thead>
            <tr>
              <th className="selection-cell">
                {scope === 'active' ? (
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    aria-label="选择当前结果"
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setSelectedIds((current) => {
                        const next = new Set(current);
                        filtered.forEach((item) => {
                          if (checked) next.add(item.id);
                          else next.delete(item.id);
                        });
                        return next;
                      });
                    }}
                  />
                ) : null}
              </th>
              <th>客服系统</th>
              <th>接口</th>
              <th>项目</th>
              <th>凭证</th>
              <th>转化入口</th>
              <th>状态</th>
              <th className="actions-cell">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8}>正在读取客服系统…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8}>暂无客服系统。</td></tr>
            ) : (
              filtered.map((connection) => (
                <tr key={connection.id}>
                  <td className="selection-cell">
                    {scope === 'active' ? (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(connection.id)}
                        aria-label={`选择 ${connection.name}`}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setSelectedIds((current) => {
                            const next = new Set(current);
                            if (checked) next.add(connection.id);
                            else next.delete(connection.id);
                            return next;
                          });
                        }}
                      />
                    ) : null}
                  </td>
                  <td><strong>{connection.name}</strong></td>
                  <td className="customer-service-url">{connection.baseUrl}</td>
                  <td>{connection.projectId ?? '—'}</td>
                  <td>{connection.hasApiToken ? 'Token 已配置' : '无 Token'}</td>
                  <td>{connection.targetCount}</td>
                  <td>
                    <span className={connection.isEnabled ? 'status-chip is-configured' : 'status-chip'}>
                      {connection.isEnabled ? '启用' : '停用'}
                    </span>
                  </td>
                  <td className="actions-cell">
                    {scope === 'active' ? (
                      <div className="row-actions">
                        <button
                          type="button"
                          disabled={testingId === connection.id}
                          onClick={() => void testConnection(connection)}
                        >
                          {testingId === connection.id ? '测试中…' : '测试'}
                        </button>
                        <button type="button" onClick={() => openEdit(connection)}>编辑</button>
                        <button
                          className="danger-link"
                          type="button"
                          disabled={connection.targetCount > 0}
                          onClick={() => setPendingDeleteIds([connection.id])}
                        >
                          删除
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => void restore(connection)}>恢复</button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editorOpen ? (
        <div className="admin-dialog-backdrop" role="presentation">
          <section className="admin-dialog customer-service-editor" role="dialog" aria-modal="true">
            <div className="admin-dialog-header">
              <div>
                <p>客服管理</p>
                <h3>{editingConnection ? '编辑客服系统' : '添加客服系统'}</h3>
              </div>
              <button type="button" aria-label="关闭" disabled={saving} onClick={() => setEditorOpen(false)}>×</button>
            </div>
            <form className="customer-service-editor-form" onSubmit={(event) => void submit(event)}>
              <label>
                <span>连接名称</span>
                <input
                  type="text"
                  autoFocus
                  maxLength={120}
                  value={draft.name}
                  onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                />
              </label>
              <label>
                <span>项目 ID</span>
                <input
                  type="text"
                  maxLength={200}
                  value={draft.projectId}
                  onChange={(event) => setDraft((current) => ({ ...current, projectId: event.target.value }))}
                />
              </label>
              <label className="customer-service-editor-wide">
                <span>API 根地址</span>
                <input
                  type="url"
                  placeholder="https://support.example.com/api/integration/v1"
                  value={draft.baseUrl}
                  onChange={(event) => setDraft((current) => ({ ...current, baseUrl: event.target.value }))}
                />
              </label>
              <label className="customer-service-editor-wide">
                <span>API Token{editingConnection?.hasApiToken ? '（已配置）' : ''}</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  maxLength={4000}
                  value={draft.apiToken}
                  onChange={(event) => setDraft((current) => ({ ...current, apiToken: event.target.value }))}
                />
              </label>
              <label className="customer-service-editor-wide">
                <span>私有扩展配置 JSON</span>
                <textarea
                  rows={4}
                  spellCheck={false}
                  value={draft.privateConfig}
                  onChange={(event) => setDraft((current) => ({ ...current, privateConfig: event.target.value }))}
                />
              </label>
              <label className="switch-row customer-service-editor-wide">
                <span><strong>启用连接</strong></span>
                <input
                  type="checkbox"
                  checked={draft.isEnabled}
                  onChange={(event) => setDraft((current) => ({ ...current, isEnabled: event.target.checked }))}
                />
              </label>
              <div className="admin-dialog-actions customer-service-editor-wide">
                <button className="secondary-button" type="button" disabled={saving} onClick={() => setEditorOpen(false)}>
                  取消
                </button>
                <button className="primary-button" type="submit" disabled={saving}>
                  {saving ? '正在保存…' : '保存'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {pendingDeleteIds.length > 0 ? (
        <div className="admin-dialog-backdrop" role="presentation">
          <section className="admin-dialog compact-confirm-dialog" role="dialog" aria-modal="true">
            <div className="admin-dialog-header">
              <div>
                <p>客服管理</p>
                <h3>确认删除 {pendingDeleteIds.length} 项</h3>
              </div>
            </div>
            <div className="admin-dialog-actions">
              <button className="secondary-button" type="button" disabled={saving} onClick={() => setPendingDeleteIds([])}>
                取消
              </button>
              <button className="danger-button" type="button" disabled={saving} onClick={() => void confirmDelete()}>
                {saving ? '正在删除…' : '确认删除'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
