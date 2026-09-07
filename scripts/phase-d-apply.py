from pathlib import Path
import re


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"missing replacement in {path}: {old[:100]!r}")
    p.write_text(text.replace(old, new, 1))


def insert_after(path: str, marker: str, addition: str) -> None:
    p = Path(path)
    text = p.read_text()
    if addition.strip() in text:
        return
    if marker not in text:
        raise SystemExit(f"missing insert marker in {path}: {marker!r}")
    p.write_text(text.replace(marker, marker + addition, 1))


shared_imports = """import { Button } from './components/ui/button';
import {
  AdminSearchField,
  AdminSelectionBar,
  AdminToolbar,
} from './components/ui/management-workspace';
import {
  toggleSelection,
  toggleVisibleSelection,
} from './components/ui/management-selection';
import {
  AdminSegmentedControl,
  AdminSegmentedItem,
} from './components/ui/segmented-control';
"""

# Product workspace
path = 'apps/admin/src/ProductManagementView.tsx'
insert_after(path, "import { AdminApiError, type AdminSection } from './api';\n", shared_imports)
replace_once(
    path,
    """  function toggleSelect(id: string) {
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
      filteredProducts.forEach((product) => {
        if (allVisibleSelected) next.delete(product.id);
        else next.add(product.id);
      });
      return next;
    });
  }
""",
    """  function toggleSelect(id: string) {
    setSelectedIds((current) => toggleSelection(current, id));
  }

  function toggleSelectAll() {
    setSelectedIds((current) =>
      toggleVisibleSelection(
        current,
        filteredProducts.map((product) => product.id),
        allVisibleSelected,
      ),
    );
  }
""",
)
product_toolbar_start = '''      <div className="product-management-toolbar">'''
product_toolbar_end = '''      </div>\n\n      {!editorOpen && errorMessage ? ('''
text = Path(path).read_text()
start = text.index(product_toolbar_start)
end = text.index(product_toolbar_end, start)
new = '''      <AdminToolbar
        aria-label={`${section.name} 产品管理工具栏`}
        leading={
          <AdminSegmentedControl ariaLabel="产品范围">
            <AdminSegmentedItem
              selected={scope === 'active'}
              onClick={() => void changeScope('active')}
            >
              当前产品 {activeProducts.length}
            </AdminSegmentedItem>
            <AdminSegmentedItem
              selected={scope === 'trash'}
              onClick={() => void changeScope('trash')}
            >
              回收站 {trashProducts.length}
            </AdminSegmentedItem>
          </AdminSegmentedControl>
        }
        trailing={
          <Button variant="primary" onClick={openCreateEditor}>
            新增产品
          </Button>
        }
      >
        <AdminSearchField
          label="搜索产品"
          value={search}
          placeholder="标题、分类、标签或转化分组"
          onChange={(event) => setSearch(event.target.value)}
        />
        <label className="ui-management-filter">
          <span>状态</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          >
            <option value="all">全部状态</option>
            <option value="draft">草稿</option>
            <option value="published">已发布</option>
            <option value="archived">已归档</option>
          </select>
        </label>
      </AdminToolbar>

'''
Path(path).write_text(text[:start] + new + text[end + len('      </div>\n\n'):])
replace_once(
    path,
    '''      {scope === 'active' && selectedIds.size > 0 ? (
        <div className="selection-toolbar">
          <span>已选择 {selectedIds.size} 个产品</span>
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
''',
    '''      {scope === 'active' && selectedIds.size > 0 ? (
        <AdminSelectionBar count={selectedIds.size} noun="产品">
          <Button
            variant="danger"
            disabled={working}
            onClick={() => setPendingDeleteIds([...selectedIds])}
          >
            批量删除
          </Button>
        </AdminSelectionBar>
      ) : null}
''',
)

