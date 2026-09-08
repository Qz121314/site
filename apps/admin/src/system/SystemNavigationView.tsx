import { GripVertical, MoveDown, MoveUp, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import {
  completeOrder,
  defaultAdminNavigationPreferences,
  orderedAdminDomains,
  orderedAdminSecondaryItems,
  type AdminNavigationPreferences,
} from '../admin-navigation-preferences';
import {
  getAdminSecondaryItems,
  type AdminDomain,
  type AdminView,
} from '../admin-navigation';
import type { AdminSection } from '../api';
import { Button } from '../components/ui/button';
import { AdminFormSection } from '../components/ui/form-section';

type SystemNavigationViewProps = {
  sections: AdminSection[];
  value: AdminNavigationPreferences;
  onChange: (value: AdminNavigationPreferences) => void;
};

function move<T>(items: readonly T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length) return [...items];
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}

export function SystemNavigationView({
  sections,
  value,
  onChange,
}: SystemNavigationViewProps) {
  const [dragging, setDragging] = useState<string | null>(null);
  const primary = orderedAdminDomains(value);
  const updatePrimary = (next: AdminDomain[]) => onChange({ ...value, primary: next });
  const updateSecondary = (domain: AdminDomain, next: AdminView[]) =>
    onChange({ ...value, secondary: { ...value.secondary, [domain]: next } });

  return (
    <section
      className="settings-workspace is-medium navigation-preferences"
      aria-label="导航排序"
    >
      <AdminFormSection
        title="导航排序"
        description="拖动条目，或使用上下移动按钮调整后台显示顺序。排序只影响当前管理员浏览器，不会改变路由、权限或功能归属。"
      >
        <div className="navigation-preference-grid">
          <div className="navigation-order-list" role="list" aria-label="一级菜单排序">
            <strong>一级菜单</strong>
            {primary.map((domain, index) => (
              <div
                className="navigation-order-row"
                draggable
                key={domain.id}
                role="listitem"
                onDragEnd={() => setDragging(null)}
                onDragOver={(event) => event.preventDefault()}
                onDragStart={() => setDragging(`primary:${domain.id}`)}
                onDrop={() => {
                  if (dragging?.startsWith('primary:')) {
                    const from = primary.findIndex(
                      (item) => `primary:${item.id}` === dragging,
                    );
                    updatePrimary(
                      move(
                        primary.map((item) => item.id),
                        from,
                        index,
                      ),
                    );
                  }
                }}
              >
                <GripVertical aria-hidden="true" size={16} />
                <span>{domain.label}</span>
                <Button
                  aria-label={`上移${domain.label}`}
                  disabled={index === 0}
                  size="icon"
                  variant="ghost"
                  onClick={() =>
                    updatePrimary(
                      move(
                        primary.map((item) => item.id),
                        index,
                        index - 1,
                      ),
                    )
                  }
                >
                  <MoveUp aria-hidden="true" size={15} />
                </Button>
                <Button
                  aria-label={`下移${domain.label}`}
                  disabled={index === primary.length - 1}
                  size="icon"
                  variant="ghost"
                  onClick={() =>
                    updatePrimary(
                      move(
                        primary.map((item) => item.id),
                        index,
                        index + 1,
                      ),
                    )
                  }
                >
                  <MoveDown aria-hidden="true" size={15} />
                </Button>
              </div>
            ))}
          </div>
          <div className="navigation-secondary-lists">
            <strong>二级菜单</strong>
            {primary.map((domain) => {
              const items = orderedAdminSecondaryItems(domain.id, sections, value);
              const defaults = getAdminSecondaryItems(domain.id, sections).map(
                (item) => item.view,
              );
              return (
                <div className="navigation-secondary-group" key={domain.id}>
                  <span>{domain.label}</span>
                  {items.map((item, index) => (
                    <div
                      className="navigation-order-row is-secondary"
                      draggable
                      key={item.view}
                      onDragEnd={() => setDragging(null)}
                      onDragOver={(event) => event.preventDefault()}
                      onDragStart={() => setDragging(`${domain.id}:${item.view}`)}
                      onDrop={() => {
                        if (dragging?.startsWith(`${domain.id}:`)) {
                          const from = items.findIndex(
                            (candidate) => `${domain.id}:${candidate.view}` === dragging,
                          );
                          updateSecondary(
                            domain.id,
                            move(
                              items.map((candidate) => candidate.view),
                              from,
                              index,
                            ),
                          );
                        }
                      }}
                    >
                      <GripVertical aria-hidden="true" size={15} />
                      <span>{item.label}</span>
                      <Button
                        aria-label={`上移${domain.label}${item.label}`}
                        disabled={index === 0}
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                          updateSecondary(
                            domain.id,
                            move(
                              items.map((candidate) => candidate.view),
                              index,
                              index - 1,
                            ),
                          )
                        }
                      >
                        <MoveUp aria-hidden="true" size={14} />
                      </Button>
                      <Button
                        aria-label={`下移${domain.label}${item.label}`}
                        disabled={index === items.length - 1}
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                          updateSecondary(
                            domain.id,
                            move(
                              items.map((candidate) => candidate.view),
                              index,
                              index + 1,
                            ),
                          )
                        }
                      >
                        <MoveDown aria-hidden="true" size={14} />
                      </Button>
                    </div>
                  ))}
                  {items.length === 0 ? <small>无可排序入口。</small> : null}
                  {items.length > 0 ? (
                    <button
                      className="navigation-order-reset"
                      type="button"
                      onClick={() =>
                        updateSecondary(domain.id, completeOrder([], defaults))
                      }
                    >
                      恢复此组默认顺序
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
        <div className="settings-workspace-actions">
          <Button
            variant="secondary"
            type="button"
            onClick={() => onChange(defaultAdminNavigationPreferences())}
          >
            <RotateCcw aria-hidden="true" size={16} />
            恢复全部默认顺序
          </Button>
        </div>
      </AdminFormSection>
    </section>
  );
}
