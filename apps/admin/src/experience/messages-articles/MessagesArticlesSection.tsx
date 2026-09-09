import {
  ArrowDown,
  ArrowUp,
  Check,
  Eye,
  Image as ImageIcon,
  PencilLine,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { AdminView } from '../../admin-navigation';
import { useAdminDirtySource } from '../../admin-unsaved-state';
import { fetchArticles, type AdminArticle } from '../../article-center/api';
import { MediaPickerDialog } from '../../asset-library/MediaPickerDialog';
import { brandingAssetPreviewUrl } from '../../branding-media/api';
import { Button } from '../../components/ui/button';
import { AdminDialog } from '../../components/ui/dialog';
import { AdminFeedbackState } from '../../components/ui/feedback-state';
import { Input } from '../../components/ui/input';
import { AdminStatusBadge } from '../../components/ui/status-badge';
import { fetchMessageArticlePlacements, saveMessageArticlePlacements } from './api';
import {
  addDraftCard,
  draftsEqual,
  moveDraftArticle,
  normalizeDraft,
  removeDraftArticle,
  setDraftBackground,
  type MessageArticleDraft,
} from './draft';

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : 'Messages 文章配置请求失败。';
}

function excerpt(body: string): string {
  const plain = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > 150 ? `${plain.slice(0, 147)}…` : plain;
}

function reloadExpiredAdminSession() {
  window.location.reload();
}

function ArticleStatusBadge({ article }: { article: AdminArticle | undefined }) {
  if (!article) {
    return <AdminStatusBadge tone="warning">文章状态不可用</AdminStatusBadge>;
  }
  return (
    <AdminStatusBadge tone={article.isActive ? 'success' : 'default'}>
      {article.isActive ? '文章已启用' : '文章已停用'}
    </AdminStatusBadge>
  );
}