# Category workspace
path = 'apps/admin/src/CategoryManagementView.tsx'
insert_after(path, "import { AdminApiError, type AdminSection } from './api';\n", shared_imports)
replace_once(
    path,
    """  function toggleSelect(id: string) {
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
      filteredCategories.forEach((category) => {
        if (allVisibleSelected) next.delete(category.id);
        else next.add(category.id);
      });
      return next;
    });
  }
""",
    """  function toggleSelect(id: string) {
    setSelectedIds((current) => toggleSelection(current, id));
  }

  function toggleSelectAll() {
    setSelectedIds((current) =>
      toggleVisibleSelection(
        current,
        filteredCategories.map((category) => category.id),
        allVisibleSelected,
      ),
    );
  }
""",
)
text = Path(path).read_text()
start = text.index('      <div className="category-management-toolbar">')
end = text.index('      {!editorOpen && errorMessage ? (', start)
new = '''      <AdminToolbar
        aria-label={`${section.name} 分类管理工具栏`}
        leading={
          <AdminSegmentedControl ariaLabel="分类状态">
            <AdminSegmentedItem
              selected={scope === 'active'}
              onClick={() => void changeScope('active')}
            >
              当前分类 {activeCategories.length}
            </AdminSegmentedItem>
            <AdminSegmentedItem
              selected={scope === 'trash'}
              onClick={() => void changeScope('trash')}
            >
              回收站 {trashCategories.length}
            </AdminSegmentedItem>
          </AdminSegmentedControl>
        }
        trailing={
          <Button variant="primary" onClick={openCreateEditor}>
            新增分类
          </Button>
        }
      >
        <AdminSearchField
          label="搜索分类"
          value={search}
          placeholder="分类名称"
          onChange={(event) => setSearch(event.target.value)}
        />
      </AdminToolbar>

'''
Path(path).write_text(text[:start] + new + text[end:])
replace_once(
    path,
    '''      {scope === 'active' && selectedIds.size > 0 ? (
        <div className="selection-toolbar">
          <span>已选择 {selectedIds.size} 个分类</span>
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
''',
    '''      {scope === 'active' && selectedIds.size > 0 ? (
        <AdminSelectionBar count={selectedIds.size} noun="分类">
          <Button
            variant="danger"
            disabled={working}
            onClick={() => setPendingDeleteIds([...selectedIds])}
          >
            批量删除
          </Button>
        </AdminSelectionBar>
      ) : null}
''',
)

# Section workspace
path = 'apps/admin/src/SectionManagementView.tsx'
insert_after(path, "} from './branding-media/local-branding-image';\n", shared_imports)
replace_once(
    path,
    """  function toggleSelect(id: string) {
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
""",
    """  function toggleSelect(id: string) {
    setSelectedIds((current) => toggleSelection(current, id));
  }

  function toggleSelectAll() {
    setSelectedIds((current) =>
      toggleVisibleSelection(
        current,
        filteredSections.map((section) => section.id),
        allVisibleSelected,
      ),
    );
  }
""",
)
text = Path(path).read_text()
start = text.index('      <div className="section-management-toolbar">')
end = text.index('      {errorMessage && !editorOpen ? (', start)
new = '''      <AdminToolbar
        aria-label="分区管理工具栏"
        leading={
          <AdminSegmentedControl ariaLabel="分区状态">
            <AdminSegmentedItem
              selected={scope === 'active'}
              onClick={() => void changeScope('active')}
            >
              当前分区 {activeSections.length}
            </AdminSegmentedItem>
            <AdminSegmentedItem
              selected={scope === 'trash'}
              onClick={() => void changeScope('trash')}
            >
              回收站 {trashSections.length}
            </AdminSegmentedItem>
          </AdminSegmentedControl>
        }
        trailing={
          <Button variant="primary" onClick={openCreateEditor}>
            新增分区
          </Button>
        }
      >
        <AdminSearchField
          label="搜索分区"
          value={search}
          placeholder="名称、简介或 slug"
          onChange={(event) => setSearch(event.target.value)}
        />
      </AdminToolbar>

'''
Path(path).write_text(text[:start] + new + text[end:])
replace_once(
    path,
    '''      {scope === 'active' && selectedIds.size > 0 ? (
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
''',
    '''      {scope === 'active' && selectedIds.size > 0 ? (
        <AdminSelectionBar count={selectedIds.size} noun="分区">
          <Button
            variant="danger"
            disabled={working}
            onClick={() => setPendingDeleteIds([...selectedIds])}
          >
            批量删除
          </Button>
        </AdminSelectionBar>
      ) : null}
''',
)

