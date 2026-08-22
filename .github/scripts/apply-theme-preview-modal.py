from pathlib import Path
import re

view_path = Path('apps/admin/src/ThemeCenterView.tsx')
css_path = Path('apps/admin/src/theme-center.css')
test_path = Path('apps/admin/test/theme-center-preview-modal-contract.test.mjs')

view = view_path.read_text()

view = view.replace(
    "} from 'react';\nimport { AdminApiError } from './api';",
    "} from 'react';\nimport { createPortal } from 'react-dom';\nimport { AdminApiError } from './api';",
    1,
)
view = view.replace(
    "  const [successMessage, setSuccessMessage] = useState('');\n",
    "  const [successMessage, setSuccessMessage] = useState('');\n  const [previewOpen, setPreviewOpen] = useState(false);\n",
    1,
)

load_effect = """  useEffect(() => {
  void loadThemeCenter();
}, [loadThemeCenter]);

"""
preview_effect = """  useEffect(() => {
  void loadThemeCenter();
}, [loadThemeCenter]);

useEffect(() => {
  if (!previewOpen) return undefined;

  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') setPreviewOpen(false);
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => {
    document.body.style.overflow = previousOverflow;
    window.removeEventListener('keydown', handleKeyDown);
  };
}, [previewOpen]);

"""
if load_effect not in view:
    raise SystemExit('load effect anchor not found')
view = view.replace(load_effect, preview_effect, 1)

view = view.replace(
    '主题已读取并转换。请先检查右侧移动端预览，再点击“保存并应用”。',
    '主题已读取并转换。请先打开移动端预览检查效果，再点击“保存并应用”。',
)
view = view.replace(
    'JSON 主题已转换。请检查右侧移动端预览，再点击“保存并应用”。',
    'JSON 主题已转换。请打开移动端预览检查效果，再点击“保存并应用”。',
)

action_anchor = """          </div>
          <button
            className="primary-button theme-save-button"
"""
action_replacement = """          </div>
          <button
            className="secondary-button theme-preview-button"
            type="button"
            disabled={!selectedPreset}
            onClick={() => setPreviewOpen(true)}
          >
            移动端预览
          </button>
          <button
            className="primary-button theme-save-button"
"""
if action_anchor not in view:
    raise SystemExit('theme action anchor not found')
view = view.replace(action_anchor, action_replacement, 1)

view = view.replace('<strong>移动端实时预览</strong>', '<strong>主题设置</strong>', 1)
view = view.replace(
    '<span>模拟用户主要访问场景；品牌色可选，留空使用主题原色。</span>',
    '<span>调整品牌色、UI Recipe 和安装提示；预览通过顶部按钮打开。</span>',
    1,
)

device_pattern = re.compile(
    r'\n          \{selectedPreset \? \(\n            <div className="theme-preview-device-shell">.*?\n          \) : null\}\n',
    re.S,
)
device_match = device_pattern.search(view)
if not device_match:
    raise SystemExit('inline preview device block not found')
view = view[:device_match.start()] + '\n' + view[device_match.end():]

modal = r'''
      {previewOpen && selectedPreset
        ? createPortal(
            <div
              className="theme-preview-modal-backdrop"
              onMouseDown={() => setPreviewOpen(false)}
            >
              <section
                className="theme-preview-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="theme-preview-modal-title"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="theme-preview-modal-header">
                  <div>
                    <small>当前草稿主题 · {selectedPreset.label}</small>
                    <strong id="theme-preview-modal-title">移动端实时预览</strong>
                    <span>双列 1:1 · 触控操作 · 底部导航</span>
                  </div>
                  <button
                    type="button"
                    aria-label="关闭移动端预览"
                    autoFocus
                    onClick={() => setPreviewOpen(false)}
                  >
                    ×
                  </button>
                </div>

                <div className="theme-preview-modal-body">
                  <div className="theme-preview-device-shell">
                    <div
                      className="theme-live-preview storefront-ui-preview storefront-theme-root"
                      data-color-scheme={selectedPreset.colorScheme}
                      data-density={recipe.density}
                      data-theme={selectedPreset.key}
                      data-font-pack={recipe.fontPack}
                      data-button-style={recipe.buttonStyle}
                      data-media-style={recipe.mediaStyle}
                      data-motion-style={recipe.motionStyle}
                      data-navigation-style={recipe.navigationStyle}
                      style={storefrontThemeStyle(selectedPreset.tokens, previewAccent)}
                    >
                      <div className="theme-preview-statusbar" aria-hidden="true">
                        <span>9:41</span>
                        <span>● ● ▰</span>
                      </div>
                      <StorefrontBrandBar
                        LinkComponent={PreviewLink}
                        locationLabel="Explore nearby"
                        logo="S"
                        siteName="Service"
                      />
                      <div className="theme-preview-content">
                        <StorefrontHero
                          description="Fast browsing designed for one-hand mobile use."
                          eyebrow={selectedPreset.label}
                          locationLabel="Nearby"
                          title="Discover what fits you"
                        />
                        <div className="theme-preview-section-row">
                          <strong>Featured</strong>
                          <span>See all</span>
                        </div>
                        <div className="theme-preview-products product-grid">
                          {[1, 2].map((item) => (
                            <StorefrontProductCard
                              categoryName="Category"
                              href="#"
                              key={item}
                              LinkComponent={PreviewLink}
                              media={
                                <div className="theme-preview-media image-fallback">
                                  <span>1:1</span>
                                </div>
                              }
                              modeLabel="Online"
                              sectionName="Featured"
                              tags={[{ id: `preview-${item}`, name: 'Popular' }]}
                              title={item === 1 ? 'Product title' : 'Featured item'}
                            />
                          ))}
                        </div>
                      </div>
                      <StorefrontBottomNavigation
                        LinkComponent={PreviewLink}
                        items={[
                          { href: '/', icon: '⌂', label: 'Home' },
                          { href: '/#hot', icon: '◆', label: 'Hot' },
                          { href: '/#latest', icon: '◷', label: 'Latest' },
                          { href: '/#faq', icon: '?', label: 'FAQ' },
                        ]}
                      />
                    </div>
                  </div>
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
'''

