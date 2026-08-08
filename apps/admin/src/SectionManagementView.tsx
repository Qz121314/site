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
  type SectionScope,
} from './api';
import { MediaPickerDialog } from './asset-library/MediaPickerDialog';
import { brandingAssetPreviewUrl, uploadBrandingImage } from './branding-media/api';
import {
  prepareBrandingImage,
  releaseBrandingImage,
  type LocalBrandingImage,
} from './branding-media/local-branding-image';
import { DeleteSectionDialog } from './section-management/DeleteSectionDialog';
import { SectionEditorDialog } from './section-management/SectionEditorDialog';
import { SectionTable } from './section-management/SectionTable';
import {
  emptySectionForm,
  sectionIconOptions,
  type SectionEditorInput,
} from './section-management/config';

type SectionManagementViewProps = {
  activeSections: AdminSection[];
  onActiveSectionsChange: (sections: AdminSection[]) => void;
  onSessionExpired: () => void;
};

function sortSections(sections: AdminSection[]): AdminSection[] {
  return [...sections].sort(
    (left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name),
  );
}

function describeError(error: unknown): string {
  if (!(error instanceof AdminApiError)) {
    return error instanceof Error ? error.message : '操作失败，请稍后重试。';
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
  const [editingSection, setEditingSection] = useState<AdminSection | null>(null);
  const [form, setForm] = useState<SectionEditorInput>(emptySectionForm);
  const [localIcon, setLocalIcon] = useState<LocalBrandingImage | null>(null);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [processingIcon, setProcessingIcon] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [working, setWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);

  useEffect(() => () => releaseBrandingImage(localIcon), [localIcon]);

  const sourceSections = scope === 'trash' ? trashSections : activeSections;
  const filteredSections = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return keyword
      ? sourceSections.filter((section) => `${section.name} ${section.slug}`.toLowerCase().includes(keyword))
      : sourceSections;
  }, [search, sourceSections]);

  const allVisibleSelected = filteredSections.length > 0 && filteredSections.every((section) => selectedIds.has(section.id));
  const reorderBlocked = scope !== 'active' || Boolean(search.trim());

  useEffect(() => {
    setSelectedIds(new Set());
    setErrorMessage('');
    setSuccessMessage('');
  }, [scope]);

  function handleOperationError(error: unknown) {
    if (isSessionError(error)) {
      onSessionExpired();
      return;
    }
    setErrorMessage(describeError(error));
  }

  async function loadTrash() {
    setLoadingTrash(true);
    try {
      setTrashSections(await fetchSections('trash'));
    } catch (error) {
      handleOperationError(error);
    } finally {
      setLoadingTrash(false);
    }
  }

  async function refreshActive() {
    try {
      onActiveSectionsChange(await fetchSections('active'));
    } catch (error) {
      handleOperationError(error);
    }
  }

  async function changeScope(nextScope: SectionScope) {
    setScope(nextScope);
    if (nextScope === 'trash') await loadTrash();
  }

  function openCreateEditor() {
    const sortOrder = activeSections.length ? Math.max(...activeSections.map((section) => section.sortOrder)) + 10 : 0;
    setEditingSection(null);
    setForm({ ...emptySectionForm, sortOrder });
    setLocalIcon(null);
    setErrorMessage('');
    setEditorOpen(true);
  }

  function openEditEditor(section: AdminSection) {
    setEditingSection(section);
    setForm({
      name: section.name,
      iconValue: section.iconValue ?? sectionIconOptions[0],
      iconAssetId: section.iconAssetId,
      sortOrder: section.sortOrder,
      isEnabled: section.isEnabled,
    });
    setLocalIcon(null);
    setErrorMessage('');
    setEditorOpen(true);
  }

  function closeEditor() {
    if (saving || processingIcon || iconPickerOpen) return;
    setLocalIcon(null);
    setEditorOpen(false);
  }

  async function selectIconFile(file: File) {
    if (saving || processingIcon) return;
    setProcessingIcon(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const prepared = await prepareBrandingImage(file, 'section-icon');
      setLocalIcon(prepared);
      setForm((current) => ({ ...current, iconAssetId: null }));
      setSuccessMessage('分区图标已在浏览器压缩，保存分区时才会上传到 R2。');
    } catch (error) {
      handleOperationError(error);
    } finally {
      setProcessingIcon(false);
    }
  }

  function removeImageIcon() {
    setLocalIcon(null);
    setForm((current) => ({
      ...current,
      iconAssetId: null,
      iconValue: current.iconValue || sectionIconOptions[0],
    }));
  }

  function selectFallbackIcon(icon: string) {
    setLocalIcon(null);
    setForm((current) => ({ ...current, iconAssetId: null, iconValue: icon }));
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || processingIcon) return;
    setSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    let input: SectionEditorInput = form;
    try {
      if (localIcon) {
        const uploaded = await uploadBrandingImage('section-icon', localIcon.compressedFile);
        input = { ...input, iconAssetId: uploaded.media.id };
        setForm(input);
        setLocalIcon(null);
      }

      if (editingSection) {
        const updated = await updateSection(editingSection.id, input);
        onActiveSectionsChange(sortSections(activeSections.map((section) => (section.id === updated.id ? updated : section))));
        setSuccessMessage(`分区“${updated.name}”及图标已更新。`);
      } else {
        const created = await createSection(input);
        onActiveSectionsChange(sortSections([...activeSections, created]));
        setSuccessMessage(`分区“${created.name}”已创建，左侧业务菜单已生成。`);
      }
      setEditorOpen(false);
    } catch (error) {
      handleOperationError(error);
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled(section: AdminSection) {
    setWorking(true);
    setErrorMessage('');
    try {
      const input: SectionEditorInput = {
        name: section.name,
        iconValue: section.iconValue ?? sectionIconOptions[0],
        iconAssetId: section.iconAssetId,
        sortOrder: section.sortOrder,
        isEnabled: !section.isEnabled,
      };
      const updated = await updateSection(section.id, input);
      onActiveSectionsChange(activeSections.map((item) => (item.id === updated.id ? updated : item)));
      setSuccessMessage(updated.isEnabled ? '分区已启用。' : '分区已停用。');
    } catch (error) {
      handleOperationError(error);
    } finally {
      setWorking(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDeleteIds.length) return;
    const deletingIds = [...pendingDeleteIds];
    setWorking(true);
    setErrorMessage('');
    try {
      if (deletingIds.length === 1) {
        const id = deletingIds[0];
        if (id) await deleteSection(id);
      } else {
        await batchDeleteSections(deletingIds);
      }
      onActiveSectionsChange(activeSections.filter((section) => !deletingIds.includes(section.id)));
      setSelectedIds(new Set());
      setPendingDeleteIds([]);
      setSuccessMessage(`已将 ${deletingIds.length} 个分区移入回收站。`);
    } catch (error) {
      setPendingDeleteIds([]);
      handleOperationError(error);
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
      onActiveSectionsChange(sortSections([...activeSections, restored]));
      setSuccessMessage(`分区“${restored.name}”已恢复。`);
    } catch (error) {
      handleOperationError(error);
    } finally {
      setWorking(false);
    }
  }

  async function moveSection(section: AdminSection, direction: -1 | 1) {
    if (reorderBlocked) return;
    const ordered = sortSections(activeSections).map((item) => ({ ...item }));
    const currentIndex = ordered.findIndex((item) => item.id === section.id);
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
      await reorderSections([
        { id: current.id, sortOrder: current.sortOrder },
        { id: target.id, sortOrder: target.sortOrder },
      ]);
      onActiveSectionsChange(sortSections(ordered));
      setSuccessMessage('分区顺序已更新。');
    } catch (error) {
      handleOperationError(error);
      await refreshActive();
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
      filteredSections.forEach((section) => {
        if (allVisibleSelected) next.delete(section.id);
        else next.add(section.id);
      });
      return next;
    });
  }

  const iconPreviewUrl = localIcon?.previewUrl ?? (form.iconAssetId ? brandingAssetPreviewUrl(form.iconAssetId) : null);

  return (
    <section className="section-management" aria-labelledby="section-management-title">
      <div className="section-management-toolbar">
        <div>
          <p>动态业务结构</p>
          <h2 id="section-management-title">分区管理</h2>
          <span>分区名称将直接用于 English 用户前端和后台动态菜单。</span>
        </div>
        <button className="primary-button" type="button" onClick={openCreateEditor}>新增分区</button>
      </div>

      <div className="section-filter-bar">
        <div className="scope-tabs" role="tablist" aria-label="分区状态">
          <button type="button" className={scope === 'active' ? 'is-active' : undefined} onClick={() => void changeScope('active')}>当前分区 <span>{activeSections.length}</span></button>
          <button type="button" className={scope === 'trash' ? 'is-active' : undefined} onClick={() => void changeScope('trash')}>回收站 <span>{trashSections.length}</span></button>
        </div>
        <label className="section-search">
          <span>搜索</span>
          <input type="search" value={search} placeholder="名称或 slug" onChange={(event) => setSearch(event.target.value)} />
        </label>
      </div>

      {errorMessage ? <div className="notice notice-error" role="alert">{errorMessage}</div> : null}
      {successMessage ? <div className="notice notice-success" role="status">{successMessage}</div> : null}

      {scope === 'active' && selectedIds.size > 0 ? (
        <div className="selection-toolbar">
          <span>已选择 {selectedIds.size} 个分区</span>
          <button type="button" className="danger-button" disabled={working} onClick={() => setPendingDeleteIds([...selectedIds])}>批量删除</button>
        </div>
      ) : null}

      <SectionTable
        scope={scope}
        sections={filteredSections}
        loading={loadingTrash}
        selectedIds={selectedIds}
        allVisibleSelected={allVisibleSelected}
        working={working}
        reorderDisabled={reorderBlocked}
        onToggleSelect={toggleSelect}
        onToggleSelectAll={toggleSelectAll}
        onToggleEnabled={(section) => void toggleEnabled(section)}
        onEdit={openEditEditor}
        onDelete={(section) => setPendingDeleteIds([section.id])}
        onRestore={(section) => void handleRestore(section)}
        onMove={(section, direction) => void moveSection(section, direction)}
      />

      {editorOpen ? (
        <SectionEditorDialog
          editingSection={editingSection}
          form={form}
          iconPreviewUrl={iconPreviewUrl}
          localIcon={localIcon}
          saving={saving}
          processingIcon={processingIcon}
          onFormChange={setForm}
          onSelectIconFile={(file) => void selectIconFile(file)}
          onOpenMediaPicker={() => setIconPickerOpen(true)}
          onRemoveImageIcon={removeImageIcon}
          onSelectFallbackIcon={selectFallbackIcon}
          onClose={closeEditor}
          onSubmit={(event) => void handleSave(event)}
        />
      ) : null}

      {iconPickerOpen ? (
        <MediaPickerDialog
          title="选择分区图标"
          role="icon"
          allowedKinds={['image']}
          selectedIds={form.iconAssetId ? [form.iconAssetId] : []}
          onSessionExpired={onSessionExpired}
          onClose={() => setIconPickerOpen(false)}
          onSelect={(asset) => {
            setLocalIcon(null);
            setForm((current) => ({ ...current, iconAssetId: asset.id }));
            setIconPickerOpen(false);
            setSuccessMessage('已从素材中心选择分区图标，保存分区后生效。');
          }}
        />
      ) : null}

      {pendingDeleteIds.length > 0 ? (
        <DeleteSectionDialog count={pendingDeleteIds.length} working={working} onCancel={() => setPendingDeleteIds([])} onConfirm={() => void confirmDelete()} />
      ) : null}
    </section>
  );
}