# Tag workspace: shared toolbar/selection plus shared dialog shell.
path = 'apps/admin/src/TagManagementView.tsx'
insert_after(path, "import { AdminApiError, type AdminSection } from './api';\n", shared_imports + "import { AdminDialog } from './components/ui/dialog';\nimport { AdminFeedbackState } from './components/ui/feedback-state';\nimport { AdminStatusBadge } from './components/ui/status-badge';\nimport { ArrowDown, ArrowUp } from 'lucide-react';\n")
replace_once(
    path,
    """  function toggleSelect(id: string) {
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
      filteredTags.forEach((tag) => {
        if (allVisibleSelected) next.delete(tag.id);
        else next.add(tag.id);
      });
      return next;
    });
  }
""",
    """  function toggleSelect(id: string) {
    setSelectedIds((current) => toggleSelection(current, id));
  }

  function toggleSelectAll() {
    setSelectedIds((current) =>
      toggleVisibleSelection(
        current,
        filteredTags.map((tag) => tag.id),
        allVisibleSelected,
      ),
    );
  }
""",
)
text = Path(path).read_text()
start = text.index('      <div className="category-management-toolbar">')
end = text.index('      {!editorOpen && errorMessage ? (', start)
new = '''      <AdminToolbar
        aria-label={`${section.name} 标签管理工具栏`}
        leading={
          <AdminSegmentedControl ariaLabel="标签状态">
            <AdminSegmentedItem selected={scope === 'active'} onClick={() => void changeScope('active')}>
              当前标签 {activeTags.length}
            </AdminSegmentedItem>
            <AdminSegmentedItem selected={scope === 'trash'} onClick={() => void changeScope('trash')}>
              回收站 {trashTags.length}
            </AdminSegmentedItem>
          </AdminSegmentedControl>
        }
        trailing={<Button variant="primary" onClick={openCreateEditor}>新增标签</Button>}
      >
        <AdminSearchField
          label="搜索标签"
          value={search}
          placeholder="标签名称"
          onChange={(event) => setSearch(event.target.value)}
        />
      </AdminToolbar>

'''
Path(path).write_text(text[:start] + new + text[end:])
replace_once(
    path,
    '''      {scope === 'active' && selectedIds.size > 0 ? (
        <div className="selection-toolbar">
          <span>已选择 {selectedIds.size} 个标签</span>
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
''',
    '''      {scope === 'active' && selectedIds.size > 0 ? (
        <AdminSelectionBar count={selectedIds.size} noun="标签">
          <Button variant="danger" disabled={working} onClick={() => setPendingDeleteIds([...selectedIds])}>
            批量删除
          </Button>
        </AdminSelectionBar>
      ) : null}
''',
)
replace_once(path, '''      {loading ? (
        <div className="category-table-wrap category-table-empty">
          <div className="loading-indicator" aria-hidden="true" />
          <p>正在读取标签…</p>
        </div>
      ) : filteredTags.length === 0 ? (
        <div className="category-table-wrap category-table-empty">
          <strong>{scope === 'active' ? '当前分区还没有标签' : '回收站为空'}</strong>
        </div>
      ) : (''', '''      {loading ? (
        <AdminFeedbackState kind="loading" title="正在读取标签…" />
      ) : filteredTags.length === 0 ? (
        <AdminFeedbackState
          kind="empty"
          title={scope === 'active' ? '当前分区还没有标签' : '回收站为空'}
          description={scope === 'active' ? '使用上方“新增标签”开始录入。' : '已删除标签会显示在这里。'}
        />
      ) : (''')
