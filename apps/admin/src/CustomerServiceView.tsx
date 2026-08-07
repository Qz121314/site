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
  type CustomerServiceProvider,
} from './customer-service/api';

type CustomerServiceViewProps = { onSessionExpired: () => void };
type Scope = 'active' | 'trash';
type AuthType = 'bearer' | 'basic' | 'api_key' | 'none';
type EntryMode = 'request' | 'template';
type EntryMethod = 'GET' | 'POST';

type Draft = {
  name: string;
  provider: CustomerServiceProvider;
  baseUrl: string;
  apiToken: string;
  authType: AuthType;
  apiKeyHeader: string;
  basicUsername: string;
  projectId: string;
  projectHeaderName: string;
  groupsPath: string;
  itemsPath: string;
  idPath: string;
  namePath: string;
  enabledPath: string;
  entryMode: EntryMode;
  entryMethod: EntryMethod;
  entryPathTemplate: string;
  entryUrlPath: string;
  entryUrlTemplate: string;
  legacyPrivateConfig: string;
  isEnabled: boolean;
};

type RestV2ConfigShape = {
  auth?: { type?: AuthType; headerName?: string; username?: string };
  projectHeaderName?: string;
  groups?: { path?: string; itemsPath?: string; idPath?: string; namePath?: string; enabledPath?: string };
  entry?: { mode?: EntryMode; method?: EntryMethod; pathTemplate?: string; urlPath?: string; urlTemplate?: string };
};

const restDefaults: {
  authType: AuthType;
  apiKeyHeader: string;
  groupsPath: string;
  itemsPath: string;
  idPath: string;
  namePath: string;
  enabledPath: string;
  entryMode: EntryMode;
  entryMethod: EntryMethod;
  entryPathTemplate: string;
  entryUrlPath: string;
} = {
  authType: 'bearer',
  apiKeyHeader: 'X-API-Key',
  groupsPath: '/groups',
  itemsPath: 'auto',
  idPath: 'auto',
  namePath: 'auto',
  enabledPath: 'auto',
  entryMode: 'request',
  entryMethod: 'POST',
  entryPathTemplate: '/groups/{groupId}/entry',
  entryUrlPath: 'auto',
};

const emptyDraft: Draft = {
  name: '',
  provider: 'generic_rest_v2',
  baseUrl: '',
  apiToken: '',
  authType: restDefaults.authType,
  apiKeyHeader: restDefaults.apiKeyHeader,
  basicUsername: '',
  projectId: '',
  projectHeaderName: '',
  groupsPath: restDefaults.groupsPath,
  itemsPath: restDefaults.itemsPath,
  idPath: restDefaults.idPath,
  namePath: restDefaults.namePath,
  enabledPath: restDefaults.enabledPath,
  entryMode: restDefaults.entryMode,
  entryMethod: restDefaults.entryMethod,
  entryPathTemplate: restDefaults.entryPathTemplate,
  entryUrlPath: restDefaults.entryUrlPath,
  entryUrlTemplate: '',
  legacyPrivateConfig: '',
  isEnabled: true,
};

function isSessionError(error: unknown): boolean {
  return error instanceof AdminApiError && (error.status === 401 || error.code === 'SESSION_INVALID');
}

