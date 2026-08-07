import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { AdminApiError, type AdminSection } from './api';
import { ConversionGroupEditorDialog } from './conversion-pool/ConversionGroupEditorDialog';
import { ConversionTargetEditorDialog } from './conversion-pool/ConversionTargetEditorDialog';
import {
  batchDeleteConversionGroups,
  batchDeleteConversionTargets,
  createConversionGroup,
  createConversionTarget,
  deleteConversionGroup,
  deleteConversionTarget,
  fetchConversionGroups,
  fetchConversionTargets,
  previewRotation,
  reorderConversionGroups,
  reorderConversionTargets,
  restoreConversionGroup,
  restoreConversionTarget,
  updateConversionGroup,
  updateConversionTarget,
  type AdminConversionGroup,
  type AdminConversionTarget,
  type ConversionGroupInput,
  type ConversionTargetInput,
} from './conversion-pool/api';

type Props = {
  section: AdminSection;
  onSessionExpired: () => void;
};

type Scope = 'active' | 'trash';
type DeleteState =
  | { kind: 'group'; ids: string[] }
  | { kind: 'target'; ids: string[] }
  | null;

const emptyGroupForm: ConversionGroupInput = {
  name: '',
  mode: 'customer_service',
  buttonLabel: 'Contact Us',
  sortOrder: 0,
  isEnabled: true,
};

const emptyTargetForm: ConversionTargetInput = {
  name: '',
  endpointUrl: null,
  customerServiceConnectionId: null,
  remoteGroupId: null,
  remoteGroupName: null,
  sortOrder: 0,
  isEnabled: true,
};

function sortGroups(groups: AdminConversionGroup[]): AdminConversionGroup[] {
  return [...groups].sort(
    (left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name),
  );
}

function sortTargets(targets: AdminConversionTarget[]): AdminConversionTarget[] {
  return [...targets].sort(
    (left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name),
  );
}

function isSessionError(error: unknown): boolean {
  return error instanceof AdminApiError && (error.status === 401 || error.code === 'SESSION_INVALID');
}

function modeLabel(group: AdminConversionGroup): string {
  return group.mode === 'customer_service' ? '在线客服' : '链接跳转';
}

function readinessLabel(group: AdminConversionGroup): string {
  if (!group.isEnabled) return '已停用';
  if (group.activeTargetCount === 0) return '未配置可用入口';
  return `可轮换 ${group.activeTargetCount} 个入口`;
}

function shortUrl(value: string | null): string {
  if (!value) return '—';
  try {
    const url = new URL(value);
    return `${url.host}${url.pathname === '/' ? '' : url.pathname}`;
  } catch {
    return value;
  }
}