# selected row semantics
replace_once(path, '<tr key={tag.id}>', '<tr key={tag.id} className={`ui-data-row${selectedIds.has(tag.id) ? \' is-selected\' : \'\'}`} aria-selected={scope === \'active\' ? selectedIds.has(tag.id) : undefined}>')
# Replace simple status pills with badge inside a shared button.
replace_once(path, '''                      <button
                        type="button"
                        className={`status-pill ${tag.isEnabled ? 'is-enabled' : 'is-disabled'}`}
                        disabled={working}
                        onClick={() => void toggleEnabled(tag)}
                      >
                        {tag.isEnabled ? '已启用' : '已停用'}
                      </button>''', '''                      <Button
                        variant="ghost"
                        size="compact"
                        disabled={working}
                        aria-label={`${tag.isEnabled ? '停用' : '启用'}标签 ${tag.name}`}
                        onClick={() => void toggleEnabled(tag)}
                      >
                        <AdminStatusBadge tone={tag.isEnabled ? 'success' : 'default'}>
                          {tag.isEnabled ? '已启用' : '已停用'}
                        </AdminStatusBadge>
                      </Button>''')
replace_once(path, '<span className="status-pill is-deleted">已删除</span>', '<AdminStatusBadge tone="warning">已删除</AdminStatusBadge>')
# convert arrow controls to accessible shared icon buttons
text = Path(path).read_text()
text = text.replace('''<button
                            type="button"
                            disabled={working || reorderBlocked || index === 0}
                            onClick={() => void moveTag(tag, -1)}
                          >
                            ↑
                          </button>''', '''<Button
                            variant="ghost"
                            size="icon"
                            aria-label={`上移 ${tag.name}`}
                            disabled={working || reorderBlocked || index === 0}
                            onClick={() => void moveTag(tag, -1)}
                          >
                            <ArrowUp aria-hidden="true" size={15} />
                          </Button>''')
text = text.replace('''<button
                            type="button"
                            disabled={
                              working ||
                              reorderBlocked ||
                              index === filteredTags.length - 1
                            }
                            onClick={() => void moveTag(tag, 1)}
                          >
                            ↓
                          </button>''', '''<Button
                            variant="ghost"
                            size="icon"
                            aria-label={`下移 ${tag.name}`}
                            disabled={
                              working ||
                              reorderBlocked ||
                              index === filteredTags.length - 1
                            }
                            onClick={() => void moveTag(tag, 1)}
                          >
                            <ArrowDown aria-hidden="true" size={15} />
                          </Button>''')
Path(path).write_text(text)
# replace both local modal blocks from editorOpen through end deleteState using a single regex anchored at editorOpen
text = Path(path).read_text()
modal_start = text.index('      {editorOpen ? (')
modal_end = text.index('    </section>\n  );', modal_start)
modals = '''      <AdminDialog
        open={editorOpen}
        title={editingTag ? '编辑标签' : '新增标签'}
        eyebrow={`${section.name} · 标签`}
        onClose={() => setEditorOpen(false)}
        closeDisabled={saving}
        size="small"
      >
        <form className="category-editor-form" onSubmit={(event) => void saveTag(event)}>
          {errorMessage ? <div className="notice notice-error" role="alert">{errorMessage}</div> : null}
          <label>
            <span>标签名称</span>
            <input type="text" autoFocus required maxLength={80} value={form.name} onChange={(event) => { setForm((current) => ({ ...current, name: event.target.value })); setErrorMessage(''); }} />
          </label>
          <label>
            <span>排序</span>
            <input type="number" min={0} max={1_000_000} step={1} required value={form.sortOrder} onChange={(event) => { setForm((current) => ({ ...current, sortOrder: Number(event.target.value) })); setErrorMessage(''); }} />
          </label>
          <label className="category-enabled-field">
            <input type="checkbox" checked={form.isEnabled} onChange={(event) => { setForm((current) => ({ ...current, isEnabled: event.target.checked })); setErrorMessage(''); }} />
            <span>启用标签</span>
          </label>
          <div className="admin-dialog-actions">
            <Button variant="secondary" disabled={saving} onClick={() => setEditorOpen(false)}>取消</Button>
            <Button type="submit" variant="primary" loading={saving}>保存</Button>
          </div>
        </form>
      </AdminDialog>

      <AdminDialog
        open={pendingDeleteIds.length > 0}
        title={`确认删除 ${pendingDeleteIds.length} 个标签？`}
        eyebrow="删除标签"
        description="正在被产品引用的标签不会被删除。"
        role="alertdialog"
        onClose={() => setPendingDeleteIds([])}
        closeDisabled={working}
        size="small"
        footer={
          <>
            <Button variant="secondary" disabled={working} onClick={() => setPendingDeleteIds([])}>取消</Button>
            <Button variant="danger" loading={working} onClick={() => void confirmDelete()}>确认删除</Button>
          </>
        }
      >
        <p>删除后标签会进入回收站，现有服务端引用保护规则保持不变。</p>
      </AdminDialog>
'''
Path(path).write_text(text[:modal_start] + modals + text[modal_end:])

