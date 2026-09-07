from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"missing replacement in {path}: {old[:120]!r}")
    p.write_text(text.replace(old, new, 1))


# Asset Library uses the shared selection state helper for both managed media and cleanup selection.
path = 'apps/admin/src/AssetLibraryView.tsx'
replace_once(path, '''  function toggleMedia(id: string) {
    setSelectedMediaIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllMedia() {
    setSelectedMediaIds((current) => {
      const next = new Set(current);
      managedAssets.forEach((asset) => {
        if (allManagedSelected) next.delete(asset.id);
        else next.add(asset.id);
      });
      return next;
    });
  }
''', '''  function toggleMedia(id: string) {
    setSelectedMediaIds((current) => toggleSelection(current, id));
  }

  function toggleAllMedia() {
    setSelectedMediaIds((current) =>
      toggleVisibleSelection(
        current,
        managedAssets.map((asset) => asset.id),
        allManagedSelected,
      ),
    );
  }
''')
replace_once(path, '''  function toggleKey(key: string) {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAll() {
    setSelectedKeys((current) => {
      const next = new Set(current);
      visibleCleanupKeys.forEach((key) => {
        if (allUnusedSelected) next.delete(key);
        else next.add(key);
      });
      return next;
    });
  }
''', '''  function toggleKey(key: string) {
    setSelectedKeys((current) => toggleSelection(current, key));
  }

  function toggleAll() {
    setSelectedKeys((current) =>
      toggleVisibleSelection(current, visibleCleanupKeys, allUnusedSelected),
    );
  }
''')

# Conversion Pool uses the same bulk-selection behavior and shared status badge semantics.
path = 'apps/admin/src/ConversionPoolView.tsx'
replace_once(path, '''                      onChange={() => {
                        setSelectedGroupIds((current) => {
                          const next = new Set(current);
                          filteredGroups.forEach((group) => {
                            if (allGroupsSelected) next.delete(group.id);
                            else next.add(group.id);
                          });
                          return next;
                        });
                      }}''', '''                      onChange={() => {
                        setSelectedGroupIds((current) =>
                          toggleVisibleSelection(
                            current,
                            filteredGroups.map((group) => group.id),
                            allGroupsSelected,
                          ),
                        );
                      }}''')
replace_once(path, '''                          onChange={() => {
                            setSelectedTargetIds((current) => {
                              const next = new Set(current);
                              filteredTargets.forEach((target) => {
                                if (allTargetsSelected) next.delete(target.id);
                                else next.add(target.id);
                              });
                              return next;
                            });
                          }}''', '''                          onChange={() => {
                            setSelectedTargetIds((current) =>
                              toggleVisibleSelection(
                                current,
                                filteredTargets.map((target) => target.id),
                                allTargetsSelected,
                              ),
                            );
                          }}''')
replace_once(path, '''                      <button
                        className={`status-pill ${group.isEnabled ? 'is-enabled' : 'is-disabled'}`}
                        type="button"
                        disabled={working}
                        onClick={() => void toggleGroup(group)}
                      >
                        {readinessLabel(group)}
                      </button>''', '''                      <Button
                        variant="ghost"
                        size="compact"
                        disabled={working}
                        aria-label={`${group.isEnabled ? '停用' : '启用'}转化分组 ${group.name}`}
                        onClick={() => void toggleGroup(group)}
                      >
                        <AdminStatusBadge tone={group.isEnabled ? 'success' : 'default'}>
                          {readinessLabel(group)}
                        </AdminStatusBadge>
                      </Button>''')
replace_once(path, '<span className="status-pill is-deleted">已删除</span>', '<AdminStatusBadge tone="warning">已删除</AdminStatusBadge>')
replace_once(path, '''                          <button
                            className={`status-pill ${target.isEnabled ? 'is-enabled' : 'is-disabled'}`}
                            type="button"
                            disabled={working}
                            onClick={() => void toggleTarget(target)}
                          >
                            {target.isEnabled ? '参与轮换' : '已停用'}
                          </button>''', '''                          <Button
                            variant="ghost"
                            size="compact"
                            disabled={working}
                            aria-label={`${target.isEnabled ? '停用' : '启用'}链接 ${target.name}`}
                            onClick={() => void toggleTarget(target)}
                          >
                            <AdminStatusBadge tone={target.isEnabled ? 'success' : 'default'}>
                              {target.isEnabled ? '参与轮换' : '已停用'}
                            </AdminStatusBadge>
                          </Button>''')
replace_once(path, '<span className="status-pill is-deleted">已删除</span>', '<AdminStatusBadge tone="warning">已删除</AdminStatusBadge>')