function AddMessageCardDialog({
  open,
  articles,
  existingIds,
  onClose,
  onAddCard,
  onSessionExpired,
}: {
  open: boolean;
  articles: AdminArticle[];
  existingIds: Set<string>;
  onClose: () => void;
  onAddCard: (articleId: string, backgroundMediaId: string) => void;
  onSessionExpired: () => void;
}) {
  const [query, setQuery] = useState('');
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [selectedBackgroundMediaId, setSelectedBackgroundMediaId] = useState<
    string | null
  >(null);
  const [backgroundPickerOpen, setBackgroundPickerOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setSelectedArticleId(null);
    setSelectedBackgroundMediaId(null);
    setBackgroundPickerOpen(false);
  }, [open]);

  const available = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase('zh-CN');
    return articles.filter((article) => {
      if (existingIds.has(article.id)) return false;
      if (!keyword) return true;
      return `${article.title} ${article.body}`
        .toLocaleLowerCase('zh-CN')
        .includes(keyword);
    });
  }, [articles, existingIds, query]);

  const selectedArticle = articles.find((article) => article.id === selectedArticleId);

  return (
    <>
      <AdminDialog
        open={open}
        title="添加 Messages Articles 卡片"
        eyebrow="Messages Articles"
        description="配置访客端会话列表卡片。一张卡片由背景图和文章内容组成。"
        size="large"
        onClose={onClose}
        footer={
          <>
            <span className="messages-articles-dialog-count">
              {selectedArticle ? '已选择文章' : '请选择文章'}
              <span aria-hidden="true"> · </span>
              {selectedBackgroundMediaId ? '已选择背景图' : '请选择背景图'}
            </span>
            <Button variant="secondary" onClick={onClose}>
              取消
            </Button>
            <Button
              disabled={!selectedArticleId || !selectedBackgroundMediaId}
              onClick={() => {
                if (!selectedArticleId || !selectedBackgroundMediaId) return;
                onAddCard(selectedArticleId, selectedBackgroundMediaId);
                onClose();
              }}
            >
              添加卡片
            </Button>
          </>
        }
      >
        <div className="messages-card-config">
          <section
            className="messages-card-config-panel"
            aria-labelledby="card-background-title"
          >
            <div className="messages-card-config-heading">
              <div>
                <span>STEP 01</span>
                <h4 id="card-background-title">背景图</h4>
              </div>
              <AdminStatusBadge tone={selectedBackgroundMediaId ? 'success' : 'default'}>
                {selectedBackgroundMediaId ? '已选择' : '必选'}
              </AdminStatusBadge>
            </div>
            <div className="messages-card-background-preview">
              {selectedBackgroundMediaId ? (
                <img
                  src={brandingAssetPreviewUrl(selectedBackgroundMediaId)}
                  alt="已选择的卡片背景图"
                />
              ) : (
                <span>
                  <ImageIcon aria-hidden="true" size={22} />
                  从素材库选择背景图
                </span>
              )}
            </div>
            <Button variant="secondary" onClick={() => setBackgroundPickerOpen(true)}>
              <ImageIcon aria-hidden="true" size={15} />
              {selectedBackgroundMediaId ? '更换背景图' : '从素材库选择'}
            </Button>
          </section>

          <section
            className="messages-card-config-panel messages-card-article-picker"
            aria-labelledby="card-article-title"
          >
            <div className="messages-card-config-heading">
              <div>
                <span>STEP 02</span>
                <h4 id="card-article-title">文章内容</h4>
              </div>
              <AdminStatusBadge tone={selectedArticleId ? 'success' : 'default'}>
                {selectedArticleId ? '已选择' : '必选'}
              </AdminStatusBadge>
            </div>
            <div className="messages-articles-search">
              <Search aria-hidden="true" size={16} />
              <Input
                type="search"
                value={query}
                placeholder="搜索文章标题或正文"
                aria-label="搜索文章标题或正文"
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            {available.length > 0 ? (
              <div className="messages-articles-picker-list" role="listbox">
                {available.map((article) => {
                  const isSelected = selectedArticleId === article.id;
                  return (
                    <button
                      key={article.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={`messages-articles-picker-row${isSelected ? ' is-selected' : ''}`}
                      onClick={() => setSelectedArticleId(article.id)}
                    >
                      <span className="messages-articles-picker-check" aria-hidden="true">
                        {isSelected ? <Check size={14} /> : null}
                      </span>
                      <span>
                        <strong>{article.title}</strong>
                        <small>{excerpt(article.body) || '暂无正文摘要'}</small>
                      </span>
                      <AdminStatusBadge
                        tone={article.isActive ? 'success' : 'default'}
                        showIcon={false}
                      >
                        {article.isActive ? '已启用' : '已停用'}
                      </AdminStatusBadge>
                    </button>
                  );
                })}
              </div>
            ) : (
              <AdminFeedbackState
                kind="empty"
                title={query ? '没有匹配文章' : '没有可添加文章'}
                description={
                  query
                    ? '请调整搜索关键词。'
                    : '当前非回收站文章都已加入 Messages，或 Article Center 暂无可用文章。'
                }
                compact
              />
            )}
          </section>
        </div>
      </AdminDialog>

      {backgroundPickerOpen ? (
        <MediaPickerDialog
          title="选择卡片背景图"
          selectionMode="reference-only"
          allowedKinds={['image']}
          currentAssetId={selectedBackgroundMediaId}
          onClose={() => setBackgroundPickerOpen(false)}
          onSessionExpired={onSessionExpired}
          onSelect={(asset) => {
            setSelectedBackgroundMediaId(asset.id);
            setBackgroundPickerOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

function PlacementPreviewDialog({
  open,
  title,
  body,
  backgroundMediaId,
  onClose,
}: {
  open: boolean;
  title: string;
  body: string;
  backgroundMediaId: string | null;
  onClose: () => void;
}) {
  return (
    <AdminDialog
      open={open}
      title="Placement 预览"
      eyebrow="Admin Preview"
      description="用于检查文章层级与背景关系；不代表最终 Storefront Messages 卡片视觉。"
      onClose={onClose}
    >
      <div className="messages-articles-preview">
        <div className="messages-articles-preview-media">
          {backgroundMediaId ? (
            <img src={brandingAssetPreviewUrl(backgroundMediaId)} alt="" />
          ) : (
            <span>
              <ImageIcon aria-hidden="true" size={22} />
              未设置背景
            </span>
          )}
        </div>
        <div className="messages-articles-preview-copy">
          <small>Messages Article</small>
          <strong>{title}</strong>
          <p>{excerpt(body) || '暂无正文摘要。'}</p>
        </div>
      </div>
    </AdminDialog>
  );
}

export function MessagesArticlesSection({
  onNavigate,
}: {
  onNavigate: (view: AdminView) => void;
}) {
  const [articles, setArticles] = useState<AdminArticle[]>([]);
  const [titles, setTitles] = useState<Map<string, string>>(new Map());
  const [serverDraft, setServerDraft] = useState<MessageArticleDraft[]>([]);
  const [draft, setDraft] = useState<MessageArticleDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const [backgroundTarget, setBackgroundTarget] = useState<string | null>(null);
  const [previewTarget, setPreviewTarget] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setLoadError('');
    try {
      const [placements, availableArticles] = await Promise.all([
        fetchMessageArticlePlacements(),
        fetchArticles('active'),
      ]);
      const nextDraft = normalizeDraft(placements);
      setArticles(availableArticles);
      setTitles(
        new Map(placements.map((placement) => [placement.articleId, placement.title])),
      );
      setServerDraft(nextDraft);
      setDraft(nextDraft);
      setSaved(false);
      setSaveError('');
    } catch (error) {
      setLoadError(messageFor(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const articleById = useMemo(
    () => new Map(articles.map((article) => [article.id, article])),
    [articles],
  );
  const existingIds = useMemo(
    () => new Set(draft.map((placement) => placement.articleId)),
    [draft],
  );
  const dirty = !draftsEqual(draft, serverDraft);
  useAdminDirtySource('messages-articles', 'Messages Articles', dirty);

  function updateDraft(next: MessageArticleDraft[]) {
    setDraft(next);
    setSaved(false);
    setSaveError('');
  }

  function addCard(articleId: string, backgroundMediaId: string) {
    const next = addDraftCard(draft, articleId, backgroundMediaId);
    if (next !== draft) updateDraft(next);
  }

  async function save() {
    if (!dirty || saving) return;
    setSaving(true);
    setSaveError('');
    setSaved(false);
    try {
      const placements = await saveMessageArticlePlacements(draft);
      const next = normalizeDraft(placements);
      setTitles((current) => {
        const updated = new Map(current);
        placements.forEach((placement) =>
          updated.set(placement.articleId, placement.title),
        );
        return updated;
      });
      setServerDraft(next);
      setDraft(next);
      setSaved(true);
    } catch (error) {
      setSaveError(messageFor(error));
    } finally {
      setSaving(false);
    }
  }

  const previewArticle = previewTarget ? articleById.get(previewTarget) : undefined;
  const previewPlacement = previewTarget
    ? draft.find((placement) => placement.articleId === previewTarget)
    : undefined;
  const backgroundPlacement = backgroundTarget
    ? draft.find((placement) => placement.articleId === backgroundTarget)
    : undefined;

  return (
    <section
      className="settings-workspace-section messages-articles-workspace"
      aria-labelledby="messages-article-title"
    >
      <div className="settings-workspace-heading messages-articles-heading">
        <div>
          <h2 id="messages-article-title">Messages Articles</h2>
          <p>管理访客端会话列表中的卡片；每张卡片由背景图和文章内容组成。</p>
        </div>
        <div className="messages-articles-toolbar">
          <Button variant="secondary" onClick={() => onNavigate('faq')}>
            <PencilLine aria-hidden="true" size={15} />
            打开文章中心
          </Button>
          <Button onClick={() => setCardOpen(true)} disabled={loading || !!loadError}>
            <Plus aria-hidden="true" size={16} />
            添加卡片
          </Button>
          <Button loading={saving} disabled={!dirty} onClick={() => void save()}>
            {saving ? '保存中' : saveError ? '重试保存' : '保存配置'}
          </Button>
        </div>
      </div>

      <div className="messages-articles-statusline" data-dirty={dirty ? 'true' : 'false'}>
        <strong>
          {dirty ? '有未保存修改' : saved ? '配置已保存' : '当前配置已同步'}
        </strong>
        <span>
          {dirty
            ? '排序、背景、添加或移除只存在于当前草稿，保存后才会生效。'
            : 'placement 是否存在即表示是否展示，不使用额外 enabled 开关。'}
        </span>
        {saveError ? <em role="alert">{saveError}</em> : null}
      </div>

      {loadError ? (
        <AdminFeedbackState
          kind="error"
          title="Messages Articles 加载失败"
          description={loadError}
          action={<Button onClick={() => void load()}>重试</Button>}
        />
      ) : loading ? (
        <AdminFeedbackState kind="loading" title="正在读取 Messages Articles" />
      ) : draft.length === 0 ? (
        <AdminFeedbackState
          kind="empty"
          title="尚未配置 Messages 卡片"
          description="点击右上角“添加卡片”，为访客端会话列表配置背景图和文章内容。"
        />
      ) : (
        <div className="messages-articles-list">
          <div className="messages-articles-list-head" aria-hidden="true">
            <span>文章</span>
            <span>背景</span>
            <span>排序</span>
            <span>操作</span>
          </div>
          {draft.map((placement, index) => {
            const article = articleById.get(placement.articleId);
            const title =
              article?.title || titles.get(placement.articleId) || placement.articleId;
            return (
              <div className="messages-articles-row" key={placement.articleId}>
                <div className="messages-articles-article">
                  <div>
                    <strong>{title}</strong>
                    <ArticleStatusBadge article={article} />
                  </div>
                  <small>
                    {article
                      ? excerpt(article.body) || '暂无正文摘要'
                      : '可保留 placement，但需到文章中心检查文章状态。'}
                  </small>
                </div>

                <div className="messages-articles-background">
                  <div className="messages-articles-thumb">
                    {placement.backgroundMediaId ? (
                      <img
                        src={brandingAssetPreviewUrl(placement.backgroundMediaId)}
                        alt=""
                        loading="lazy"
                      />
                    ) : (
                      <span>
                        <ImageIcon aria-hidden="true" size={18} />
                        无背景
                      </span>
                    )}
                  </div>
                  <div className="messages-articles-background-actions">
                    <Button
                      variant="secondary"
                      size="compact"
                      onClick={() => setBackgroundTarget(placement.articleId)}
                    >
                      {placement.backgroundMediaId ? '更换' : '选择背景'}
                    </Button>
                    {placement.backgroundMediaId ? (
                      <Button
                        variant="ghost"
                        size="compact"
                        onClick={() =>
                          updateDraft(
                            setDraftBackground(draft, placement.articleId, null),
                          )
                        }
                      >
                        清除
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="messages-articles-order" aria-label={`${title} 排序`}>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`上移 ${title}`}
                    disabled={index === 0}
                    onClick={() =>
                      updateDraft(moveDraftArticle(draft, placement.articleId, -1))
                    }
                  >
                    <ArrowUp aria-hidden="true" size={17} />
                  </Button>
                  <span>{index + 1}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`下移 ${title}`}
                    disabled={index === draft.length - 1}
                    onClick={() =>
                      updateDraft(moveDraftArticle(draft, placement.articleId, 1))
                    }
                  >
                    <ArrowDown aria-hidden="true" size={17} />
                  </Button>
                </div>

                <div className="messages-articles-actions">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`预览 ${title}`}
                    onClick={() => setPreviewTarget(placement.articleId)}
                  >
                    <Eye aria-hidden="true" size={17} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`移除 ${title}`}
                    onClick={() =>
                      updateDraft(removeDraftArticle(draft, placement.articleId))
                    }
                  >
                    <Trash2 aria-hidden="true" size={17} />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AddMessageCardDialog
        open={cardOpen}
        articles={articles}
        existingIds={existingIds}
        onClose={() => setCardOpen(false)}
        onAddCard={addCard}
        onSessionExpired={reloadExpiredAdminSession}
      />

      {backgroundTarget !== null ? (
        <MediaPickerDialog
          title="选择卡片背景"
          selectionMode="reference-only"
          allowedKinds={['image']}
          currentAssetId={backgroundPlacement?.backgroundMediaId ?? null}
          onClose={() => setBackgroundTarget(null)}
          onSessionExpired={reloadExpiredAdminSession}
          onSelect={(asset) => {
            updateDraft(setDraftBackground(draft, backgroundTarget, asset.id));
            setBackgroundTarget(null);
          }}
        />
      ) : null}

      <PlacementPreviewDialog
        open={previewTarget !== null}
        title={
          previewArticle?.title ||
          (previewTarget ? titles.get(previewTarget) : undefined) ||
          'Messages Article'
        }
        body={previewArticle?.body || ''}
        backgroundMediaId={previewPlacement?.backgroundMediaId ?? null}
        onClose={() => setPreviewTarget(null)}
      />
    </section>
  );
}