# Conversion workspace
path = 'apps/admin/src/ConversionPoolView.tsx'
insert_after(path, "import { AdminApiError, type AdminSection } from './api';\n", shared_imports + "import { AdminDialog } from './components/ui/dialog';\nimport { AdminFeedbackState } from './components/ui/feedback-state';\nimport { AdminStatusBadge } from './components/ui/status-badge';\n")
replace_once(path, '''  function toggleGroupSelection(id: string) {
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
''', '''  function toggleGroupSelection(id: string) {
    setSelectedGroupIds((current) => toggleSelection(current, id));
  }

  function toggleTargetSelection(id: string) {
    setSelectedTargetIds((current) => toggleSelection(current, id));
  }
''')
text = Path(path).read_text()
start = text.index('      <div className="conversion-pool-heading">')
end = text.index('      {!groupEditorOpen && !targetEditorOpen && errorMessage ? (', start)
new = '''      <AdminToolbar
        aria-label={`${section.name} 转化池工具栏`}
        leading={
          <AdminSegmentedControl ariaLabel="转化分组状态">
            <AdminSegmentedItem selected={groupScope === 'active'} onClick={() => void changeGroupScope('active')}>
              当前分组 {activeGroups.length}
            </AdminSegmentedItem>
            <AdminSegmentedItem selected={groupScope === 'trash'} onClick={() => void changeGroupScope('trash')}>
              回收站 {trashGroups.length}
            </AdminSegmentedItem>
          </AdminSegmentedControl>
        }
        trailing={<Button variant="primary" onClick={openCreateGroup}>新增转化分组</Button>}
      >
        <AdminSearchField label="搜索转化分组" value={groupSearch} placeholder="分组名称、客服系统或 CTA 文字" onChange={(event) => setGroupSearch(event.target.value)} />
      </AdminToolbar>

'''
Path(path).write_text(text[:start] + new + text[end:])
replace_once(path, '''      {groupScope === 'active' && selectedGroupIds.size > 0 ? (
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
''', '''      {groupScope === 'active' && selectedGroupIds.size > 0 ? (
        <AdminSelectionBar count={selectedGroupIds.size} noun="转化分组">
          <Button variant="danger" disabled={working} onClick={() => setDeleteState({ kind: 'group', ids: [...selectedGroupIds] })}>批量删除</Button>
        </AdminSelectionBar>
      ) : null}
''')
replace_once(path, '''        {groupsLoading ? (
          <div className="conversion-empty">正在读取转化分组…</div>
        ) : filteredGroups.length === 0 ? (
          <div className="conversion-empty">
            <strong>暂无转化分组</strong>
          </div>
        ) : (''', '''        {groupsLoading ? (
          <AdminFeedbackState kind="loading" title="正在读取转化分组…" />
        ) : filteredGroups.length === 0 ? (
          <AdminFeedbackState kind="empty" title="暂无转化分组" description="使用上方新增操作创建当前分区的转化分组。" />
        ) : (''')
# group row selected semantics includes active detail selection and checkbox selection
replace_once(path, '''                  className={selectedGroupId === group.id ? 'is-selected-row' : undefined}
                >''', '''                  className={`ui-data-row${selectedGroupId === group.id || selectedGroupIds.has(group.id) ? ' is-selected' : ''}`}
                  aria-selected={groupScope === 'active' ? selectedGroupId === group.id || selectedGroupIds.has(group.id) : undefined}
                >''')
