import { useState } from 'react';
import { MediaPickerDialog } from './asset-library/MediaPickerDialog';
import { brandingAssetPreviewUrl } from './branding-media/api';
import type { SiteHeroSlide } from './site-hero-settings-api';
import './site-hero-settings.css';

type SiteHeroSettingsSectionProps = {
  slides: SiteHeroSlide[];
  busy: boolean;
  onChange: (slides: SiteHeroSlide[]) => void;
  onSessionExpired: () => void;
};

type PickerTarget = { mode: 'add' } | { mode: 'replace'; index: number } | null;

function normalizeSortOrder(slides: SiteHeroSlide[]): SiteHeroSlide[] {
  return slides.map((slide, index) => ({ ...slide, sortOrder: index }));
}

function mediaLabel(kind: SiteHeroSlide['mediaKind']): string {
  if (kind === 'video') return '视频';
  if (kind === 'animated_image') return 'GIF';
  return '图片';
}

function updateSlide(
  slides: SiteHeroSlide[],
  index: number,
  patch: Partial<SiteHeroSlide>,
): SiteHeroSlide[] {
  return slides.map((slide, slideIndex) => slideIndex === index ? { ...slide, ...patch } : slide);
}

export function SiteHeroSettingsSection({
  slides,
  busy,
  onChange,
  onSessionExpired,
}: SiteHeroSettingsSectionProps) {
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null);

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= slides.length) return;
    const next = [...slides];
    const current = next[index];
    const replacement = next[target];
    if (!current || !replacement) return;
    next[index] = replacement;
    next[target] = current;
    onChange(normalizeSortOrder(next));
  }

  function remove(index: number) {
    onChange(normalizeSortOrder(slides.filter((_, slideIndex) => slideIndex !== index)));
  }

  return (
    <section className="admin-settings-section hero-settings-section" aria-labelledby="settings-hero-title">
      <div className="hero-settings-heading">
        <div>
          <h2 id="settings-hero-title">Hero 区域</h2>
          <p>可配置多个图片、GIF 或视频。没有配置素材时，用户前端不会显示 Hero。</p>
        </div>
        <button
          className="secondary-button"
          type="button"
          disabled={busy || slides.length >= 10}
          onClick={() => setPickerTarget({ mode: 'add' })}
        >
          添加 Hero 素材
        </button>
      </div>

      {slides.length === 0 ? (
        <div className="hero-settings-empty">
          <strong>未配置 Hero</strong>
          <span>前端首页将直接从其他内容开始，不会保留 Hero 空白区域。</span>
        </div>
      ) : (
        <div className="hero-slide-list">
          {slides.map((slide, index) => {
            const previewUrl = brandingAssetPreviewUrl(slide.mediaAssetId);
            return (
              <article className="hero-slide-card" key={slide.id}>
                <div className="hero-slide-preview">
                  {slide.mediaKind === 'video' ? (
                    <video src={previewUrl} muted playsInline preload="metadata" />
                  ) : (
                    <img src={previewUrl} alt="" />
                  )}
                  <span>{index + 1}</span>
                  <em>{mediaLabel(slide.mediaKind)}</em>
                </div>

                <div className="hero-slide-fields">
                  <label className="field-group">
                    <span>标题（可选）</span>
                    <input
                      type="text"
                      value={slide.title ?? ''}
                      maxLength={120}
                      disabled={busy}
                      onChange={(event) => onChange(updateSlide(slides, index, {
                        title: event.target.value || null,
                      }))}
                    />
                  </label>

                  <label className="field-group hero-slide-description">
                    <span>描述（可选）</span>
                    <textarea
                      value={slide.description ?? ''}
                      maxLength={500}
                      rows={2}
                      disabled={busy}
                      onChange={(event) => onChange(updateSlide(slides, index, {
                        description: event.target.value || null,
                      }))}
                    />
                  </label>

                  <label className="field-group">
                    <span>按钮文案（可选）</span>
                    <input
                      type="text"
                      value={slide.ctaLabel ?? ''}
                      maxLength={80}
                      disabled={busy}
                      onChange={(event) => onChange(updateSlide(slides, index, {
                        ctaLabel: event.target.value || null,
                      }))}
                    />
                  </label>

                  <label className="field-group">
                    <span>按钮跳转（可选）</span>
                    <input
                      type="text"
                      value={slide.ctaHref ?? ''}
                      maxLength={500}
                      placeholder="/products/... 或 https://..."
                      disabled={busy}
                      onChange={(event) => onChange(updateSlide(slides, index, {
                        ctaHref: event.target.value || null,
                      }))}
                    />
                  </label>
                </div>

                <div className="hero-slide-actions">
                  <button type="button" className="admin-text-button" disabled={busy} onClick={() => setPickerTarget({ mode: 'replace', index })}>
                    更换素材
                  </button>
                  <button type="button" className="admin-text-button" disabled={busy || index === 0} onClick={() => move(index, -1)}>
                    上移
                  </button>
                  <button type="button" className="admin-text-button" disabled={busy || index === slides.length - 1} onClick={() => move(index, 1)}>
                    下移
                  </button>
                  <button type="button" className="admin-text-button is-danger" disabled={busy} onClick={() => remove(index)}>
                    移除
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <p className="hero-settings-note">
        1 个素材静态展示；2 个及以上由前端自动轮播，并支持触摸、触控板和按钮手动切换。CTA 文案与地址需同时填写。
      </p>

      {pickerTarget ? (
        <MediaPickerDialog
          title={pickerTarget.mode === 'add' ? '添加 Hero 素材' : '更换 Hero 素材'}
          role="hero"
          allowedKinds={['image', 'animated_image', 'video']}
          selectedIds={slides
            .filter((_, index) => pickerTarget.mode === 'add' || index !== pickerTarget.index)
            .map((slide) => slide.mediaAssetId)}
          onSessionExpired={onSessionExpired}
          onClose={() => setPickerTarget(null)}
          onSelect={(asset) => {
            if (pickerTarget.mode === 'add') {
              onChange([
                ...slides,
                {
                  id: crypto.randomUUID(),
                  mediaAssetId: asset.id,
                  mediaKind: asset.mediaKind,
                  mediaUrl: asset.publicUrl,
                  title: null,
                  description: null,
                  ctaLabel: null,
                  ctaHref: null,
                  sortOrder: slides.length,
                },
              ]);
            } else {
              onChange(updateSlide(slides, pickerTarget.index, {
                mediaAssetId: asset.id,
                mediaKind: asset.mediaKind,
                mediaUrl: asset.publicUrl,
              }));
            }
            setPickerTarget(null);
          }}
        />
      ) : null}
    </section>
  );
}
