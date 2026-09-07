from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"missing replacement in {path}: {old[:140]!r}")
    p.write_text(text.replace(old, new, 1))


def insert_after(path: str, marker: str, addition: str) -> None:
    p = Path(path)
    text = p.read_text()
    if addition.strip() in text:
        return
    if marker not in text:
        raise SystemExit(f"missing marker in {path}: {marker!r}")
    p.write_text(text.replace(marker, marker + addition, 1))


# Product editor: keep complex dedicated editor body and dirty/requestClose behavior,
# but use the Phase C dialog shell and shared footer actions.
path = 'apps/admin/src/product-management/ProductEditorDialog.tsx'
insert_after(
    path,
    "import { useMemo, useState, type FormEvent, type KeyboardEvent } from 'react';\n",
    "import { Button } from '../components/ui/button';\nimport { AdminDialog } from '../components/ui/dialog';\n",
)
replace_once(
    path,
    '''  return (\n    <div className="admin-dialog-backdrop product-dialog-backdrop" role="presentation">\n      <section\n        className="admin-dialog product-editor-dialog"\n        role="dialog"\n        aria-modal="true"\n        aria-labelledby="product-editor-title"\n      >\n        <div className="admin-dialog-header">\n          <div>\n            <p>{sectionName} · 产品内容</p>\n            <h3 id="product-editor-title">{editingProduct ? '编辑产品' : '新增产品'}</h3>\n          </div>\n          <button\n            type="button"\n            aria-label="关闭"\n            disabled={busy}\n            onClick={() => void requestClose()}\n          >\n            ×\n          </button>\n        </div>\n\n''',
    '''  return (\n    <AdminDialog\n      open\n      title={editingProduct ? '编辑产品' : '新增产品'}\n      eyebrow={`${sectionName} · 产品内容`}\n      onClose={() => void requestClose()}\n      closeDisabled={busy}\n      size="large"\n      className="product-editor-dialog"\n    >\n''',
)
replace_once(
    path,
    '''          <div className="admin-dialog-actions">\n            <button type="button" disabled={busy} onClick={() => void requestClose()}>\n              取消\n            </button>\n            <button className="primary-button" type="submit" disabled={busy}>\n              {saveButtonLabel(saveStage, editingProduct)}\n            </button>\n          </div>''',
    '''          <div className="admin-dialog-actions">\n            <Button variant="secondary" disabled={busy} onClick={() => void requestClose()}>\n              取消\n            </Button>\n            <Button type="submit" variant="primary" loading={saveStage === 'saving'} disabled={handoffBusy}>\n              {saveButtonLabel(saveStage, editingProduct)}\n            </Button>\n          </div>''',
)
replace_once(path, '''        </form>\n      </section>\n    </div>\n  );''', '''        </form>\n    </AdminDialog>\n  );''')