function targetSearchText(target: AdminConversionTarget): string {
  return [
    target.name,
    target.endpointUrl,
    target.customerServiceConnectionName,
    target.remoteGroupName,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function targetToInput(target: AdminConversionTarget): ConversionTargetInput {
  return {
    name: target.name,
    endpointUrl: target.endpointUrl,
    customerServiceConnectionId: target.customerServiceConnectionId,
    remoteGroupId: target.remoteGroupId,
    remoteGroupName: target.remoteGroupName,
    sortOrder: target.sortOrder,
    isEnabled: target.isEnabled,
  };
}

export function ConversionPoolView({ section, onSessionExpired }: Props) {
  const [groupScope, setGroupScope] = useState<Scope>('active');
  const [activeGroups, setActiveGroups] = useState<AdminConversionGroup[]>([]);
  const [trashGroups, setTrashGroups] = useState<AdminConversionGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [groupSearch, setGroupSearch] = useState('');
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [editingGroup, setEditingGroup] = useState<AdminConversionGroup | null>(null);
  const [groupForm, setGroupForm] = useState<ConversionGroupInput>(emptyGroupForm);
  const [groupEditorOpen, setGroupEditorOpen] = useState(false);

  const [targetScope, setTargetScope] = useState<Scope>('active');
  const [activeTargets, setActiveTargets] = useState<AdminConversionTarget[]>([]);
  const [trashTargets, setTrashTargets] = useState<AdminConversionTarget[]>([]);
  const [targetsLoading, setTargetsLoading] = useState(false);
  const [targetSearch, setTargetSearch] = useState('');
  const [selectedTargetIds, setSelectedTargetIds] = useState<Set<string>>(new Set());
  const [editingTarget, setEditingTarget] = useState<AdminConversionTarget | null>(null);
  const [targetForm, setTargetForm] = useState<ConversionTargetInput>(emptyTargetForm);
  const [targetEditorOpen, setTargetEditorOpen] = useState(false);

  const [saving, setSaving] = useState(false);
  const [working, setWorking] = useState(false);
  const [deleteState, setDeleteState] = useState<DeleteState>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [rotationMessage, setRotationMessage] = useState('');

  const selectedGroup = useMemo(
    () => activeGroups.find((group) => group.id === selectedGroupId) ?? null,
    [activeGroups, selectedGroupId],
  );

  const handleError = useCallback(
    (error: unknown) => {
      if (isSessionError(error)) {
        onSessionExpired();
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : '转化池操作失败。');
    },
    [onSessionExpired],
  );

  const loadActiveGroups = useCallback(async () => {
    setGroupsLoading(true);
    setErrorMessage('');
    try {
      const groups = await fetchConversionGroups(section.id, 'active');
      setActiveGroups(groups);
      setSelectedGroupId((current) =>
        current && groups.some((group) => group.id === current) ? current : null,
      );
    } catch (error) {
      handleError(error);
    } finally {
      setGroupsLoading(false);
    }
  }, [handleError, section.id]);

  const loadActiveTargets = useCallback(
    async (groupId: string) => {
      setTargetsLoading(true);
      setErrorMessage('');
      try {
        setActiveTargets(await fetchConversionTargets(section.id, groupId, 'active'));
      } catch (error) {
        handleError(error);
      } finally {
        setTargetsLoading(false);
      }
    },
    [handleError, section.id],
  );

  useEffect(() => {
    setGroupScope('active');
    setGroupSearch('');
    setSelectedGroupIds(new Set());
    setSelectedGroupId(null);
    setTrashGroups([]);
    setActiveTargets([]);
    setTrashTargets([]);
    setErrorMessage('');
    setSuccessMessage('');
    setRotationMessage('');
    void loadActiveGroups();
  }, [loadActiveGroups]);

  useEffect(() => {
    setTargetScope('active');
    setTargetSearch('');
    setSelectedTargetIds(new Set());
    setTrashTargets([]);
    setRotationMessage('');
    if (selectedGroupId) void loadActiveTargets(selectedGroupId);
    else setActiveTargets([]);
  }, [loadActiveTargets, selectedGroupId]);

  const sourceGroups = groupScope === 'active' ? activeGroups : trashGroups;
  const filteredGroups = useMemo(() => {
    const keyword = groupSearch.trim().toLowerCase();
    return keyword
      ? sourceGroups.filter((group) =>
          `${group.name} ${group.buttonLabel} ${modeLabel(group)}`.toLowerCase().includes(keyword),
        )
      : sourceGroups;
  }, [groupSearch, sourceGroups]);

  const sourceTargets = targetScope === 'active' ? activeTargets : trashTargets;
  const filteredTargets = useMemo(() => {
    const keyword = targetSearch.trim().toLowerCase();
    return keyword ? sourceTargets.filter((target) => targetSearchText(target).includes(keyword)) : sourceTargets;
  }, [sourceTargets, targetSearch]);

  const allGroupsSelected =
    filteredGroups.length > 0 && filteredGroups.every((group) => selectedGroupIds.has(group.id));
  const allTargetsSelected =
    filteredTargets.length > 0 && filteredTargets.every((target) => selectedTargetIds.has(target.id));

  async function changeGroupScope(scope: Scope) {
    setGroupScope(scope);
    setSelectedGroupIds(new Set());
    setErrorMessage('');
    setSuccessMessage('');
    if (scope === 'trash') {
      setGroupsLoading(true);
      try {
        setTrashGroups(await fetchConversionGroups(section.id, 'trash'));
      } catch (error) {
        handleError(error);
      } finally {
        setGroupsLoading(false);
      }
    }
  }

  async function changeTargetScope(scope: Scope) {
    if (!selectedGroup) return;
    setTargetScope(scope);
    setSelectedTargetIds(new Set());
    setErrorMessage('');
    setSuccessMessage('');
    if (scope === 'trash') {
      setTargetsLoading(true);
      try {
        setTrashTargets(await fetchConversionTargets(section.id, selectedGroup.id, 'trash'));
      } catch (error) {
        handleError(error);
      } finally {
        setTargetsLoading(false);
      }
    }
  }

  function openCreateGroup() {
    const sortOrder = activeGroups.length
      ? Math.max(...activeGroups.map((group) => group.sortOrder)) + 10
      : 0;
    setEditingGroup(null);
    setGroupForm({ ...emptyGroupForm, sortOrder });
    setGroupEditorOpen(true);
    setErrorMessage('');
    setSuccessMessage('');
  }

  function openEditGroup(group: AdminConversionGroup) {
    setEditingGroup(group);
    setGroupForm({
      name: group.name,
      mode: group.mode,
      buttonLabel: group.buttonLabel,
      sortOrder: group.sortOrder,
      isEnabled: group.isEnabled,
    });
    setGroupEditorOpen(true);
    setErrorMessage('');
    setSuccessMessage('');
  }

  async function saveGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      if (editingGroup) {
        const updated = await updateConversionGroup(section.id, editingGroup.id, groupForm);
        setActiveGroups((current) =>
          sortGroups(current.map((group) => (group.id === updated.id ? updated : group))),
        );
        setSuccessMessage(`转化分组“${updated.name}”已更新。`);
      } else {
        const created = await createConversionGroup(section.id, groupForm);
        setActiveGroups((current) => sortGroups([...current, created]));
        setSuccessMessage(`转化分组“${created.name}”已创建。`);
      }
      setGroupEditorOpen(false);
    } catch (error) {
      handleError(error);
    } finally {
      setSaving(false);
    }
  }

  async function toggleGroup(group: AdminConversionGroup) {
    setWorking(true);
    setErrorMessage('');
    try {
      const updated = await updateConversionGroup(section.id, group.id, {
        name: group.name,
        mode: group.mode,
        buttonLabel: group.buttonLabel,
        sortOrder: group.sortOrder,
        isEnabled: !group.isEnabled,
      });
      setActiveGroups((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setSuccessMessage(updated.isEnabled ? '转化分组已启用。' : '转化分组已停用。');
    } catch (error) {
      handleError(error);
    } finally {
      setWorking(false);
    }
  }

  async function moveGroup(group: AdminConversionGroup, direction: -1 | 1) {
    const ordered = sortGroups(activeGroups).map((item) => ({ ...item }));
    const index = ordered.findIndex((item) => item.id === group.id);
    const current = ordered[index];
    const target = ordered[index + direction];
    if (!current || !target) return;
    const order = current.sortOrder;
    current.sortOrder = target.sortOrder;
    target.sortOrder = order;
    setWorking(true);
    try {
      await reorderConversionGroups(section.id, [
        { id: current.id, sortOrder: current.sortOrder },
        { id: target.id, sortOrder: target.sortOrder },
      ]);
      setActiveGroups(sortGroups(ordered));
      setSuccessMessage('转化分组顺序已更新。');
    } catch (error) {
      handleError(error);
      await loadActiveGroups();
    } finally {
      setWorking(false);
    }
  }

  async function restoreGroup(group: AdminConversionGroup) {
    setWorking(true);
    try {
      const restored = await restoreConversionGroup(section.id, group.id);
      setTrashGroups((current) => current.filter((item) => item.id !== group.id));
      setActiveGroups((current) => sortGroups([...current, restored]));
      setSuccessMessage(`转化分组“${restored.name}”已恢复。`);
    } catch (error) {
      handleError(error);
    } finally {
      setWorking(false);
    }
  }

  function openCreateTarget() {
    if (!selectedGroup) return;
    const sortOrder = activeTargets.length
      ? Math.max(...activeTargets.map((target) => target.sortOrder)) + 10
      : 0;
    setEditingTarget(null);
    setTargetForm({ ...emptyTargetForm, sortOrder });
    setTargetEditorOpen(true);
    setErrorMessage('');
    setSuccessMessage('');
  }

  function openEditTarget(target: AdminConversionTarget) {
    setEditingTarget(target);
    setTargetForm(targetToInput(target));
    setTargetEditorOpen(true);
    setErrorMessage('');
    setSuccessMessage('');
  }

  async function saveTarget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedGroup || saving) return;
    setSaving(true);
    setErrorMessage('');
    try {
      if (editingTarget) {
        const updated = await updateConversionTarget(
          section.id,
          selectedGroup.id,
          editingTarget.id,
          targetForm,
        );
        setActiveTargets((current) =>
          sortTargets(current.map((target) => (target.id === updated.id ? updated : target))),
        );
        setSuccessMessage(`转化入口“${updated.name}”已更新。`);
      } else {
        const created = await createConversionTarget(section.id, selectedGroup.id, targetForm);
        setActiveTargets((current) => sortTargets([...current, created]));
        setSuccessMessage(`转化入口“${created.name}”已创建。`);
      }
      setTargetEditorOpen(false);
      await loadActiveGroups();
    } catch (error) {
      handleError(error);
    } finally {
      setSaving(false);
    }
  }

  async function toggleTarget(target: AdminConversionTarget) {
    if (!selectedGroup || target.bindingKind === 'legacy_customer_service') return;
    setWorking(true);
    try {
      const updated = await updateConversionTarget(section.id, selectedGroup.id, target.id, {
        ...targetToInput(target),
        isEnabled: !target.isEnabled,
      });
      setActiveTargets((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      await loadActiveGroups();
      setSuccessMessage(updated.isEnabled ? '转化入口已启用。' : '转化入口已停用。');
    } catch (error) {
      handleError(error);
    } finally {
      setWorking(false);
    }
  }

  async function moveTarget(target: AdminConversionTarget, direction: -1 | 1) {
    if (!selectedGroup) return;
    const ordered = sortTargets(activeTargets).map((item) => ({ ...item }));
    const index = ordered.findIndex((item) => item.id === target.id);
    const current = ordered[index];
    const swap = ordered[index + direction];
    if (!current || !swap) return;
    const order = current.sortOrder;
    current.sortOrder = swap.sortOrder;
    swap.sortOrder = order;
    setWorking(true);
    try {
      await reorderConversionTargets(section.id, selectedGroup.id, [
        { id: current.id, sortOrder: current.sortOrder },
        { id: swap.id, sortOrder: swap.sortOrder },
      ]);
      setActiveTargets(sortTargets(ordered));
      setSuccessMessage('转化入口顺序已更新。');
    } catch (error) {
      handleError(error);
      await loadActiveTargets(selectedGroup.id);
    } finally {
      setWorking(false);
    }
  }

  async function restoreTarget(target: AdminConversionTarget) {
    if (!selectedGroup) return;
    setWorking(true);
    try {
      const restored = await restoreConversionTarget(section.id, selectedGroup.id, target.id);
      setTrashTargets((current) => current.filter((item) => item.id !== target.id));
      setActiveTargets((current) => sortTargets([...current, restored]));
      await loadActiveGroups();
      setSuccessMessage(`转化入口“${restored.name}”已恢复。`);
    } catch (error) {
      handleError(error);
    } finally {
      setWorking(false);
    }
  }

  async function runRotationPreview(group: AdminConversionGroup) {
    setWorking(true);
    setRotationMessage('');
    setErrorMessage('');
    try {
      const target = await previewRotation(section.id, group.id);
      setRotationMessage(
        group.mode === 'customer_service'
          ? `本次轮换命中：${target.customerServiceConnectionName ?? '客服系统'} / ${target.remoteGroupName ?? target.name}`
          : `本次轮换命中：${target.name} · ${shortUrl(target.endpointUrl)}`,
      );
    } catch (error) {
      handleError(error);
    } finally {
      setWorking(false);
    }
  }

  async function confirmDelete() {
    if (!deleteState || working) return;
    setWorking(true);
    setErrorMessage('');
    try {
      if (deleteState.kind === 'group') {
        const first = deleteState.ids[0];
        if (deleteState.ids.length === 1 && first) {
          await deleteConversionGroup(section.id, first);
        } else {
          await batchDeleteConversionGroups(section.id, deleteState.ids);
        }
        setActiveGroups((current) => current.filter((group) => !deleteState.ids.includes(group.id)));
        if (selectedGroupId && deleteState.ids.includes(selectedGroupId)) setSelectedGroupId(null);
        setSelectedGroupIds(new Set());
        setSuccessMessage(`已将 ${deleteState.ids.length} 个转化分组移入回收站。`);
      } else if (selectedGroup) {
        const first = deleteState.ids[0];
        if (deleteState.ids.length === 1 && first) {
          await deleteConversionTarget(section.id, selectedGroup.id, first);
        } else {
          await batchDeleteConversionTargets(section.id, selectedGroup.id, deleteState.ids);
        }
        setActiveTargets((current) => current.filter((target) => !deleteState.ids.includes(target.id)));
        setSelectedTargetIds(new Set());
        setSuccessMessage(`已将 ${deleteState.ids.length} 个转化入口移入回收站。`);
        await loadActiveGroups();
      }
      setDeleteState(null);
    } catch (error) {
      setDeleteState(null);
      handleError(error);
    } finally {
      setWorking(false);
    }
  }

  function toggleGroupSelection(id: string) {
    setSelectedGroupIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleTargetSelection(id: string) {
    setSelectedTargetIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <section className="conversion-pool" aria-labelledby="conversion-pool-title">
      <div className="conversion-pool-heading">
        <div>
          <p>当前分区</p>
          <h2 id="conversion-pool-title">{section.name} · 转化池</h2>
        </div>
        <button className="primary-button" type="button" onClick={openCreateGroup}>
          新增转化分组
        </button>
      </div>

      <div className="conversion-filter-bar">
        <div className="scope-tabs" role="tablist" aria-label="转化分组状态">
          <button
            type="button"
            className={groupScope === 'active' ? 'is-active' : undefined}
            onClick={() => void changeGroupScope('active')}
          >
            当前分组 <span>{activeGroups.length}</span>
          </button>
          <button
            type="button"
            className={groupScope === 'trash' ? 'is-active' : undefined}
            onClick={() => void changeGroupScope('trash')}
          >
            回收站 <span>{trashGroups.length}</span>
          </button>
        </div>
        <label className="conversion-search">
          <span>搜索</span>
          <input
            type="search"
            value={groupSearch}
            placeholder="分组名称或 CTA 文字"
            onChange={(event) => setGroupSearch(event.target.value)}
          />
        </label>
      </div>

      {errorMessage ? <div className="notice notice-error" role="alert">{errorMessage}</div> : null}
      {successMessage ? <div className="notice notice-success" role="status">{successMessage}</div> : null}
      {rotationMessage ? <div className="notice conversion-rotation-result" role="status">{rotationMessage}</div> : null}

      {groupScope === 'active' && selectedGroupIds.size > 0 ? (
        <div className="selection-toolbar">
          <span>已选择 {selectedGroupIds.size} 个转化分组</span>
          <button
            className="danger-button"
            type="button"
            disabled={working}
            onClick={() => setDeleteState({ kind: 'group', ids: [...selectedGroupIds] })}
          >
            批量删除
          </button>
        </div>
      ) : null}

      <div className="conversion-table-wrap">
        {groupsLoading ? (
          <div className="conversion-empty">正在读取转化分组…</div>
        ) : filteredGroups.length === 0 ? (
          <div className="conversion-empty"><strong>暂无转化分组</strong></div>
        ) : (
          <table className="conversion-table">
            <thead>
              <tr>
                {groupScope === 'active' ? <th className="checkbox-cell">
                  <input
                    type="checkbox"
                    checked={allGroupsSelected}
                    aria-label="全选当前转化分组"
                    onChange={() => {
                      setSelectedGroupIds((current) => {
                        const next = new Set(current);
                        filteredGroups.forEach((group) => {
                          if (allGroupsSelected) next.delete(group.id);
                          else next.add(group.id);
                        });
                        return next;
                      });
                    }}
                  />
                </th> : null}
                <th>转化分组</th>
                <th>入口</th>
                <th>产品</th>
                <th>状态</th>
                <th>排序</th>
                <th className="actions-cell">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredGroups.map((group, index) => (
                <tr key={group.id} className={selectedGroupId === group.id ? 'is-selected-row' : undefined}>
                  {groupScope === 'active' ? <td className="checkbox-cell">
                    <input type="checkbox" checked={selectedGroupIds.has(group.id)} aria-label={`选择 ${group.name}`} onChange={() => toggleGroupSelection(group.id)} />
                  </td> : null}
                  <td>
                    <div className="conversion-group-identity">
                      <span className={`conversion-mode-icon is-${group.mode}`} aria-hidden="true">{group.mode === 'customer_service' ? 'CS' : 'URL'}</span>
                      <div><strong>{group.name}</strong><small>{modeLabel(group)} · CTA: {group.buttonLabel}</small></div>
                    </div>
                  </td>
                  <td><strong>{group.activeTargetCount}</strong> / {group.targetCount}<small className="conversion-cell-note">启用 / 全部</small></td>
                  <td>{group.productCount}</td>
                  <td>
                    {groupScope === 'active' ? (
                      <button className={`status-pill ${group.isEnabled ? 'is-enabled' : 'is-disabled'}`} type="button" disabled={working} onClick={() => void toggleGroup(group)}>{readinessLabel(group)}</button>
                    ) : <span className="status-pill is-deleted">已删除</span>}
                  </td>
                  <td>
                    {groupScope === 'active' ? <div className="sort-controls"><span>{group.sortOrder}</span><div>
                      <button type="button" disabled={working || index === 0} onClick={() => void moveGroup(group, -1)}>↑</button>
                      <button type="button" disabled={working || index === filteredGroups.length - 1} onClick={() => void moveGroup(group, 1)}>↓</button>
                    </div></div> : group.sortOrder}
                  </td>
                  <td className="actions-cell">
                    {groupScope === 'active' ? <>
                      <button type="button" onClick={() => setSelectedGroupId(group.id)}>管理入口</button>
                      <button type="button" disabled={working || group.activeTargetCount === 0 || !group.isEnabled} onClick={() => void runRotationPreview(group)}>测试轮换</button>
                      <button type="button" onClick={() => openEditGroup(group)}>编辑</button>
                      <button className="text-danger" type="button" disabled={working || group.productCount > 0 || group.targetCount > 0} onClick={() => setDeleteState({ kind: 'group', ids: [group.id] })}>删除</button>
                    </> : <button type="button" disabled={working} onClick={() => void restoreGroup(group)}>恢复</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedGroup ? (
        <section className="conversion-target-panel" aria-labelledby="conversion-target-title">
          <div className="conversion-target-heading">
            <div>
              <p>{modeLabel(selectedGroup)}分组</p>
              <h3 id="conversion-target-title">{selectedGroup.name} · 入口管理</h3>
            </div>
            <div className="conversion-target-heading-actions">
              <button className="secondary-button" type="button" onClick={() => setSelectedGroupId(null)}>关闭</button>
              <button className="primary-button" type="button" onClick={openCreateTarget}>
                {selectedGroup.mode === 'customer_service' ? '添加客服分组' : '添加链接'}
              </button>
            </div>
          </div>

          <div className="conversion-filter-bar">
            <div className="scope-tabs" role="tablist" aria-label="转化入口状态">
              <button type="button" className={targetScope === 'active' ? 'is-active' : undefined} onClick={() => void changeTargetScope('active')}>当前入口 <span>{activeTargets.length}</span></button>
              <button type="button" className={targetScope === 'trash' ? 'is-active' : undefined} onClick={() => void changeTargetScope('trash')}>回收站 <span>{trashTargets.length}</span></button>
            </div>
            <label className="conversion-search">
              <span>搜索</span>
              <input type="search" value={targetSearch} placeholder={selectedGroup.mode === 'customer_service' ? '客服系统或客服分组' : '链接名称或地址'} onChange={(event) => setTargetSearch(event.target.value)} />
            </label>
          </div>

          {targetScope === 'active' && selectedTargetIds.size > 0 ? (
            <div className="selection-toolbar">
              <span>已选择 {selectedTargetIds.size} 个转化入口</span>
              <button className="danger-button" type="button" disabled={working} onClick={() => setDeleteState({ kind: 'target', ids: [...selectedTargetIds] })}>批量删除</button>
            </div>
          ) : null}

          <div className="conversion-table-wrap">
            {targetsLoading ? (
              <div className="conversion-empty">正在读取转化入口…</div>
            ) : filteredTargets.length === 0 ? (
              <div className="conversion-empty"><strong>暂无转化入口</strong></div>
            ) : (
              <table className="conversion-table conversion-target-table">
                <thead>
                  <tr>
                    {targetScope === 'active' ? <th className="checkbox-cell"><input type="checkbox" checked={allTargetsSelected} aria-label="全选当前转化入口" onChange={() => {
                      setSelectedTargetIds((current) => {
                        const next = new Set(current);
                        filteredTargets.forEach((target) => {
                          if (allTargetsSelected) next.delete(target.id);
                          else next.add(target.id);
                        });
                        return next;
                      });
                    }} /></th> : null}
                    <th>{selectedGroup.mode === 'customer_service' ? '客服分组' : '链接名称'}</th>
                    <th>{selectedGroup.mode === 'customer_service' ? '客服系统' : '跳转地址'}</th>
                    <th>状态</th>
                    <th>排序</th>
                    <th className="actions-cell">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTargets.map((target, index) => (
                    <tr key={target.id}>
                      {targetScope === 'active' ? <td className="checkbox-cell"><input type="checkbox" checked={selectedTargetIds.has(target.id)} aria-label={`选择 ${target.name}`} onChange={() => toggleTargetSelection(target.id)} /></td> : null}
                      <td>
                        <strong>{target.remoteGroupName ?? target.name}</strong>
                        {target.bindingKind === 'legacy_customer_service' ? <small className="conversion-cell-note">旧入口 · 待重新绑定</small> : null}
                      </td>
                      <td className="conversion-url-cell" title={target.endpointUrl ?? target.customerServiceConnectionName ?? undefined}>
                        {selectedGroup.mode === 'customer_service'
                          ? target.customerServiceConnectionName ?? '待重新绑定'
                          : shortUrl(target.endpointUrl)}
                      </td>
                      <td>
                        {targetScope === 'active' ? (
                          <button
                            className={`status-pill ${target.isEnabled ? 'is-enabled' : 'is-disabled'}`}
                            type="button"
                            disabled={working || target.bindingKind === 'legacy_customer_service'}
                            onClick={() => void toggleTarget(target)}
                          >
                            {target.bindingKind === 'legacy_customer_service' ? '待重新绑定' : target.isEnabled ? '参与轮换' : '已停用'}
                          </button>
                        ) : <span className="status-pill is-deleted">已删除</span>}
                      </td>
                      <td>
                        {targetScope === 'active' ? <div className="sort-controls"><span>{target.sortOrder}</span><div>
                          <button type="button" disabled={working || index === 0} onClick={() => void moveTarget(target, -1)}>↑</button>
                          <button type="button" disabled={working || index === filteredTargets.length - 1} onClick={() => void moveTarget(target, 1)}>↓</button>
                        </div></div> : target.sortOrder}
                      </td>
                      <td className="actions-cell">
                        {targetScope === 'active' ? <>
                          <button type="button" onClick={() => openEditTarget(target)}>编辑</button>
                          <button className="text-danger" type="button" disabled={working} onClick={() => setDeleteState({ kind: 'target', ids: [target.id] })}>删除</button>
                        </> : <button type="button" disabled={working} onClick={() => void restoreTarget(target)}>恢复</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      ) : null}

      {groupEditorOpen ? (
        <ConversionGroupEditorDialog
          sectionName={section.name}
          editingGroup={editingGroup}
          form={groupForm}
          saving={saving}
          onFormChange={setGroupForm}
          onClose={() => setGroupEditorOpen(false)}
          onSubmit={(event) => void saveGroup(event)}
        />
      ) : null}

      {targetEditorOpen && selectedGroup ? (
        <ConversionTargetEditorDialog
          group={selectedGroup}
          editingTarget={editingTarget}
          form={targetForm}
          saving={saving}
          onFormChange={setTargetForm}
          onClose={() => setTargetEditorOpen(false)}
          onSubmit={(event) => void saveTarget(event)}
          onSessionExpired={onSessionExpired}
        />
      ) : null}

      {deleteState ? (
        <div className="admin-dialog-backdrop" role="presentation">
          <section className="admin-dialog admin-dialog-small" role="dialog" aria-modal="true" aria-labelledby="conversion-delete-title">
            <div className="admin-dialog-header">
              <div><p>移入回收站</p><h3 id="conversion-delete-title">确认删除 {deleteState.ids.length} 项？</h3></div>
              <button type="button" aria-label="关闭" disabled={working} onClick={() => setDeleteState(null)}>×</button>
            </div>
            <div className="admin-dialog-actions">
              <button className="secondary-button" type="button" disabled={working} onClick={() => setDeleteState(null)}>取消</button>
              <button className="danger-button" type="button" disabled={working} onClick={() => void confirmDelete()}>{working ? '正在删除…' : '确认删除'}</button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