# Target heading/filter replace together
text = Path(path).read_text()
start = text.index('          <div className="conversion-target-heading">')
end = text.index('          {targetScope === \'active\' && selectedTargetIds.size > 0 ? (', start)
new = '''          <AdminToolbar
            aria-label={`${selectedGroup.name} 链接管理工具栏`}
            leading={
              <AdminSegmentedControl ariaLabel="链接状态">
                <AdminSegmentedItem selected={targetScope === 'active'} onClick={() => void changeTargetScope('active')}>当前链接 {activeTargets.length}</AdminSegmentedItem>
                <AdminSegmentedItem selected={targetScope === 'trash'} onClick={() => void changeTargetScope('trash')}>回收站 {trashTargets.length}</AdminSegmentedItem>
              </AdminSegmentedControl>
            }
            trailing={
              <>
                <Button variant="secondary" onClick={() => setSelectedGroupId(null)}>关闭</Button>
                <Button variant="primary" onClick={openCreateTarget}>添加链接</Button>
              </>
            }
          >
            <AdminSearchField label="搜索链接" value={targetSearch} placeholder="链接名称或地址" onChange={(event) => setTargetSearch(event.target.value)} />
          </AdminToolbar>

'''
Path(path).write_text(text[:start] + new + text[end:])
replace_once(path, '''          {targetScope === 'active' && selectedTargetIds.size > 0 ? (
            <div className="selection-toolbar">
              <span>已选择 {selectedTargetIds.size} 个链接</span>
              <button
                className="danger-button"
                type="button"
                disabled={working}
                onClick={() =>
                  setDeleteState({ kind: 'target', ids: [...selectedTargetIds] })
                }
              >
                批量删除
              </button>
            </div>
          ) : null}
''', '''          {targetScope === 'active' && selectedTargetIds.size > 0 ? (
            <AdminSelectionBar count={selectedTargetIds.size} noun="链接">
              <Button variant="danger" disabled={working} onClick={() => setDeleteState({ kind: 'target', ids: [...selectedTargetIds] })}>批量删除</Button>
            </AdminSelectionBar>
          ) : null}
''')
replace_once(path, '''            {targetsLoading ? (
              <div className="conversion-empty">正在读取链接…</div>
            ) : filteredTargets.length === 0 ? (
              <div className="conversion-empty">
                <strong>暂无链接</strong>
              </div>
            ) : (''', '''            {targetsLoading ? (
              <AdminFeedbackState kind="loading" title="正在读取链接…" />
            ) : filteredTargets.length === 0 ? (
              <AdminFeedbackState kind="empty" title="暂无链接" description="为当前链接分组添加第一个跳转地址。" />
            ) : (''')
# target row selection semantics
replace_once(path, '<tr key={target.id}>', '<tr key={target.id} className={`ui-data-row${selectedTargetIds.has(target.id) ? \' is-selected\' : \'\'}`} aria-selected={targetScope === \'active\' ? selectedTargetIds.has(target.id) : undefined}>')
# delete modal -> shared dialog
text = Path(path).read_text()
start = text.index('      {deleteState ? (')
end = text.index('    </section>\n  );', start)
replacement = '''      <AdminDialog
        open={deleteState !== null}
        title={`确认删除 ${deleteState?.ids.length ?? 0} 项？`}
        eyebrow="移入回收站"
        role="alertdialog"
        onClose={() => setDeleteState(null)}
        closeDisabled={working}
        size="small"
        footer={
          <>
            <Button variant="secondary" disabled={working} onClick={() => setDeleteState(null)}>取消</Button>
            <Button variant="danger" loading={working} onClick={() => void confirmDelete()}>确认删除</Button>
          </>
        }
      >
        <p>删除语义、依赖保护与回收站行为保持现有服务端规则。</p>
      </AdminDialog>
'''
Path(path).write_text(text[:start] + replacement + text[end:])

