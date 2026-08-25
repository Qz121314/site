import type { AdminSection } from './api';
import type { HomeLayout } from './site-hero-settings-api';

type HomePlacement = 'shortcutSectionIds' | 'recommendationSectionIds';

const LIMITS: Record<HomePlacement, number> = {
  shortcutSectionIds: 7,
  recommendationSectionIds: 3,
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
}: {
  value: HomeLayout;
  sections: AdminSection[];
  busy: boolean;
  onChange: (value: HomeLayout) => void;
}) {
  function updatePlacement(placement: HomePlacement, ids: string[]) {
    onChange({ ...value, [placement]: ids });
  }

  function addPlacement(placement: HomePlacement) {
    const current = value[placement];
    const nextSection = sections.find((section) => !current.includes(section.id));
    if (!nextSection || current.length >= LIMITS[placement]) return;
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
      ids.length < limit && sections.some((section) => !ids.includes(section.id));

    return (
      <div className="admin-home-layout-group">
        <div className="admin-home-layout-heading">
          <div>
            <strong>{title}</strong>
            <p>{description}</p>
          </div>
          <span>
            {ids.length}/{limit}
          </span>
        </div>

        {ids.length > 0 ? (
          <div className="admin-home-layout-list">
            {ids.map((sectionId, index) => {
              const selected = sections.find((section) => section.id === sectionId);
              return (
                <div className="admin-home-layout-row" key={`${placement}:${sectionId}`}>
                  <span className="admin-home-layout-order">{index + 1}</span>
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

  return (
    <section
      className="admin-settings-section"
      aria-labelledby="settings-home-layout-title"
    >
      <div className="admin-settings-section-heading">
        <div>
          <h2 id="settings-home-layout-title">首页布局</h2>
          <p className="admin-settings-section-description">
            Home 固定为
            Logo、Hero、快捷分区、推荐分区产品横滑和底部导航；这里用于固定首页分区及顺序，未选择时会从当前已发布内容自动生成。
          </p>
        </div>
      </div>

      <div className="admin-home-layout-grid">
        {renderPlacement(
          'shortcutSectionIds',
          '快捷分区',
          '最多手动固定 7 个。未选择时按当前已发布分区自动生成；自动入口不超过 8 个时全部展示，超过 8 个时第 8 格显示 More。',
          '添加快捷分区',
        )}
        {renderPlacement(
          'recommendationSectionIds',
          '推荐分区',
          '最多 3 个。未选择时自动从已发布且标记“首页推荐”的产品推导分区；选择后按这里的分区顺序展示。',
          '添加推荐分区',
        )}
      </div>
    </section>
  );
}
