import { useState, type DragEvent } from 'react';
import type { AdminSection } from './api';
import type { HomeLayout } from './site-hero-settings-api';

type HomePlacement = 'shortcutSectionIds' | 'recommendationSectionIds';

const LIMITS: Record<HomePlacement, number | null> = {
  shortcutSectionIds: 7,
  recommendationSectionIds: null,
};

function moveItem(items: string[], index: number, direction: -1 | 1): string[] {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= items.length) return items;
  const next = [...items];
  const current = next[index];
  const target = next[targetIndex];
  if (current === undefined || target === undefined) return items;
  next[index] = target;
  next[targetIndex] = current;
  return next;
}

function removeItem(items: string[], index: number): string[] {
  return items.filter((_, itemIndex) => itemIndex !== index);
}

export function HomeLayoutSettingsSection({
  value,
  sections,
  busy,
  onChange,
}: {
  value: HomeLayout;
  sections: AdminSection[];
  busy: boolean;
  onChange: (value: HomeLayout) => void;
}) {
  const [addSelection, setAddSelection] = useState<Record<HomePlacement, string>>({
    shortcutSectionIds: '',
    recommendationSectionIds: '',
  });
  const [dragging, setDragging] = useState<{
    placement: HomePlacement;
    index: number;
  } | null>(null);

  function updatePlacement(placement: HomePlacement, ids: string[]) {
    onChange({ ...value, [placement]: ids });
  }

  function addPlacement(placement: HomePlacement) {
    const current = value[placement];
    const limit = LIMITS[placement];
    const sectionId = addSelection[placement];
    if (
      !sectionId ||
      current.includes(sectionId) ||
      (limit !== null && current.length >= limit)
    ) {
      return;
    }
    updatePlacement(placement, [...current, sectionId]);
    setAddSelection((currentSelection) => ({ ...currentSelection, [placement]: '' }));
  }

  function moveByDrag(placement: HomePlacement, targetIndex: number) {
    if (!dragging || dragging.placement !== placement || dragging.index === targetIndex) {
      return;
    }
    const next = [...value[placement]];
    const [moved] = next.splice(dragging.index, 1);
    if (!moved) return;
    next.splice(targetIndex, 0, moved);
    updatePlacement(placement, next);
  }

  function renderPlacement(
    placement: HomePlacement,
    title: string,
    description: string,
    addLabel: string,
  ) {
    const ids = value[placement];
    const limit = LIMITS[placement];
    const availableSections = sections.filter((section) => !ids.includes(section.id));
    const canAdd = (limit === null || ids.length < limit) && availableSections.length > 0;

    return (
      <section className="admin-home-layout-group" aria-label={title}>
        <div className="admin-home-layout-heading">
          <div>
            <strong>{title}</strong>
            <p>{description}</p>
          </div>
          <span>{limit === null ? `${ids.length} 个` : `${ids.length}/${limit}`}</span>
        </div>

        {ids.length > 0 ? (
          <div className="admin-home-layout-list">
            {ids.map((sectionId, index) => {
              const selected = sections.find((section) => section.id === sectionId);
              return (
                <article
                  className={`admin-home-layout-row${
                    dragging?.placement === placement && dragging.index === index
                      ? ' is-dragging'
                      : ''
                  }`}
                  draggable={!busy}
                  key={`${placement}:${sectionId}`}
                  onDragEnd={() => setDragging(null)}
                  onDragOver={(event: DragEvent<HTMLElement>) => {
                    if (dragging?.placement !== placement) return;
                    event.preventDefault();
                  }}
                  onDragStart={(event: DragEvent<HTMLElement>) => {
                    event.dataTransfer.effectAllowed = 'move';
                    setDragging({ placement, index });
                  }}
                  onDrop={(event: DragEvent<HTMLElement>) => {
                    event.preventDefault();
                    moveByDrag(placement, index);
                    setDragging(null);
                  }}
                >
                  <span className="admin-home-layout-drag" aria-hidden="true">
                    ⋮⋮
                  </span>
                  <span className="admin-home-layout-identity">
                    <strong>{selected?.name ?? '不可用分区'}</strong>
                    <small>{selected ? `/sections/${selected.slug}/` : sectionId}</small>
                  </span>
                  <div className="admin-home-layout-row-actions">
                    <button
                      type="button"
                      className="admin-text-button"
                      disabled={busy || index === 0}
                      onClick={() => updatePlacement(placement, moveItem(ids, index, -1))}
                    >
                      上移
                    </button>
                    <button
                      type="button"
                      className="admin-text-button"
                      disabled={busy || index === ids.length - 1}
                      onClick={() => updatePlacement(placement, moveItem(ids, index, 1))}
                    >
                      下移
                    </button>
                    <button
                      type="button"
                      className="admin-text-button is-danger"
                      disabled={busy}
                      onClick={() => updatePlacement(placement, removeItem(ids, index))}
                    >
                      移除
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="admin-home-layout-empty">尚未选择分区。</div>
        )}

        <div className="admin-home-layout-add">
          <label className="sr-only" htmlFor={`${placement}-add-section`}>
            {addLabel}
          </label>
          <select
            id={`${placement}-add-section`}
            aria-label={addLabel}
            disabled={busy || !canAdd}
            value={addSelection[placement]}
            onChange={(event) =>
              setAddSelection((currentSelection) => ({
                ...currentSelection,
                [placement]: event.target.value,
              }))
            }
          >
            <option value="">选择现有分区</option>
            {availableSections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="secondary-button"
            disabled={busy || !canAdd || !addSelection[placement]}
            onClick={() => addPlacement(placement)}
          >
            {addLabel}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      className="admin-settings-section"
      aria-labelledby="settings-home-layout-title"
    >
      <div className="admin-settings-section-heading">
        <div>
          <h2 id="settings-home-layout-title">首页分区</h2>
          <p className="admin-settings-section-description">
            选择首页使用的现有分区，并通过拖拽或方向按钮调整展示顺序。
          </p>
        </div>
      </div>

      <div className="admin-home-layout-grid">
        {renderPlacement(
          'shortcutSectionIds',
          '快捷分区',
          '选择作为首页快捷入口的分区，最多 7 个。',
          '添加快捷分区',
        )}
        {renderPlacement(
          'recommendationSectionIds',
          '推荐分区',
          '选择在首页展示商品横滑的分区，并按这里的顺序呈现。',
          '添加推荐分区',
        )}
      </div>
    </section>
  );
}