# Section editor: same body/validation/media flow, shared shell and actions.
path = 'apps/admin/src/section-management/SectionEditorDialog.tsx'
insert_after(
    path,
    "import type { FormEvent } from 'react';\n",
    "import { Button } from '../components/ui/button';\nimport { AdminDialog } from '../components/ui/dialog';\n",
)
replace_once(
    path,
    '''  return (\n    <div className="admin-dialog-backdrop" role="presentation">\n      <section\n        className="admin-dialog section-editor-dialog"\n        role="dialog"\n        aria-modal="true"\n        aria-labelledby="section-editor-title"\n      >\n        <div className="admin-dialog-header">\n          <div>\n            <h3 id="section-editor-title">{editingSection ? '编辑分区' : '新增分区'}</h3>\n            <p className="section-editor-header-note">\n              配置前端显示内容、快捷入口和 Browse 卡片样式。\n            </p>\n          </div>\n          <button type="button" aria-label="关闭" disabled={busy} onClick={onClose}>\n            ×\n          </button>\n        </div>\n\n''',
    '''  return (\n    <AdminDialog\n      open\n      title={editingSection ? '编辑分区' : '新增分区'}\n      description="配置前端显示内容、快捷入口和 Browse 卡片样式。"\n      onClose={onClose}\n      closeDisabled={busy}\n      size="large"\n      className="section-editor-dialog"\n    >\n''',
)
replace_once(
    path,
    '''          <div className="admin-dialog-footer">\n            <button\n              type="button"\n              className="secondary-button"\n              disabled={busy}\n              onClick={onClose}\n            >\n              取消\n            </button>\n            <button type="submit" className="primary-button" disabled={busy}>\n              {saving ? '保存中…' : '保存修改'}\n            </button>\n          </div>''',
    '''          <div className="admin-dialog-actions">\n            <Button variant="secondary" disabled={busy} onClick={onClose}>\n              取消\n            </Button>\n            <Button type="submit" variant="primary" loading={saving} disabled={processingIcon}>\n              保存修改\n            </Button>\n          </div>''',
)
replace_once(path, '''        </form>\n      </section>\n    </div>\n  );''', '''        </form>\n    </AdminDialog>\n  );''')

# Conversion group editor: preserve existing customer-service loading/request timing.
path = 'apps/admin/src/conversion-pool/ConversionGroupEditorDialog.tsx'
insert_after(
    path,
    "import { AdminApiError } from '../api';\n",
    "import { Button } from '../components/ui/button';\nimport { AdminDialog } from '../components/ui/dialog';\n",
)
replace_once(
    path,
    '''  return (\n    <div className="admin-dialog-backdrop" role="presentation">\n      <section\n        className="admin-dialog conversion-editor-dialog"\n        role="dialog"\n        aria-modal="true"\n        aria-labelledby="conversion-group-editor-title"\n      >\n        <div className="admin-dialog-header">\n          <div>\n            <p>{sectionName} · 转化池</p>\n            <h3 id="conversion-group-editor-title">\n              {editingGroup ? '编辑转化分组' : '新增转化分组'}\n            </h3>\n          </div>\n          <button type="button" aria-label="关闭" disabled={saving} onClick={onClose}>\n            ×\n          </button>\n        </div>\n\n''',
    '''  return (\n    <AdminDialog\n      open\n      title={editingGroup ? '编辑转化分组' : '新增转化分组'}\n      eyebrow={`${sectionName} · 转化池`}\n      onClose={onClose}\n      closeDisabled={saving}\n      size="medium"\n      className="conversion-editor-dialog"\n    >\n''',
)
replace_once(
    path,
    '''          <div className="admin-dialog-actions">\n            <button\n              className="secondary-button"\n              type="button"\n              disabled={saving}\n              onClick={onClose}\n            >\n              取消\n            </button>\n            <button\n              className="primary-button"\n              type="submit"\n              disabled={\n                saving || (isCustomerService && !form.customerServiceConnectionId)\n              }\n            >\n              {saving ? '正在保存…' : '保存分组'}\n            </button>\n          </div>''',
    '''          <div className="admin-dialog-actions">\n            <Button variant="secondary" disabled={saving} onClick={onClose}>\n              取消\n            </Button>\n            <Button\n              type="submit"\n              variant="primary"\n              loading={saving}\n              disabled={isCustomerService && !form.customerServiceConnectionId}\n            >\n              保存分组\n            </Button>\n          </div>''',
)
replace_once(path, '''        </form>\n      </section>\n    </div>\n  );''', '''        </form>\n    </AdminDialog>\n  );''')

