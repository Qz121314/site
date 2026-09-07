import { useState } from 'react';
import { MediaPickerDialog } from './asset-library/MediaPickerDialog';
import { brandingAssetPreviewUrl } from './branding-media/api';
import type {
  BottomNavigationIconType,
  BottomNavigationItem,
  BottomNavigationKey,
} from './site-hero-settings-api';
import './bottom-navigation-settings.css';

const BUILTIN_OPTIONS = [
  ['home', 'Home'],
  ['compass', 'Compass'],
  ['messages', 'Messages'],
  ['help', 'Help'],
  ['grid', 'Grid'],
  ['search', 'Search'],
  ['star', 'Star'],
  ['heart', 'Heart'],
  ['user', 'User'],
  ['menu', 'Menu'],
  ['bell', 'Bell'],
  ['map', 'Map'],
] as const;

const ROUTE_LABELS: Record<BottomNavigationKey, string> = {
  home: '/',
  browse: '/browse/',
  messages: '/messages/',
  faq: '/faq/',
};

function updateItem(
  items: BottomNavigationItem[],
  key: BottomNavigationKey,
  patch: Partial<BottomNavigationItem>,
): BottomNavigationItem[] {
  return items.map((item) => (item.key === key ? { ...item, ...patch } : item));
}

function iconPreview(item: BottomNavigationItem) {
  if (item.iconType === 'asset' && item.iconAssetId) {
    return <img src={brandingAssetPreviewUrl(item.iconAssetId)} alt="" />;
  }
  if (item.iconType === 'emoji') {
    return <span className="admin-bottom-nav-emoji">{item.iconValue || '🙂'}</span>;
  }
  return <span className="admin-bottom-nav-builtin">{item.iconValue || 'icon'}</span>;
}

