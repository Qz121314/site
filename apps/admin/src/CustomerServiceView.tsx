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
  verifyToken: string;
  isEnabled: boolean;
};

const emptyDraft: Draft = {
  name: '',
  baseUrl: '',
  verifyToken: '',
  isEnabled: true,
};

function isSessionError(error: unknown): boolean {
  return (
    error instanceof AdminApiError &&
    (error.status === 401 || error.code === 'SESSION_INVALID')
  );
}

function sortConnections(items: CustomerServiceConnection[]) {
  return [...items].sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
}

function toDraft(connection: CustomerServiceConnection): Draft {
  return {
    name: connection.name,
    baseUrl: connection.baseUrl,
    verifyToken: '',
    isEnabled: connection.isEnabled,
  };
}

function toInput(
  draft: Draft,
  editing: CustomerServiceConnection | null,
): CustomerServiceConnectionInput {
  const verifyToken = draft.verifyToken.trim();
  return {
    name: draft.name.trim(),
    provider: 'generic_v1',
    baseUrl: draft.baseUrl.trim(),
    ...(editing && !verifyToken ? {} : { verifyToken: verifyToken || null }),
    isEnabled: draft.isEnabled,
  };
}

function verifiedLabel(connection: CustomerServiceConnection): string {
  if (!connection.hasVerifyToken) return '未配置 Token';
  if (!connection.verifiedAt || !connection.clientApiUrl || !connection.realtimeUrl) {
    return '待验证';
  }
  return '已验证';
}