# Tag table row actions use the same shared hierarchy as Category.
path = 'apps/admin/src/TagManagementView.tsx'
replace_once(
    path,
    '''                  <td className="actions-cell">\n                    {scope === 'active' ? (\n                      <>\n                        <button\n                          type="button"\n                          disabled={working}\n                          onClick={() => openEditEditor(tag)}\n                        >\n                          编辑\n                        </button>\n                        <button\n                          type="button"\n                          className="text-danger"\n                          disabled={working}\n                          onClick={() => setPendingDeleteIds([tag.id])}\n                        >\n                          删除\n                        </button>\n                      </>\n                    ) : (\n                      <button\n                        type="button"\n                        disabled={working}\n                        onClick={() => void restoreTag(tag)}\n                      >\n                        恢复\n                      </button>\n                    )}\n                  </td>''',
    '''                  <td className="actions-cell">\n                    <div className="ui-row-actions">\n                      {scope === 'active' ? (\n                        <>\n                          <Button variant="ghost" size="compact" disabled={working} aria-label={`编辑标签 ${tag.name}`} onClick={() => openEditEditor(tag)}>\n                            编辑\n                          </Button>\n                          <Button variant="ghost" size="compact" className="ui-row-action-danger" disabled={working} aria-label={`删除标签 ${tag.name}`} onClick={() => setPendingDeleteIds([tag.id])}>\n                            删除\n                          </Button>\n                        </>\n                      ) : (\n                        <Button variant="secondary" size="compact" disabled={working} aria-label={`恢复标签 ${tag.name}`} onClick={() => void restoreTag(tag)}>\n                          恢复\n                        </Button>\n                      )}\n                    </div>\n                  </td>''',
)
replace_once(path, '<div className="category-table-wrap">\n          <table className="category-table">', '<div className="category-table-wrap ui-data-table-wrap">\n          <table className="category-table ui-data-table">')
replace_once(path, '<div>\n                          <Button\n                            variant="ghost"', '<div className="ui-sort-actions">\n                          <Button\n                            variant="ghost"')