# Asset Library: shared tabs/search/selection/feedback while preserving API and visual asset grid.
path = 'apps/admin/src/AssetLibraryView.tsx'
insert_after(path, "import { AdminApiError } from './api';\n", shared_imports + "import { AdminFeedbackState } from './components/ui/feedback-state';\nimport { AdminStatusBadge } from './components/ui/status-badge';\n")
# upload queue status becomes shared textual badge
replace_once(path, '<b>{uploadStatusLabel(item)}</b>', '<AdminStatusBadge tone={item.status === \'error\' ? \'danger\' : item.status === \'uploaded\' || item.status === \'reused\' ? \'success\' : \'info\'}>{uploadStatusLabel(item)}</AdminStatusBadge>')
# top tabs
text = Path(path).read_text()
old = '''        <div className="media-center-tabs" role="tablist" aria-label="素材中心模式">
          <button
            type="button"
            className={tab === 'library' ? 'is-active' : undefined}
            onClick={() => setTab('library')}
          >
            素材中心
          </button>
          <button
            type="button"
            className={tab === 'cleanup' ? 'is-active' : undefined}
            onClick={() => setTab('cleanup')}
          >
            存储清理
          </button>
        </div>'''
new = '''        <AdminSegmentedControl ariaLabel="素材中心模式" className="media-center-tabs">
          <AdminSegmentedItem selected={tab === 'library'} onClick={() => setTab('library')}>素材中心</AdminSegmentedItem>
          <AdminSegmentedItem selected={tab === 'cleanup'} onClick={() => setTab('cleanup')}>存储清理</AdminSegmentedItem>
        </AdminSegmentedControl>'''
if old not in text: raise SystemExit('asset tabs not found')
text = text.replace(old,new,1)
Path(path).write_text(text)
# library search/filter toolbar
text = Path(path).read_text()
start = text.index('          <div className="media-center-toolbar">')
end = text.index('          {selectedManagedAssets.length > 0 ? (', start)
old_block = text[start:end]
new_block = '''          <AdminToolbar aria-label="素材筛选工具栏" className="media-center-toolbar">
            <AdminSearchField label="搜索素材" value={mediaQuery} placeholder="搜索文件名、文件夹或格式" onChange={(event) => setMediaQuery(event.target.value)} />
            <label className="ui-management-filter"><span>文件夹</span><select value={folderFilter} onChange={(event) => setFolderFilter(event.target.value)}><option value="all">全部文件夹</option><option value="unfiled">未分组</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name} ({folder.assetCount})</option>)}</select></label>
            <label className="ui-management-filter"><span>格式</span><select value={mediaKind} onChange={(event) => setMediaKind(event.target.value as MediaKind | '')}>{KIND_OPTIONS.map((option) => <option key={option.value || 'all'} value={option.value}>{option.label}</option>)}</select></label>
            <label className="ui-management-filter"><span>用途</span><select value={mediaRole} onChange={(event) => setMediaRole(event.target.value as MediaRole | '')}><option value="">全部用途</option>{ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <Button variant="secondary" onClick={() => void loadMedia()} disabled={mediaLoading || uploadQueue.running}>刷新</Button>
          </AdminToolbar>

'''
Path(path).write_text(text[:start] + new_block + text[end:])
replace_once(path, '''          {selectedManagedAssets.length > 0 ? (
            <div className="media-center-selection-toolbar">
              <span>已选择 {selectedManagedAssets.length} 个素材</span>''', '''          {selectedManagedAssets.length > 0 ? (
            <AdminSelectionBar count={selectedManagedAssets.length} noun="素材" className="media-center-selection-toolbar">''')
# close selection toolbar div to component at the known end immediately before conditional close
text = Path(path).read_text()
selection_start = text.index('            <AdminSelectionBar count={selectedManagedAssets.length}')
selection_cond_end = text.index('          ) : null}', selection_start)
segment = text[selection_start:selection_cond_end]
last_close = segment.rfind('            </div>')
if last_close == -1: raise SystemExit('asset selection close not found')
segment = segment[:last_close] + '            </AdminSelectionBar>' + segment[last_close+len('            </div>'):]
Path(path).write_text(text[:selection_start] + segment + text[selection_cond_end:])
# selected asset semantic and remove emoji metadata
text = Path(path).read_text()
text = text.replace('''                      key={asset.id}
                    >''', '''                      key={asset.id}
                      aria-selected={selectedMediaIds.has(asset.id)}
                    >''')
