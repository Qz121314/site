import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AdminApiError,
  createLanding,
  deleteLanding,
  fetchLandingProductOptions,
  fetchLandings,
  updateLanding,
  type AdminLanding,
  type AdminLandingInput,
  type AdminLandingProductOption,
} from './api';
import { Button } from './components/ui/button';
import { MediaLibraryPickerDialog } from './asset-library/MediaLibraryPickerDialog';
import type { ManagedMediaAsset } from './asset-library/api';

const blank = (productId = ''): AdminLandingInput => ({
  name: '',
  slug: '',
  productId,
  templateKey: 'direct_response',
  chatTemplateKey: 'match_landing',
  headlineOverride: null,
  subheadlineOverride: null,
  heroAssetId: null,
  ctaLabelOverride: null,
  chatWelcomeOverride: null,
  status: 'draft',
});

export function LandingPagesView({ onSessionExpired }: { onSessionExpired: () => void }) {
  const [items, setItems] = useState<AdminLanding[]>([]);
  const [products, setProducts] = useState<AdminLandingProductOption[]>([]);
  const [editing, setEditing] = useState<AdminLanding | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState<AdminLandingInput>(blank());
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const [heroPickerOpen, setHeroPickerOpen] = useState(false);
  const load = useCallback(
    () =>
      Promise.all([fetchLandings(), fetchLandingProductOptions()])
        .then(([landings, options]) => {
          setItems(landings);
          setProducts(options);
        })
        .catch((e: unknown) => {
          if (e instanceof AdminApiError && e.status === 401) onSessionExpired();
          setError(e instanceof Error ? e.message : '落地页加载失败。');
        }),
    [onSessionExpired],
  );
  useEffect(() => {
    void load();
  }, [load]);
  const filtered = useMemo(
    () =>
      items.filter((item) =>
        `${item.name} ${item.slug}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [items, search],
  );
  function open(item?: AdminLanding) {
    setError('');
    setEditing(item ?? null);
    setEditorOpen(true);
    setForm(
      item
        ? {
            name: item.name,
            slug: item.slug,
            productId: item.productId,
            templateKey: item.templateKey,
            chatTemplateKey: item.chatTemplateKey,
            headlineOverride: item.headlineOverride,
            subheadlineOverride: item.subheadlineOverride,
            heroAssetId: item.heroAssetId,
            ctaLabelOverride: item.ctaLabelOverride,
            chatWelcomeOverride: item.chatWelcomeOverride,
            status: item.status,
          }
        : blank(products[0]?.id),
    );
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setWorking(true);
    setError('');
    try {
      const saved = editing
        ? await updateLanding(editing.id, form)
        : await createLanding(form);
      setItems((current) =>
        editing
          ? current.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...current],
      );
      setEditing(null);
      setEditorOpen(false);
    } catch (e) {
      if (e instanceof AdminApiError && e.status === 401) onSessionExpired();
      setError(e instanceof Error ? e.message : '保存失败。');
    } finally {
      setWorking(false);
    }
  }
  async function remove(item: AdminLanding) {
    if (!window.confirm(`确定删除“${item.name}”？`)) return;
    setWorking(true);
    try {
      await deleteLanding(item.id);
      setItems((current) => current.filter((entry) => entry.id !== item.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败。');
    } finally {
      setWorking(false);
    }
  }
  const product = products.find((entry) => entry.id === form.productId);
  return (
    <section className="product-management" aria-labelledby="landing-pages-title">
      <div className="product-management-toolbar">
        <div>
          <span className="dashboard-kicker">运营</span>
          <h2 id="landing-pages-title">广告落地页</h2>
          <p>Landing 配置引用 Product 内容，不复制商品数据。</p>
        </div>
        <Button variant="primary" onClick={() => open()}>
          新增落地页
        </Button>
      </div>
      <div className="product-filter-bar">
        <label className="product-search">
          <span>搜索</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="名称或 slug"
          />
        </label>
      </div>
      {error ? (
        <div className="notice notice-error" role="alert">
          {error}
        </div>
      ) : null}
      {editorOpen ? (
        <form className="product-editor-form" onSubmit={(e) => void save(e)}>
          <label>
            <span>名称</span>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label>
            <span>Slug</span>
            <input
              required
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              placeholder="summer-offer"
            />
          </label>
          <label>
            <span>来源 Product</span>
            <select
              required
              value={form.productId}
              onChange={(e) => setForm({ ...form, productId: e.target.value })}
            >
              {products.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.title} · {entry.sectionName} · {entry.status} ·{' '}
                  {entry.isVisible ? '前端展示' : '前端隐藏'}
                </option>
              ))}
            </select>
          </label>
          {product ? (
            <div className="notice">
              <strong>Product 数据（只读）</strong>：{product.title} · 分区{' '}
              {product.sectionName} · 状态 {product.status} ·{' '}
              {product.isVisible ? 'Storefront 展示' : 'Storefront 隐藏'} · 封面{' '}
              {product.coverAssetId ?? '无'} · 媒体 {product.mediaCount} · 转化池{' '}
              {product.conversionGroupName ?? '未配置'} · CTA{' '}
              {product.buttonLabel ?? '默认'}
            </div>
          ) : null}
          <label>
            <span>页面模板</span>
            <select
              value={form.templateKey}
              onChange={(e) =>
                setForm({
                  ...form,
                  templateKey: e.target.value as AdminLandingInput['templateKey'],
                })
              }
            >
              <option value="direct_response">Direct Response</option>
            </select>
          </label>
          <fieldset>
            <legend>Hero Override</legend>
            <p>
              {form.heroAssetId
                ? `已选择自定义素材：${form.heroAssetId}`
                : '跟随 Product 封面'}
            </p>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setHeroPickerOpen(true)}
            >
              选择自定义 Hero
            </Button>{' '}
            <Button
              type="button"
              variant="ghost"
              onClick={() => setForm({ ...form, heroAssetId: null })}
            >
              跟随 Product 封面
            </Button>{' '}
            {form.heroAssetId ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setForm({ ...form, heroAssetId: null })}
              >
                清除 Override
              </Button>
            ) : null}
          </fieldset>
          <label>
            <span>状态</span>
            <select
              value={form.status}
              onChange={(e) =>
                setForm({
                  ...form,
                  status: e.target.value as AdminLandingInput['status'],
                })
              }
            >
              <option value="draft">草稿</option>
              <option value="published">已发布</option>
              <option value="archived">已归档</option>
            </select>
          </label>
          <label>
            <span>Headline Override</span>
            <input
              value={form.headlineOverride ?? ''}
              onChange={(e) =>
                setForm({ ...form, headlineOverride: e.target.value || null })
              }
            />
          </label>
          <label>
            <span>Subheadline Override</span>
            <textarea
              value={form.subheadlineOverride ?? ''}
              onChange={(e) =>
                setForm({ ...form, subheadlineOverride: e.target.value || null })
              }
            />
          </label>
          <label>
            <span>CTA Label Override</span>
            <input
              value={form.ctaLabelOverride ?? ''}
              onChange={(e) =>
                setForm({ ...form, ctaLabelOverride: e.target.value || null })
              }
            />
          </label>
          <label>
            <span>Chat Welcome Override</span>
            <textarea
              value={form.chatWelcomeOverride ?? ''}
              onChange={(e) =>
                setForm({ ...form, chatWelcomeOverride: e.target.value || null })
              }
            />
          </label>
          <div>
            <Button variant="primary" type="submit" disabled={working}>
              保存
            </Button>{' '}
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setEditing(null);
                setEditorOpen(false);
              }}
            >
              取消
            </Button>
          </div>
        </form>
      ) : (
        <div className="product-table-wrap">
          <table className="product-table">
            <thead>
              <tr>
                <th>名称</th>
                <th>来源产品</th>
                <th>模板</th>
                <th>状态</th>
                <th>URL / slug</th>
                <th>更新时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>
                    {products.find((entry) => entry.id === item.productId)?.title ??
                      item.productId}
                  </td>
                  <td>{item.templateKey}</td>
                  <td>{item.status}</td>
                  <td>/l/{item.slug}/</td>
                  <td>{new Date(item.updatedAt).toLocaleString()}</td>
                  <td>
                    <Button variant="secondary" onClick={() => open(item)}>
                      编辑
                    </Button>{' '}
                    <Button variant="danger" onClick={() => void remove(item)}>
                      删除
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editorOpen && heroPickerOpen ? (
        <MediaLibraryPickerDialog
          title="选择 Landing Hero"
          role="hero"
          allowedKinds={['image']}
          selectedIds={[]}
          maxSelections={1}
          onSessionExpired={onSessionExpired}
          onClose={() => setHeroPickerOpen(false)}
          onDone={() => setHeroPickerOpen(false)}
          onSelect={(asset: ManagedMediaAsset) => {
            setForm({ ...form, heroAssetId: asset.id });
            setHeroPickerOpen(false);
          }}
        />
      ) : null}
    </section>
  );
}