# Conversion table: Lucide controls, shared table/list/action hierarchy.
path = 'apps/admin/src/ConversionPoolView.tsx'
insert_after(path, "import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';\n", "import { ArrowDown, ArrowUp } from 'lucide-react';\n")
replace_once(path, '<div className="conversion-table-wrap">\n', '<div className="conversion-table-wrap ui-data-table-wrap">\n')
replace_once(path, '<table className="conversion-table">', '<table className="conversion-table ui-data-table">')
replace_once(path, '<table className="conversion-table conversion-target-table">', '<table className="conversion-table conversion-target-table ui-data-table">')
# group sort
replace_once(
    path,
    '''                        <div>\n                          <button\n                            type="button"\n                            disabled={working || groupReorderBlocked || index === 0}\n                            onClick={() => void moveGroup(group, -1)}\n                          >\n                            ↑\n                          </button>\n                          <button\n                            type="button"\n                            disabled={\n                              working ||\n                              groupReorderBlocked ||\n                              index === filteredGroups.length - 1\n                            }\n                            onClick={() => void moveGroup(group, 1)}\n                          >\n                            ↓\n                          </button>\n                        </div>''',
    '''                        <div className="ui-sort-actions">\n                          <Button variant="ghost" size="icon" aria-label={`上移 ${group.name}`} disabled={working || groupReorderBlocked || index === 0} onClick={() => void moveGroup(group, -1)}>\n                            <ArrowUp aria-hidden="true" size={15} />\n                          </Button>\n                          <Button variant="ghost" size="icon" aria-label={`下移 ${group.name}`} disabled={working || groupReorderBlocked || index === filteredGroups.length - 1} onClick={() => void moveGroup(group, 1)}>\n                            <ArrowDown aria-hidden="true" size={15} />\n                          </Button>\n                        </div>''',
)
# target sort
replace_once(
    path,
    '''                            <div>\n                              <button\n                                type="button"\n                                disabled={working || targetReorderBlocked || index === 0}\n                                onClick={() => void moveTarget(target, -1)}\n                              >\n                                ↑\n                              </button>\n                              <button\n                                type="button"\n                                disabled={\n                                  working ||\n                                  targetReorderBlocked ||\n                                  index === filteredTargets.length - 1\n                                }\n                                onClick={() => void moveTarget(target, 1)}\n                              >\n                                ↓\n                              </button>\n                            </div>''',
    '''                            <div className="ui-sort-actions">\n                              <Button variant="ghost" size="icon" aria-label={`上移 ${target.name}`} disabled={working || targetReorderBlocked || index === 0} onClick={() => void moveTarget(target, -1)}>\n                                <ArrowUp aria-hidden="true" size={15} />\n                              </Button>\n                              <Button variant="ghost" size="icon" aria-label={`下移 ${target.name}`} disabled={working || targetReorderBlocked || index === filteredTargets.length - 1} onClick={() => void moveTarget(target, 1)}>\n                                <ArrowDown aria-hidden="true" size={15} />\n                              </Button>\n                            </div>''',
)
# group action cell: preserve all disable predicates/callbacks.
replace_once(
    path,
    '''                  <td className="actions-cell">\n                    {groupScope === 'active' ? (\n                      <>\n                        {group.mode === 'link' ? (\n                          <>\n                            <button\n                              type="button"\n                              onClick={() => setSelectedGroupId(group.id)}\n                            >\n                              管理链接\n                            </button>\n                            <button\n                              type="button"\n                              disabled={\n                                working ||\n                                group.activeTargetCount === 0 ||\n                                !group.isEnabled\n                              }\n                              onClick={() => void runRotationPreview(group)}\n                            >\n                              测试轮换\n                            </button>\n                          </>\n                        ) : null}\n                        <button type="button" onClick={() => openEditGroup(group)}>\n                          编辑\n                        </button>\n                        <button\n                          className="text-danger"\n                          type="button"\n                          disabled={\n                            working ||\n                            group.productCount > 0 ||\n                            (group.mode === 'link' && group.targetCount > 0)\n                          }\n                          onClick={() =>\n                            setDeleteState({ kind: 'group', ids: [group.id] })\n                          }\n                        >\n                          删除\n                        </button>\n                      </>\n                    ) : (\n                      <button\n                        type="button"\n                        disabled={working}\n                        onClick={() => void restoreGroup(group)}\n                      >\n                        恢复\n                      </button>\n                    )}\n                  </td>''',
    '''                  <td className="actions-cell">\n                    <div className="ui-row-actions">\n                      {groupScope === 'active' ? (\n                        <>\n                          {group.mode === 'link' ? (\n                            <>\n                              <Button variant="ghost" size="compact" aria-label={`管理 ${group.name} 的链接`} onClick={() => setSelectedGroupId(group.id)}>管理链接</Button>\n                              <Button variant="ghost" size="compact" disabled={working || group.activeTargetCount === 0 || !group.isEnabled} aria-label={`测试 ${group.name} 轮换`} onClick={() => void runRotationPreview(group)}>测试轮换</Button>\n                            </>\n                          ) : null}\n                          <Button variant="ghost" size="compact" aria-label={`编辑转化分组 ${group.name}`} onClick={() => openEditGroup(group)}>编辑</Button>\n                          <Button variant="ghost" size="compact" className="ui-row-action-danger" disabled={working || group.productCount > 0 || (group.mode === 'link' && group.targetCount > 0)} aria-label={`删除转化分组 ${group.name}`} onClick={() => setDeleteState({ kind: 'group', ids: [group.id] })}>删除</Button>\n                        </>\n                      ) : (\n                        <Button variant="secondary" size="compact" disabled={working} aria-label={`恢复转化分组 ${group.name}`} onClick={() => void restoreGroup(group)}>恢复</Button>\n                      )}\n                    </div>\n                  </td>''',
)
# target actions final block patterns.
replace_once(
    path,
    '''                      <td className="actions-cell">\n                        {targetScope === 'active' ? (\n                          <>\n                            <button type="button" onClick={() => openEditTarget(target)}>\n                              编辑\n                            </button>\n                            <button\n                              className="text-danger"\n                              type="button"\n                              disabled={working}\n                              onClick={() =>\n                                setDeleteState({ kind: 'target', ids: [target.id] })\n                              }\n                            >\n                              删除\n                            </button>\n                          </>\n                        ) : (\n                          <button\n                            type="button"\n                            disabled={working}\n                            onClick={() => void restoreTarget(target)}\n                          >\n                            恢复\n                          </button>\n                        )}\n                      </td>''',
    '''                      <td className="actions-cell">\n                        <div className="ui-row-actions">\n                          {targetScope === 'active' ? (\n                            <>\n                              <Button variant="ghost" size="compact" aria-label={`编辑链接 ${target.name}`} onClick={() => openEditTarget(target)}>编辑</Button>\n                              <Button variant="ghost" size="compact" className="ui-row-action-danger" disabled={working} aria-label={`删除链接 ${target.name}`} onClick={() => setDeleteState({ kind: 'target', ids: [target.id] })}>删除</Button>\n                            </>\n                          ) : (\n                            <Button variant="secondary" size="compact" disabled={working} aria-label={`恢复链接 ${target.name}`} onClick={() => void restoreTarget(target)}>恢复</Button>\n                          )}\n                        </div>\n                      </td>''',
)

