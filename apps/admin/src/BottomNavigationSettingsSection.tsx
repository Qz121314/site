import { useState } from 'react';
import { MediaPickerDialog } from './asset-library/MediaPickerDialog';
import { brandingAssetPreviewUrl } from './branding-media/api';
import type {
  BottomNavigationIconType,
  BottomNavigationItem,
  BottomNavigationKey,
} from './site-hero-settings-api';

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
  const [pickerKey, setPickerKey] = useState<BottomNavigationKey | null>(null);
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
      className="admin-settings-section"
      aria-labelledby="settings-bottom-navigation-title"
    >
      <div className="admin-settings-section-heading">
        <div>
          <h2 id="settings-bottom-navigation-title">底部导航</h2>
          <p className="admin-settings-section-description">
            路由固定，避免误配置；显示状态、名称和图标可以自由调整。图标支持内置
            Icon、Emoji 和素材图片。
          </p>
        </div>
      </div>

      <div className="admin-bottom-navigation-grid">
        {value.map((item) => (
          <article
            className={`admin-bottom-navigation-card${item.enabled ? '' : ' is-disabled'}`}
            key={item.key}
          >
            <header className="admin-bottom-navigation-card-header">
              <div className="admin-bottom-navigation-preview" aria-hidden="true">
                {iconPreview(item)}
              </div>
              <div className="admin-bottom-navigation-identity">
                <strong>{item.label || item.key}</strong>
                <small>{ROUTE_LABELS[item.key]}</small>
              </div>
              <label className="admin-bottom-navigation-switch">
                <input
                  type="checkbox"
                  checked={item.enabled}
                  disabled={busy}
                  onChange={(event) =>
                    onChange(
                      updateItem(value, item.key, { enabled: event.target.checked }),
                    )
                  }
                />
                <span>{item.enabled ? '显示' : '隐藏'}</span>
              </label>
            </header>

            <div className="admin-bottom-navigation-fields">
              <label className="field-group">
                <span>名称</span>
                <input
                  type="text"
                  lang="en"
                  maxLength={24}
                  value={item.label}
                  disabled={busy}
                  onChange={(event) =>
                    onChange(updateItem(value, item.key, { label: event.target.value }))
                  }
                />
              </label>

              <label className="field-group">
                <span>图标来源</span>
                <select
                  value={item.iconType}
                  disabled={busy}
                  onChange={(event) =>
                    setIconType(item.key, event.target.value as BottomNavigationIconType)
                  }
                >
                  <option value="builtin">内置 Icon</option>
                  <option value="emoji">Emoji</option>
                  <option value="asset">素材图片</option>
                </select>
              </label>

              {item.iconType === 'builtin' ? (
                <label className="field-group admin-bottom-navigation-icon-field">
                  <span>Icon</span>
                  <select
                    value={item.iconValue ?? 'home'}
                    disabled={busy}
                    onChange={(event) =>
                      onChange(
                        updateItem(value, item.key, { iconValue: event.target.value }),
                      )
                    }
                  >
                    {BUILTIN_OPTIONS.map(([value, label]) => (
                      <option value={value} key={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {item.iconType === 'emoji' ? (
                <label className="field-group admin-bottom-navigation-icon-field">
                  <span>Emoji</span>
                  <input
                    type="text"
                    maxLength={16}
                    value={item.iconValue ?? ''}
                    disabled={busy}
                    placeholder="✨"
                    onChange={(event) =>
                      onChange(
                        updateItem(value, item.key, { iconValue: event.target.value }),
                      )
                    }
                  />
                </label>
              ) : null}

              {item.iconType === 'asset' ? (
                <div className="field-group admin-bottom-navigation-icon-field">
                  <span>图片</span>
                  <div className="admin-bottom-navigation-image-actions">
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={busy}
                      onClick={() => setPickerKey(item.key)}
                    >
                      {item.iconAssetId ? '更换图片' : '从素材中心选择'}
                    </button>
                    {item.iconAssetId ? (
                      <button
                        className="admin-text-button"
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          onChange(updateItem(value, item.key, { iconAssetId: null }))
                        }
                      >
                        移除
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </article>
        ))}
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