text = text.replace("{asset.folderName ? `📁 ${asset.folderName} · ` : '未分组 · '}", "{asset.folderName ? `${asset.folderName} · ` : '未分组 · '}")
text = text.replace('<div className="media-center-empty">正在读取素材…</div>', '<AdminFeedbackState kind="loading" title="正在读取素材…" />')
text = text.replace('''            <div className="media-center-empty">
              <strong>没有匹配的素材</strong>
              <p>调整文件夹或筛选条件，或者上传新的素材。</p>
            </div>''', '''            <AdminFeedbackState kind="empty" title="没有匹配的素材" description="调整文件夹或筛选条件，或者上传新的素材。" />''')
Path(path).write_text(text)

# Shared management CSS only; feature geometry remains in feature CSS.
css_path = Path('apps/admin/src/admin-ui-system.css')
css = css_path.read_text()
marker = '/* ---------- Phase D management workspaces ---------- */'
if marker not in css:
    css += '''\n\n/* ---------- Phase D management workspaces ---------- */
.ui-management-toolbar {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border: 1px solid var(--admin-border);
  border-radius: var(--admin-radius-md);
  background: var(--admin-surface);
  box-shadow: var(--admin-shadow-card);
}

.ui-management-toolbar-leading,
.ui-management-toolbar-controls,
.ui-management-toolbar-trailing,
.ui-management-selection-actions,
.ui-row-actions,
.ui-sort-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ui-management-toolbar-controls {
  flex: 1 1 auto;
  min-width: 180px;
}

.ui-management-toolbar-trailing {
  margin-left: auto;
}

.ui-management-search {
  position: relative;
  display: flex;
  flex: 1 1 260px;
  min-width: 180px;
  align-items: center;
}

.ui-management-search > svg {
  position: absolute;
  z-index: 1;
  left: 10px;
  color: var(--admin-text-subtle);
  pointer-events: none;
}

.ui-management-search .ui-input {
  padding-left: 34px;
}

.ui-management-filter {
  display: grid;
  gap: 3px;
  color: var(--admin-text-muted);
  font-size: 0.68rem;
  font-weight: 700;
}

.ui-management-filter select {
  min-height: var(--admin-control-h);
  padding: 0 28px 0 9px;
  border: 1px solid var(--admin-border-strong);
  border-radius: var(--admin-radius-sm);
  color: var(--admin-text);
  background: var(--admin-surface);
  font-size: 0.76rem;
}

.ui-management-selection-bar {
  display: flex;
  min-height: 44px;
  align-items: center;
  gap: 10px;
  padding: 6px 8px 6px 12px;
  border: 1px solid #ffb79d;
  border-radius: var(--admin-radius-sm);
  background: var(--admin-brand-soft);
}

.ui-management-selection-bar > strong {
  color: #8a3417;
  font-size: 0.76rem;
}

.ui-management-selection-actions {
  margin-left: auto;
}

.ui-data-row.is-selected > td,
.ui-data-row[aria-selected='true'] > td {
  background: var(--admin-brand-soft);
}

.ui-data-row.is-selected > td:first-child,
.ui-data-row[aria-selected='true'] > td:first-child {
  box-shadow: inset 3px 0 0 var(--admin-brand);
}

.ui-row-action-danger {
  color: var(--admin-danger);
}

.ui-sort-actions .ui-button--icon {
  width: 32px;
  min-height: 32px;
}

@media (max-width: 760px) {
  .ui-management-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .ui-management-toolbar-leading,
  .ui-management-toolbar-controls,
  .ui-management-toolbar-trailing {
    width: 100%;
  }

  .ui-management-toolbar-controls {
    flex-wrap: wrap;
  }

  .ui-management-toolbar-trailing {
    margin-left: 0;
    justify-content: flex-end;
  }

  .ui-management-search {
    flex-basis: 100%;
  }

  .ui-management-selection-bar {
    align-items: stretch;
    flex-direction: column;
  }

  .ui-management-selection-actions {
    width: 100%;
    margin-left: 0;
    flex-wrap: wrap;
  }

  .ui-management-selection-actions .ui-button {
    min-height: 44px;
  }
}
'''
css_path.write_text(css)