# Asset Library: shared buttons for management bulk actions; cleanup gets the same
# toolbar/selection/feedback pattern without changing when any scan/API call occurs.
path = 'apps/admin/src/AssetLibraryView.tsx'
replace_once(
    path,
    '''              <button\n                type="button"\n                className="secondary-button"\n                disabled={folderWorking || uploadQueue.running}\n                onClick={() => void handleMoveSelected()}\n              >\n                移动已选\n              </button>\n              <button\n                type="button"\n                className="danger-button"\n                disabled={deletingMedia || uploadQueue.running}\n                onClick={() => void handleDeleteManaged()}\n              >\n                {deletingMedia ? '删除中…' : '删除已选'}\n              </button>''',
    '''              <Button variant="secondary" disabled={folderWorking || uploadQueue.running} onClick={() => void handleMoveSelected()}>\n                移动已选\n              </Button>\n              <Button variant="danger" loading={deletingMedia} disabled={uploadQueue.running} onClick={() => void handleDeleteManaged()}>\n                删除已选\n              </Button>''',
)
replace_once(
    path,
    '''      ) : cleanupLoading && !cleanupLoaded ? (\n        <section className="settings-card settings-loading" aria-live="polite">\n          <div className="loading-indicator" aria-hidden="true" />\n          <p>正在扫描首批 R2 图片对象，已发现 {scannedImages} 张图片…</p>\n        </section>''',
    '''      ) : cleanupLoading && !cleanupLoaded ? (\n        <AdminFeedbackState\n          kind="loading"\n          title="正在扫描首批 R2 图片对象…"\n          description={`已发现 ${scannedImages} 张图片。`}\n        />''',
)
replace_once(
    path,
    '''          <div className="asset-library-actions media-cleanup-actions">\n            <div>\n              <strong>底层存储清理</strong>\n              <span>\n                仅用于清理没有业务引用、且已经退出最近 3 个可回退快照的图片对象。\n              </span>\n            </div>\n            <button\n              className="secondary-button"\n              type="button"\n              disabled={cleanupLoading}\n              onClick={() => void scanFirstPage()}\n            >\n              从头重新扫描\n            </button>\n            {cleanupNextCursor ? (\n              <button\n                className="secondary-button"\n                type="button"\n                disabled={cleanupLoading}\n                onClick={() => void scanNextPage()}\n              >\n                继续扫描下一批\n              </button>\n            ) : null}\n            {cleanupNextCursor ? (\n              <button\n                className="secondary-button"\n                type="button"\n                disabled={cleanupLoading}\n                onClick={() => void scanAllRemaining()}\n              >\n                {cleanupLoading ? '扫描中…' : '扫描全部'}\n              </button>\n            ) : null}\n            <button\n              className="danger-button"\n              type="button"\n              disabled={selectedAssets.length === 0 || cleanupLoading}\n              onClick={() => setShowCleanupDialog(true)}\n            >\n              物理清理已选 ({selectedAssets.length})\n            </button>\n          </div>''',
    '''          <AdminToolbar\n            aria-label="R2 存储清理操作"\n            leading={\n              <div className="media-cleanup-copy">\n                <strong>底层存储清理</strong>\n                <span>仅用于清理没有业务引用、且已经退出最近 3 个可回退快照的图片对象。</span>\n              </div>\n            }\n            trailing={\n              <Button variant="danger" disabled={selectedAssets.length === 0 || cleanupLoading} onClick={() => setShowCleanupDialog(true)}>\n                物理清理已选 ({selectedAssets.length})\n              </Button>\n            }\n          >\n            <Button variant="secondary" disabled={cleanupLoading} onClick={() => void scanFirstPage()}>从头重新扫描</Button>\n            {cleanupNextCursor ? <Button variant="secondary" disabled={cleanupLoading} onClick={() => void scanNextPage()}>继续扫描下一批</Button> : null}\n            {cleanupNextCursor ? <Button variant="secondary" loading={cleanupLoading} onClick={() => void scanAllRemaining()}>扫描全部</Button> : null}\n          </AdminToolbar>''',
)
replace_once(
    path,
    '''          <div className="asset-toolbar">\n            <input\n              type="search"\n              value={query}\n              placeholder="搜索图片路径或 Content-Type"\n              onChange={(event) => setQuery(event.target.value)}\n            />\n            <div className="asset-filter-group" aria-label="图片使用状态">\n              <button\n                type="button"\n                className={filter === 'used' ? 'is-active' : undefined}\n                onClick={() => setFilter('used')}\n              >\n                使用中 ({cleanupStats.used})\n              </button>\n              <button\n                type="button"\n                className={filter === 'unused' ? 'is-active' : undefined}\n                onClick={() => setFilter('unused')}\n              >\n                未使用 ({cleanupStats.protected + cleanupStats.eligible})\n              </button>\n            </div>\n          </div>''',
    '''          <AdminToolbar\n            aria-label="R2 图片筛选工具栏"\n            leading={\n              <AdminSegmentedControl ariaLabel="图片使用状态">\n                <AdminSegmentedItem selected={filter === 'used'} onClick={() => setFilter('used')}>使用中 ({cleanupStats.used})</AdminSegmentedItem>\n                <AdminSegmentedItem selected={filter === 'unused'} onClick={() => setFilter('unused')}>未使用 ({cleanupStats.protected + cleanupStats.eligible})</AdminSegmentedItem>\n              </AdminSegmentedControl>\n            }\n          >\n            <AdminSearchField label="搜索 R2 图片" value={query} placeholder="搜索图片路径或 Content-Type" onChange={(event) => setQuery(event.target.value)} />\n          </AdminToolbar>\n\n          {selectedAssets.length > 0 ? (\n            <AdminSelectionBar count={selectedAssets.length} noun="可清理图片">\n              <Button variant="danger" disabled={cleanupLoading} onClick={() => setShowCleanupDialog(true)}>永久删除已选</Button>\n            </AdminSelectionBar>\n          ) : null}''',
)
replace_once(
    path,
    '''            <div className="asset-empty-state">\n              <strong>\n                {filter === 'used' ? '没有使用中的图片' : '没有未使用的图片'}\n              </strong>\n              <p>可以调整搜索条件或从头重新扫描 R2。</p>\n            </div>''',
    '''            <AdminFeedbackState\n              kind="empty"\n              title={filter === 'used' ? '没有使用中的图片' : '没有未使用的图片'}\n              description="可以调整搜索条件或从头重新扫描 R2。"\n            />''',
)