export function BottomNavigationSettingsSection({
  value,
  busy,
  onChange,
  onSessionExpired,
}: {
  value: BottomNavigationItem[];
  busy: boolean;
  onChange: (value: BottomNavigationItem[]) => void;
  onSessionExpired: () => void;
}) {
  const [editingKey, setEditingKey] = useState<BottomNavigationKey | null>(null);
  const [pickerKey, setPickerKey] = useState<BottomNavigationKey | null>(null);
  const editingItem = editingKey
    ? (value.find((item) => item.key === editingKey) ?? null)
    : null;
  const pickerItem = pickerKey
    ? (value.find((item) => item.key === pickerKey) ?? null)
    : null;

  function setIconType(key: BottomNavigationKey, iconType: BottomNavigationIconType) {
    const defaults: Record<
      BottomNavigationIconType,
      Pick<BottomNavigationItem, 'iconValue' | 'iconAssetId'>
    > = {
      builtin: {
        iconValue:
          key === 'browse'
            ? 'compass'
            : key === 'messages'
              ? 'messages'
              : key === 'faq'
                ? 'help'
                : 'home',
        iconAssetId: null,
      },
      emoji: { iconValue: '✨', iconAssetId: null },
      asset: { iconValue: null, iconAssetId: null },
    };
    onChange(updateItem(value, key, { iconType, ...defaults[iconType] }));
  }

  return (
    <section
      className="admin-navigation-manager"
      aria-labelledby="bottom-navigation-title"
    >
      <div className="admin-settings-section-heading">
        <div>
          <h2 id="bottom-navigation-title">前台底部导航</h2>
          <p className="admin-settings-section-description">
            路径固定；名称、图标与显示状态可以调整。点击一行打开紧凑编辑区。
          </p>
        </div>
      </div>

      <div className="admin-bottom-navigation-list" role="list" aria-label="底部导航入口">
        {value.map((item) => {
          const expanded = editingKey === item.key;
          return (
            <div
              className="admin-bottom-navigation-row-wrap"
              role="listitem"
              key={item.key}
            >
              <button
                className={`admin-bottom-navigation-row${expanded ? ' is-selected' : ''}`}
                type="button"
                disabled={busy}
                aria-expanded={expanded}
                aria-controls={`bottom-nav-editor-${item.key}`}
                onClick={() => setEditingKey(expanded ? null : item.key)}
              >
                <span
                  className="admin-bottom-navigation-preview"
                  role="img"
                  aria-label={`${item.label || item.key} 图标预览`}
                >
                  {iconPreview(item)}
                </span>
                <span className="admin-bottom-navigation-identity">
                  <strong>{item.label || item.key}</strong>
                  <small>{ROUTE_LABELS[item.key]}</small>
                </span>
                <span className="admin-bottom-navigation-source">
                  {item.iconType === 'builtin'
                    ? '内置 Icon'
                    : item.iconType === 'emoji'
                      ? 'Emoji'
                      : '素材图片'}
                </span>
                <span
                  className={`admin-bottom-navigation-status${item.enabled ? ' is-enabled' : ''}`}
                >
                  {item.enabled ? '显示' : '隐藏'}
                </span>
                <span className="admin-bottom-navigation-row-action">
                  {expanded ? '收起' : '编辑'}
                </span>
              </button>

              {expanded && editingItem ? (
                <div
                  className="admin-bottom-navigation-editor"
                  id={`bottom-nav-editor-${item.key}`}
                  aria-label={`${editingItem.label || editingItem.key} 导航设置`}
                >
                  <label className="field-group">
                    <span>名称</span>
                    <input
                      type="text"
                      maxLength={24}
                      value={editingItem.label}
                      disabled={busy}
                      onChange={(event) =>
                        onChange(
                          updateItem(value, editingItem.key, {
                            label: event.target.value,
                          }),
                        )
                      }
                    />
                  </label>

                  <label className="field-group">
                    <span>图标来源</span>
                    <select
                      value={editingItem.iconType}
                      disabled={busy}
                      onChange={(event) =>
                        setIconType(
                          editingItem.key,
                          event.target.value as BottomNavigationIconType,
                        )
                      }
                    >
                      <option value="builtin">内置 Icon</option>
                      <option value="emoji">Emoji</option>
                      <option value="asset">素材图片</option>
                    </select>
                  </label>

                  {editingItem.iconType === 'builtin' ? (
                    <label className="field-group">
                      <span>Icon</span>
                      <select
                        value={editingItem.iconValue ?? 'home'}
                        disabled={busy}
                        onChange={(event) =>
                          onChange(
                            updateItem(value, editingItem.key, {
                              iconValue: event.target.value,
                            }),
                          )
                        }
                      >
                        {BUILTIN_OPTIONS.map(([optionValue, label]) => (
                          <option value={optionValue} key={optionValue}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  {editingItem.iconType === 'emoji' ? (
                    <label className="field-group">
                      <span>Emoji</span>
                      <input
                        type="text"
                        maxLength={16}
                        value={editingItem.iconValue ?? ''}
                        disabled={busy}
                        placeholder="✨"
                        onChange={(event) =>
                          onChange(
                            updateItem(value, editingItem.key, {
                              iconValue: event.target.value,
                            }),
                          )
                        }
                      />
                    </label>
                  ) : null}

                  {editingItem.iconType === 'asset' ? (
                    <div className="field-group">
                      <span>图片</span>
                      <div className="admin-bottom-navigation-image-actions">
                        <button
                          className="secondary-button"
                          type="button"
                          disabled={busy}
                          onClick={() => setPickerKey(editingItem.key)}
                        >
                          {editingItem.iconAssetId ? '更换图片' : '从素材中心选择'}
                        </button>
                        {editingItem.iconAssetId ? (
                          <button
                            className="admin-text-button"
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              onChange(
                                updateItem(value, editingItem.key, { iconAssetId: null }),
                              )
                            }
                          >
                            移除
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  <label className="admin-bottom-navigation-switch">
                    <input
                      type="checkbox"
                      checked={editingItem.enabled}
                      disabled={busy}
                      onChange={(event) =>
                        onChange(
                          updateItem(value, editingItem.key, {
                            enabled: event.target.checked,
                          }),
                        )
                      }
                    />
                    <span>{editingItem.enabled ? '显示此入口' : '隐藏此入口'}</span>
                  </label>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {pickerKey && pickerItem ? (
        <MediaPickerDialog
          title={`选择 ${pickerItem.label || pickerItem.key} 导航图标`}
          role="icon"
          allowedKinds={['image', 'animated_image']}
          selectedIds={pickerItem.iconAssetId ? [pickerItem.iconAssetId] : []}
          onSessionExpired={onSessionExpired}
          onClose={() => setPickerKey(null)}
          onSelect={(asset) => {
            onChange(
              updateItem(value, pickerKey, {
                iconType: 'asset',
                iconValue: null,
                iconAssetId: asset.id,
              }),
            );
            setPickerKey(null);
          }}
        />
      ) : null}
    </section>
  );
}
