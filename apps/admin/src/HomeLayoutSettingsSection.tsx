import type { AdminSection } from './api';
import type { HomeLayout } from './site-hero-settings-api';

export type HomePlacement = 'shortcutSectionIds' | 'recommendationSectionIds';

const LIMITS: Record<HomePlacement, number | null> = {
  shortcutSectionIds: 7,
  recommendationSectionIds: null,
};

function moveItem(items: string[], fromIndex: number, toIndex: number): string[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return items;
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  if (!moved) return items;
  next.splice(Math.min(toIndex, next.length), 0, moved);
  return next;
}

function replaceItem(items: string[], index: number, sectionId: string): string[] {
  return items.map((item, itemIndex) => (itemIndex === index ? sectionId : item));
}

function removeItem(items: string[], index: number): string[] {
  return items.filter((_, itemIndex) => itemIndex !== index);
}

export function HomeLayoutSettingsSection({
  value,
  sections,
  busy,
  onChange,
  placement,
}: {
  value: HomeLayout;
  sections: AdminSection[];
  busy: boolean;
  onChange: (value: HomeLayout) => void;
  placement?: HomePlacement;
}) {
  function updatePlacement(placement: HomePlacement, ids: string[]) {
    onChange({ ...value, [placement]: ids });
  }

  function addPlacement(placement: HomePlacement) {
    const current = value[placement];
    const limit = LIMITS[placement];
    const nextSection = sections.find((section) => !current.includes(section.id));
    if (!nextSection || (limit !== null && current.length >= limit)) return;
    updatePlacement(placement, [...current, nextSection.id]);
  }

  function renderPlacement(
    placement: HomePlacement,
    title: string,
    description: string,
    addLabel: string,
  ) {
    const ids = value[placement];
    const limit = LIMITS[placement];
    const canAdd =
      (limit === null || ids.length < limit) &&
      sections.some((section) => !ids.includes(section.id));

    return (
      <div className="admin-home-layout-group">
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
                <div
                  className="admin-home-layout-row"
                  key={`${placement}:${sectionId}`}
                  draggable={!busy}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', String(index));
                  }}
                  onDragOver={(event) => {
                    if (busy) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (busy) return;
                    const fromIndex = Number(event.dataTransfer.getData('text/plain'));
                    if (!Number.isInteger(fromIndex)) return;
                    updatePlacement(placement, moveItem(ids, fromIndex, index));
                  }}
                >
                  <span className="admin-home-layout-order">{index + 1}</span>
                  <span
                    className="admin-home-layout-drag-handle"
                    title="拖拽调整顺序"
                    aria-hidden="true"
                  >
                    ⋮⋮
                  </span>
                  <label className="field-group">
                    <span>分区</span>
                    <select
                      value={sectionId}
                      disabled={busy}
                      onChange={(event) =>
                        updatePlacement(
                          placement,
                          replaceItem(ids, index, event.target.value),
                        )
                      }
                    >
                      {sections.map((section) => (
                        <option
                          key={section.id}
                          value={section.id}
                          disabled={section.id !== sectionId && ids.includes(section.id)}
                        >
                          {section.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="admin-home-layout-row-actions">
                    <button
                      type="button"
                      className="admin-text-button is-danger"
                      disabled={busy}
                      onClick={() => updatePlacement(placement, removeItem(ids, index))}
                    >
                      移除
                    </button>
                  </div>
                  {selected ? (
                    <small className="admin-home-layout-route">
                      /sections/{selected.slug}/
                    </small>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="admin-home-layout-empty">
            未固定分区，将按已发布内容自动生成。
          </div>
        )}

        <button
          type="button"
          className="secondary-button admin-home-layout-add"
          disabled={busy || !canAdd}
          onClick={() => addPlacement(placement)}
        >
          {addLabel}
        </button>
      </div>
    );
  }

  const shortcutPanel = renderPlacement(
    'shortcutSectionIds',
    '快捷分区',
    '最多手动固定 7 个。拖拽卡片调整顺序；未选择时按当前已发布分区自动生成。',
    '添加快捷分区',
  );
  const recommendationPanel = renderPlacement(
    'recommendationSectionIds',
    '推荐分区',
    '可按需要添加多个。拖拽卡片调整顺序；未选择时自动从已发布且标记“首页推荐”的产品推导分区。',
    '添加推荐分区',
  );

  return (
    <section
      className="admin-settings-section home-layout-settings-section"
      aria-label={
        placement === 'shortcutSectionIds'
          ? '快捷分区设置'
          : placement === 'recommendationSectionIds'
            ? '推荐分区设置'
            : '首页布局设置'
      }
    >
      <div className={`admin-home-layout-grid${placement ? ' is-single-panel' : ''}`}>
        {placement === 'recommendationSectionIds' ? recommendationPanel : shortcutPanel}
        {placement ? null : recommendationPanel}
      </div>
    </section>
  );
}