function sortConnections(items: CustomerServiceConnection[]) {
  return [...items].sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseRestConfig(value: string | null): RestV2ConfigShape {
  if (!value) return {};
  try {
    return (asRecord(JSON.parse(value) as unknown) ?? {}) as RestV2ConfigShape;
  } catch {
    return {};
  }
}

function toDraft(connection: CustomerServiceConnection): Draft {
  if (connection.provider === 'generic_v1') {
    return {
      ...emptyDraft,
      name: connection.name,
      provider: 'generic_v1',
      baseUrl: connection.baseUrl,
      projectId: connection.projectId ?? '',
      legacyPrivateConfig: connection.privateConfig ?? '',
      isEnabled: connection.isEnabled,
    };
  }
  const config = parseRestConfig(connection.privateConfig);
  return {
    ...emptyDraft,
    name: connection.name,
    baseUrl: connection.baseUrl,
    authType: config.auth?.type ?? restDefaults.authType,
    apiKeyHeader: config.auth?.headerName ?? restDefaults.apiKeyHeader,
    basicUsername: config.auth?.username ?? '',
    projectId: connection.projectId ?? '',
    projectHeaderName: config.projectHeaderName ?? '',
    groupsPath: config.groups?.path ?? restDefaults.groupsPath,
    itemsPath: config.groups?.itemsPath ?? restDefaults.itemsPath,
    idPath: config.groups?.idPath ?? restDefaults.idPath,
    namePath: config.groups?.namePath ?? restDefaults.namePath,
    enabledPath: config.groups?.enabledPath ?? restDefaults.enabledPath,
    entryMode: config.entry?.mode ?? restDefaults.entryMode,
    entryMethod: config.entry?.method ?? restDefaults.entryMethod,
    entryPathTemplate: config.entry?.pathTemplate ?? restDefaults.entryPathTemplate,
    entryUrlPath: config.entry?.urlPath ?? restDefaults.entryUrlPath,
    entryUrlTemplate: config.entry?.urlTemplate ?? '',
    isEnabled: connection.isEnabled,
  };
}

function buildRestPrivateConfig(draft: Draft): string | null {
  const config: RestV2ConfigShape = {};
  const customAuth = draft.authType !== restDefaults.authType;
  const customApiHeader = draft.authType === 'api_key' && draft.apiKeyHeader.trim() !== restDefaults.apiKeyHeader;
  const customBasicUser = draft.authType === 'basic' && Boolean(draft.basicUsername.trim());
  if (customAuth || customApiHeader || customBasicUser) {
    const auth: NonNullable<RestV2ConfigShape['auth']> = { type: draft.authType };
    if (draft.authType === 'api_key' && draft.apiKeyHeader.trim()) auth.headerName = draft.apiKeyHeader.trim();
    if (draft.authType === 'basic' && draft.basicUsername.trim()) auth.username = draft.basicUsername.trim();
    config.auth = auth;
  }
  if (draft.projectHeaderName.trim()) config.projectHeaderName = draft.projectHeaderName.trim();

  const groups: NonNullable<RestV2ConfigShape['groups']> = {};
  if (draft.groupsPath.trim() !== restDefaults.groupsPath) groups.path = draft.groupsPath.trim();
  if (draft.itemsPath.trim() !== restDefaults.itemsPath) groups.itemsPath = draft.itemsPath.trim();
  if (draft.idPath.trim() !== restDefaults.idPath) groups.idPath = draft.idPath.trim();
  if (draft.namePath.trim() !== restDefaults.namePath) groups.namePath = draft.namePath.trim();
  if (draft.enabledPath.trim() !== restDefaults.enabledPath) groups.enabledPath = draft.enabledPath.trim();
  if (Object.keys(groups).length > 0) config.groups = groups;

  const entry: NonNullable<RestV2ConfigShape['entry']> = {};
  if (draft.entryMode !== restDefaults.entryMode) entry.mode = draft.entryMode;
  if (draft.entryMode === 'template') {
    if (draft.entryUrlTemplate.trim()) entry.urlTemplate = draft.entryUrlTemplate.trim();
  } else {
    if (draft.entryMethod !== restDefaults.entryMethod) entry.method = draft.entryMethod;
    if (draft.entryPathTemplate.trim() !== restDefaults.entryPathTemplate) entry.pathTemplate = draft.entryPathTemplate.trim();
    if (draft.entryUrlPath.trim() !== restDefaults.entryUrlPath) entry.urlPath = draft.entryUrlPath.trim();
  }
  if (Object.keys(entry).length > 0) config.entry = entry;
  return Object.keys(config).length > 0 ? JSON.stringify(config) : null;
}

function toInput(draft: Draft, editing: CustomerServiceConnection | null): CustomerServiceConnectionInput {
  const token = draft.apiToken.trim();
  return {
    name: draft.name.trim(),
    provider: draft.provider,
    baseUrl: draft.baseUrl.trim(),
    projectId: draft.projectId.trim() || null,
    ...(editing && !token ? {} : { apiToken: token || null }),
    privateConfig: draft.provider === 'generic_v1'
      ? draft.legacyPrivateConfig.trim() || null
      : buildRestPrivateConfig(draft),
    isEnabled: draft.isEnabled,
  };
}

function providerLabel(provider: CustomerServiceProvider): string {
  return provider === 'generic_rest_v2' ? 'REST / JSON' : '标准 v1';
}

function needsCredential(draft: Draft, editing: CustomerServiceConnection | null): boolean {
  if (draft.provider === 'generic_rest_v2' && draft.authType === 'none') return false;
  return !editing?.hasApiToken;
}

function hasAdvancedRestConfig(draft: Draft): boolean {
  return Boolean(
    draft.projectId || draft.projectHeaderName ||
    draft.groupsPath !== restDefaults.groupsPath || draft.itemsPath !== restDefaults.itemsPath ||
    draft.idPath !== restDefaults.idPath || draft.namePath !== restDefaults.namePath ||
    draft.enabledPath !== restDefaults.enabledPath || draft.entryMode !== restDefaults.entryMode ||
    draft.entryMethod !== restDefaults.entryMethod || draft.entryPathTemplate !== restDefaults.entryPathTemplate ||
    draft.entryUrlPath !== restDefaults.entryUrlPath || draft.entryUrlTemplate,
  );
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
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleError = useCallback((error: unknown) => {
    if (isSessionError(error)) return onSessionExpired();
    setErrorMessage(error instanceof Error ? error.message : '客服系统操作失败。');
  }, [onSessionExpired]);

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

  useEffect(() => { void loadActive(); }, [loadActive]);
  useEffect(() => {
    setSelectedIds(new Set());
    setSearch('');
    setErrorMessage('');
    setSuccessMessage('');
  }, [scope]);

  const source = scope === 'active' ? activeConnections : trashConnections;
  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return keyword
      ? source.filter((connection) => `${connection.name} ${connection.baseUrl} ${providerLabel(connection.provider)}`.toLowerCase().includes(keyword))
      : source;
  }, [search, source]);
  const allVisibleSelected = filtered.length > 0 && filtered.every((connection) => selectedIds.has(connection.id));

  async function changeScope(next: Scope) {
    setScope(next);
    if (next !== 'trash') return;
    setLoading(true);
    try {
      setTrashConnections(sortConnections(await fetchCustomerServiceConnections('trash')));
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditingConnection(null);
    setDraft(emptyDraft);
    setAdvancedOpen(false);
    setEditorOpen(true);
    setErrorMessage('');
    setSuccessMessage('');
  }

  function openEdit(connection: CustomerServiceConnection) {
    const nextDraft = toDraft(connection);
    setEditingConnection(connection);
    setDraft(nextDraft);
    setAdvancedOpen(connection.provider === 'generic_v1'
      ? Boolean(connection.privateConfig || connection.projectId)
      : hasAdvancedRestConfig(nextDraft));
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
        const updated = await updateCustomerServiceConnection(editingConnection.id, toInput(draft, editingConnection));
        setActiveConnections((current) => sortConnections(current.map((item) => item.id === updated.id ? updated : item)));
        setSuccessMessage(`客服系统“${updated.name}”已更新。`);
      } else {
        const created = await createCustomerServiceConnection(toInput(draft, null));
        setActiveConnections((current) => sortConnections([...current, created]));
        setSuccessMessage(`客服系统“${created.name}”已添加，可点击“测试”检查分组读取。`);
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
      if (ids.length === 1) await deleteCustomerServiceConnection(ids[0] as string);
      else await batchDeleteCustomerServiceConnections(ids);
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

  const credentialRequired = needsCredential(draft, editingConnection);

  return (
    <section className="customer-service-workbench">
      <div className="customer-service-commandbar">
        <div className="segmented-control" aria-label="客服系统范围">
          <button type="button" className={scope === 'active' ? 'is-active' : undefined} onClick={() => void changeScope('active')}>客服系统</button>
          <button type="button" className={scope === 'trash' ? 'is-active' : undefined} onClick={() => void changeScope('trash')}>回收站</button>
        </div>
        <input className="customer-service-search" type="search" value={search} placeholder="搜索名称 / API 地址" onChange={(event) => setSearch(event.target.value)} />
        {scope === 'active' ? <button className="primary-button" type="button" onClick={openCreate}>添加客服系统</button> : null}
      </div>

      {errorMessage ? <p className="inline-status is-error">{errorMessage}</p> : null}
      {successMessage ? <p className="inline-status is-success">{successMessage}</p> : null}
      {scope === 'active' && selectedIds.size > 0 ? (
        <div className="selection-toolbar customer-service-selection-toolbar">
          <strong>已选择 {selectedIds.size} 项</strong>
          <button className="danger-button" type="button" onClick={() => setPendingDeleteIds([...selectedIds])}>批量删除</button>
        </div>
      ) : null}

      <div className="customer-service-table-wrap">
        <table className="customer-service-table">
          <thead><tr>
            <th className="selection-cell">{scope === 'active' ? <input type="checkbox" checked={allVisibleSelected} aria-label="选择当前结果" onChange={(event) => {
              const checked = event.target.checked;
              setSelectedIds((current) => {
                const next = new Set(current);
                filtered.forEach((item) => checked ? next.add(item.id) : next.delete(item.id));
                return next;
              });
            }} /> : null}</th>
            <th>客服系统</th><th>接入方式</th><th>API 地址</th><th>凭证</th><th>转化入口</th><th>状态</th><th className="actions-cell">操作</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={8}>正在读取客服系统…</td></tr> : filtered.length === 0 ? <tr><td colSpan={8}>暂无客服系统。</td></tr> : filtered.map((connection) => (
              <tr key={connection.id}>
                <td className="selection-cell">{scope === 'active' ? <input type="checkbox" checked={selectedIds.has(connection.id)} aria-label={`选择 ${connection.name}`} onChange={(event) => {
                  const checked = event.target.checked;
                  setSelectedIds((current) => {
                    const next = new Set(current);
                    if (checked) next.add(connection.id); else next.delete(connection.id);
                    return next;
                  });
                }} /> : null}</td>
                <td><strong>{connection.name}</strong></td>
                <td><span className="customer-service-provider-chip">{providerLabel(connection.provider)}</span></td>
                <td className="customer-service-url">{connection.baseUrl}</td>
                <td>{connection.hasApiToken ? '已配置' : '无需 / 未配置'}</td>
                <td>{connection.targetCount}</td>
                <td><span className={connection.isEnabled ? 'status-chip is-configured' : 'status-chip'}>{connection.isEnabled ? '启用' : '停用'}</span></td>
                <td className="actions-cell">{scope === 'active' ? <div className="row-actions">
                  <button type="button" disabled={testingId === connection.id} onClick={() => void testConnection(connection)}>{testingId === connection.id ? '测试中…' : '测试'}</button>
                  <button type="button" onClick={() => openEdit(connection)}>编辑</button>
                  <button className="danger-link" type="button" disabled={connection.targetCount > 0} onClick={() => setPendingDeleteIds([connection.id])}>删除</button>
                </div> : <button type="button" onClick={() => void restore(connection)}>恢复</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editorOpen ? <div className="admin-dialog-backdrop" role="presentation">
        <section className="admin-dialog customer-service-editor" role="dialog" aria-modal="true">
          <div className="admin-dialog-header"><div><p>客服管理</p><h3>{editingConnection ? '编辑客服系统' : '添加客服系统'}</h3></div><button type="button" aria-label="关闭" disabled={saving} onClick={() => setEditorOpen(false)}>×</button></div>
          <form className="customer-service-editor-form" onSubmit={(event) => void submit(event)}>
            <label><span>连接名称</span><input type="text" autoFocus required maxLength={120} value={draft.name} placeholder="例如：主站客服" onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></label>
            <label><span>接入方式</span><select value={draft.provider} onChange={(event) => {
              const provider = event.target.value as CustomerServiceProvider;
              setDraft((current) => ({ ...current, provider }));
              setAdvancedOpen(provider === 'generic_v1');
            }}><option value="generic_rest_v2">通用 REST / JSON（推荐）</option><option value="generic_v1">标准客服接口 v1（旧版）</option></select></label>
            <label className="customer-service-editor-wide"><span>API 地址</span><input type="url" required placeholder="https://support.example.com/api" value={draft.baseUrl} onChange={(event) => setDraft((current) => ({ ...current, baseUrl: event.target.value }))} /></label>

            {draft.provider === 'generic_rest_v2' ? <>
              <label><span>认证方式</span><select value={draft.authType} onChange={(event) => setDraft((current) => ({ ...current, authType: event.target.value as AuthType }))}><option value="bearer">Bearer / OAuth Token</option><option value="api_key">API Key Header</option><option value="basic">Basic Auth</option><option value="none">无需认证</option></select></label>
              {draft.authType !== 'none' ? <label><span>{draft.authType === 'basic' ? '密码 / API Key' : draft.authType === 'api_key' ? 'API Key' : `Token${editingConnection?.hasApiToken ? '（已配置）' : ''}`}</span><input type="password" autoComplete="new-password" required={credentialRequired} maxLength={4000} value={draft.apiToken} placeholder={editingConnection?.hasApiToken ? '留空保持原凭证' : undefined} onChange={(event) => setDraft((current) => ({ ...current, apiToken: event.target.value }))} /></label> : <div />}
              {draft.authType === 'api_key' ? <label><span>Header 名称</span><input type="text" value={draft.apiKeyHeader} placeholder="X-API-Key" onChange={(event) => setDraft((current) => ({ ...current, apiKeyHeader: event.target.value }))} /></label> : null}
              {draft.authType === 'basic' ? <label><span>用户名</span><input type="text" value={draft.basicUsername} onChange={(event) => setDraft((current) => ({ ...current, basicUsername: event.target.value }))} /></label> : null}
            </> : <>
              <label><span>项目 ID</span><input type="text" maxLength={200} value={draft.projectId} onChange={(event) => setDraft((current) => ({ ...current, projectId: event.target.value }))} /></label>
              <label><span>API Token{editingConnection?.hasApiToken ? '（已配置）' : ''}</span><input type="password" autoComplete="new-password" maxLength={4000} value={draft.apiToken} placeholder={editingConnection?.hasApiToken ? '留空保持原凭证' : undefined} onChange={(event) => setDraft((current) => ({ ...current, apiToken: event.target.value }))} /></label>
            </>}

            <div className="customer-service-editor-wide customer-service-simple-options">
              <label className="switch-row customer-service-enable-row"><span><strong>启用连接</strong></span><input type="checkbox" checked={draft.isEnabled} onChange={(event) => setDraft((current) => ({ ...current, isEnabled: event.target.checked }))} /></label>
              <button className="customer-service-advanced-toggle" type="button" onClick={() => setAdvancedOpen((value) => !value)} aria-expanded={advancedOpen}>{advancedOpen ? '收起高级设置' : '高级设置'}</button>
            </div>

            {advancedOpen ? draft.provider === 'generic_v1' ? <label className="customer-service-editor-wide"><span>旧版扩展配置 JSON</span><textarea rows={4} spellCheck={false} value={draft.legacyPrivateConfig} onChange={(event) => setDraft((current) => ({ ...current, legacyPrivateConfig: event.target.value }))} /></label> : <div className="customer-service-editor-wide customer-service-advanced-panel"><div className="customer-service-advanced-grid">
              <label><span>项目 / 工作区 ID</span><input type="text" value={draft.projectId} onChange={(event) => setDraft((current) => ({ ...current, projectId: event.target.value }))} /></label>
              <label><span>项目 Header</span><input type="text" value={draft.projectHeaderName} placeholder="例如 X-Project-Id" onChange={(event) => setDraft((current) => ({ ...current, projectHeaderName: event.target.value }))} /></label>
              <label><span>分组接口</span><input type="text" value={draft.groupsPath} placeholder="/groups" onChange={(event) => setDraft((current) => ({ ...current, groupsPath: event.target.value }))} /></label>
              <label><span>列表路径</span><input type="text" value={draft.itemsPath} placeholder="auto" onChange={(event) => setDraft((current) => ({ ...current, itemsPath: event.target.value }))} /></label>
              <label><span>ID 字段</span><input type="text" value={draft.idPath} placeholder="auto" onChange={(event) => setDraft((current) => ({ ...current, idPath: event.target.value }))} /></label>
              <label><span>名称字段</span><input type="text" value={draft.namePath} placeholder="auto" onChange={(event) => setDraft((current) => ({ ...current, namePath: event.target.value }))} /></label>
              <label><span>状态字段</span><input type="text" value={draft.enabledPath} placeholder="auto" onChange={(event) => setDraft((current) => ({ ...current, enabledPath: event.target.value }))} /></label>
              <label><span>会话入口方式</span><select value={draft.entryMode} onChange={(event) => setDraft((current) => ({ ...current, entryMode: event.target.value as EntryMode }))}><option value="request">接口请求</option><option value="template">URL 模板</option></select></label>
              {draft.entryMode === 'request' ? <>
                <label><span>请求方法</span><select value={draft.entryMethod} onChange={(event) => setDraft((current) => ({ ...current, entryMethod: event.target.value as EntryMethod }))}><option value="POST">POST</option><option value="GET">GET</option></select></label>
                <label className="customer-service-advanced-wide"><span>会话入口路径</span><input type="text" value={draft.entryPathTemplate} placeholder="/groups/{groupId}/entry" onChange={(event) => setDraft((current) => ({ ...current, entryPathTemplate: event.target.value }))} /></label>
                <label><span>返回 URL 字段</span><input type="text" value={draft.entryUrlPath} placeholder="auto" onChange={(event) => setDraft((current) => ({ ...current, entryUrlPath: event.target.value }))} /></label>
              </> : <label className="customer-service-advanced-wide"><span>会话 URL 模板</span><input type="url" value={draft.entryUrlTemplate} placeholder="https://chat.example.com/?group={groupId}" onChange={(event) => setDraft((current) => ({ ...current, entryUrlTemplate: event.target.value }))} /></label>}
            </div></div> : null}

            <div className="admin-dialog-actions customer-service-editor-wide"><button className="secondary-button" type="button" disabled={saving} onClick={() => setEditorOpen(false)}>取消</button><button className="primary-button" type="submit" disabled={saving}>{saving ? '正在保存…' : '保存连接'}</button></div>
          </form>
        </section>
      </div> : null}

      {pendingDeleteIds.length > 0 ? <div className="admin-dialog-backdrop" role="presentation"><section className="admin-dialog compact-confirm-dialog" role="dialog" aria-modal="true"><div className="admin-dialog-header"><div><p>客服管理</p><h3>确认删除 {pendingDeleteIds.length} 项</h3></div></div><div className="admin-dialog-actions"><button className="secondary-button" type="button" disabled={saving} onClick={() => setPendingDeleteIds([])}>取消</button><button className="danger-button" type="button" disabled={saving} onClick={() => void confirmDelete()}>{saving ? '正在删除…' : '确认删除'}</button></div></section></div> : null}
    </section>
  );
}