tail_anchor = """        </aside>
      </div>
    </section>
  );
}
"""
if tail_anchor not in view:
    raise SystemExit('theme center tail anchor not found')
view = view.replace(
    tail_anchor,
    """        </aside>
      </div>
""" + modal + """    </section>
  );
}
""",
    1,
)
view_path.write_text(view)

css = css_path.read_text()
css = css.replace(
    ".theme-save-button {\n  width: auto;\n  min-width: 106px;\n  white-space: nowrap;\n}\n",
    ".theme-save-button,\n.theme-preview-button {\n  width: auto;\n  min-width: 106px;\n  white-space: nowrap;\n}\n",
    1,
)

modal_css = r'''
.theme-preview-modal-backdrop {
  position: fixed;
  z-index: 1000;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgb(15 23 42 / 58%);
  backdrop-filter: blur(4px);
}

.theme-preview-modal {
  display: grid;
  width: min(100%, 520px);
  max-height: calc(100dvh - 32px);
  grid-template-rows: auto minmax(0, 1fr);
  overflow: hidden;
  border: 1px solid rgb(255 255 255 / 44%);
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 28px 80px rgb(15 23 42 / 34%);
}

.theme-preview-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 13px 14px;
  border-bottom: 1px solid #e1e6ed;
  background: #fff;
}

.theme-preview-modal-header > div {
  display: grid;
  gap: 2px;
}

.theme-preview-modal-header small,
.theme-preview-modal-header span {
  color: #7a8390;
  font-size: 0.62rem;
}

.theme-preview-modal-header strong {
  color: #20293a;
  font-size: 0.82rem;
}

.theme-preview-modal-header button {
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  place-items: center;
  padding: 0;
  border: 1px solid #dfe4eb;
  border-radius: 9px;
  color: #59616d;
  background: #fff;
  cursor: pointer;
  font-size: 1.15rem;
  line-height: 1;
}

.theme-preview-modal-header button:hover {
  color: #20293a;
  background: #f5f6f8;
}

.theme-preview-modal-header button:focus-visible,
.theme-preview-button:focus-visible {
  outline: 3px solid rgb(255 90 31 / 14%);
  outline-offset: 2px;
}

.theme-preview-modal-body {
  min-height: 0;
  overflow: auto;
  padding: 14px;
  background: #f2f4f7;
  overscroll-behavior: contain;
}

.theme-preview-modal-body .theme-preview-device-shell {
  min-height: 100%;
  padding: 0;
  border: 0;
  background: transparent;
}
'''

device_anchor = ".theme-preview-device-shell {\n"
if device_anchor not in css:
    raise SystemExit('preview device css anchor not found')
css = css.replace(device_anchor, modal_css + "\n" + device_anchor, 1)
css_path.write_text(css)

test_path.write_text(r'''import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('theme center mobile preview is a viewport modal instead of an inline device', () => {
  const view = source('../src/ThemeCenterView.tsx');
  const css = source('../src/theme-center.css');

  assert.ok(view.includes("import { createPortal } from 'react-dom';"));
  assert.ok(view.includes('const [previewOpen, setPreviewOpen] = useState(false);'));
  assert.ok(view.includes('className="secondary-button theme-preview-button"'));
  assert.ok(view.includes('aria-modal="true"'));
  assert.ok(view.includes("event.key === 'Escape'"));
  assert.ok(view.includes('onMouseDown={(event) => event.stopPropagation()}'));
  assert.equal(view.match(/className="theme-preview-device-shell"/g)?.length, 1);
  assert.ok(
    view.indexOf('className="theme-preview-device-shell"') >
      view.indexOf('className="theme-preview-modal-backdrop"'),
  );
  assert.match(css, /\.theme-preview-modal-backdrop\s*\{[^}]*position: fixed;/s);
  assert.ok(css.includes('max-height: calc(100dvh - 32px);'));
  assert.ok(css.includes('overscroll-behavior: contain;'));
});
''')