export function CustomerServiceView({ onSessionExpired }: CustomerServiceViewProps) {
  const [scope, setScope] = useState<Scope>('active');
  const [activeConnections, setActiveConnections] = useState<CustomerServiceConnection[]>(
    [],
  );
  const [trashConnections, setTrashConnections] = useState<CustomerServiceConnection[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingConnection, setEditingConnection] =
    useState<CustomerServiceConnection | null>(null);
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
      setActiveConnections(
        sortConnections(await fetchCustomerServiceConnections('active')),
      );
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
      `${connection.name} ${connection.baseUrl}`.toLowerCase().includes(keyword),
    );
  }, [search, source]);
  const allVisibleSelected =
    filtered.length > 0 && filtered.every((connection) => selectedIds.has(connection.id));

  async function changeScope(next: Scope) {
    setScope(next);
    if (next === 'trash') {
      setLoading(true);
      try {
        setTrashConnections(
          sortConnections(await fetchCustomerServiceConnections('trash')),
        );
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
          sortConnections(
            current.map((item) => (item.id === updated.id ? updated : item)),
          ),
        );
        setSuccessMessage(`客服系统“${updated.name}”已更新。`);
      } else {
        const created = await createCustomerServiceConnection(toInput(draft, null));
        setActiveConnections((current) => sortConnections([...current, created]));
        setSuccessMessage(`客服系统“${created.name}”已添加，请验证连接。`);
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
      await loadActive();
      setSuccessMessage(
        `“${connection.name}”验证成功，已同步 ${result.productCount} 个在线客服产品。`,
      );
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
      setSuccessMessage(
        ids.length === 1 ? '客服系统已移入回收站。' : `已删除 ${ids.length} 个客服系统。`,
      );
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

        <div className="customer-service-toolbar-actions">
          <label className="customer-service-search">
            <span className="sr-only">搜索客服系统</span>
            <input
              type="search"
              value={search}
              placeholder="搜索名称或公网地址"
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          {scope === 'active' ? (
            <button type="button" className="primary-button" onClick={openCreate}>
              新增客服系统
            </button>
          ) : null}
        </div>
      </div>

      {errorMessage ? <div className="notice notice-error">{errorMessage}</div> : null}
      {successMessage ? (
        <div className="notice notice-success">{successMessage}</div>
      ) : null}

      {scope === 'active' && selectedIds.size > 0 ? (
        <div className="selection-toolbar">
          <span>已选择 {selectedIds.size} 项</span>
          <button
            type="button"
            className="danger-button"
            onClick={() => setPendingDeleteIds([...selectedIds])}
          >
            批量删除
          </button>
        </div>
      ) : null}

      <div className="customer-service-table-wrap">
        <table className="admin-table customer-service-table">
          <thead>
            <tr>
              {scope === 'active' ? (
                <th className="selection-column">
                  <input
                    type="checkbox"
                    aria-label="全选当前客服系统"
                    checked={allVisibleSelected}
                    onChange={(event) => {
                      const next = new Set(selectedIds);
                      filtered.forEach((connection) => {
                        if (event.target.checked) next.add(connection.id);
                        else next.delete(connection.id);
                      });
                      setSelectedIds(next);
                    }}
                  />
                </th>
              ) : null}
              <th>名称</th>
              <th>公网地址</th>
              <th>连接状态</th>
              <th>使用中</th>
              <th>更新时间</th>
              <th className="actions-column">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={scope === 'active' ? 7 : 6}>正在读取…</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={scope === 'active' ? 7 : 6}>
                  {scope === 'active' ? '暂无客服系统。' : '回收站为空。'}
                </td>
              </tr>
            ) : (
              filtered.map((connection) => (
                <tr key={connection.id}>
                  {scope === 'active' ? (
                    <td className="selection-column">
                      <input
                        type="checkbox"
                        aria-label={`选择 ${connection.name}`}
                        checked={selectedIds.has(connection.id)}
                        onChange={(event) => {
                          const next = new Set(selectedIds);
                          if (event.target.checked) next.add(connection.id);
                          else next.delete(connection.id);
                          setSelectedIds(next);
                        }}
                      />
                    </td>
                  ) : null}
                  <td>
                    <strong>{connection.name}</strong>
                  </td>
                  <td>
                    <code>{connection.baseUrl}</code>
                  </td>
                  <td>
                    <span
                      className={`status-badge ${
                        connection.verifiedAt ? 'is-success' : 'is-muted'
                      }`}
                    >
                      {verifiedLabel(connection)}
                    </span>
                  </td>
                  <td>{connection.targetCount} 个转化分组</td>
                  <td>{new Date(connection.updatedAt).toLocaleString('zh-CN')}</td>
                  <td className="actions-column">
                    {scope === 'active' ? (
                      <div className="table-actions">
                        <button
                          type="button"
                          className="table-action"
                          disabled={testingId === connection.id}
                          onClick={() => void testConnection(connection)}
                        >
                          {testingId === connection.id ? '验证中…' : '验证'}
                        </button>
                        <button
                          type="button"
                          className="table-action"
                          onClick={() => openEdit(connection)}
                        >
                          编辑
                        </button>
                        <button
                          type="button"
                          className="table-action is-danger"
                          disabled={connection.targetCount > 0}
                          onClick={() => setPendingDeleteIds([connection.id])}
                        >
                          删除
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="table-action"
                        onClick={() => void restore(connection)}
                      >
                        恢复
                      </button>
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
          <section
            className="admin-dialog customer-service-editor"
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-service-editor-title"
          >
            <div className="admin-dialog-header">
              <div>
                <p>客服系统</p>
                <h3 id="customer-service-editor-title">
                  {editingConnection ? '编辑连接' : '新增连接'}
                </h3>
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

            <form className="customer-service-editor-form" onSubmit={submit}>
              <label>
                <span>名称</span>
                <input
                  type="text"
                  value={draft.name}
                  autoFocus
                  required
                  maxLength={100}
                  placeholder="例如：主客服系统"
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                />
              </label>

              <label>
                <span>公网地址</span>
                <input
                  type="url"
                  value={draft.baseUrl}
                  required
                  placeholder="https://support.example.com"
                  onChange={(event) =>
                    setDraft({ ...draft, baseUrl: event.target.value })
                  }
                />
                <small>填写客服管理系统的公网 HTTPS 地址。</small>
              </label>

              <label>
                <span>验证 Token</span>
                <input
                  type="password"
                  value={draft.verifyToken}
                  required={!editingConnection?.hasVerifyToken}
                  autoComplete="new-password"
                  placeholder={
                    editingConnection?.hasVerifyToken ? '留空表示保持当前 Token' : '必填'
                  }
                  onChange={(event) =>
                    setDraft({ ...draft, verifyToken: event.target.value })
                  }
                />
                <small>只用于后台验证，不会暴露给前端访客。</small>
              </label>

              <label className="switch-row">
                <span>
                  <strong>启用连接</strong>
                  <small>关闭后，前端不会使用这个客服系统。</small>
                </span>
                <input
                  type="checkbox"
                  checked={draft.isEnabled}
                  onChange={(event) =>
                    setDraft({ ...draft, isEnabled: event.target.checked })
                  }
                />
              </label>

              <div className="admin-dialog-actions">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={saving}
                  onClick={() => setEditorOpen(false)}
                >
                  取消
                </button>
                <button type="submit" className="primary-button" disabled={saving}>
                  {saving ? '正在保存…' : '保存'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {pendingDeleteIds.length > 0 ? (
        <div className="admin-dialog-backdrop" role="presentation">
          <section className="admin-dialog" role="dialog" aria-modal="true">
            <div className="admin-dialog-header">
              <div>
                <p>删除客服系统</p>
                <h3>确认移入回收站？</h3>
              </div>
            </div>
            <p>
              {pendingDeleteIds.length === 1
                ? '删除后可在回收站恢复。正在被转化分组使用的客服系统不能删除。'
                : `将删除 ${pendingDeleteIds.length} 个客服系统，删除后可在回收站恢复。`}
            </p>
            <div className="admin-dialog-actions">
              <button
                type="button"
                className="secondary-button"
                disabled={saving}
                onClick={() => setPendingDeleteIds([])}
              >
                取消
              </button>
              <button
                type="button"
                className="danger-button"
                disabled={saving}
                onClick={() => void confirmDelete()}
              >
                {saving ? '正在删除…' : '确认删除'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
