import { ArrowDown, ArrowUp, Image as ImageIcon, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AdminView } from '../../admin-navigation';
import { useAdminDirtySource } from '../../admin-unsaved-state';
import { MediaPickerDialog } from '../../asset-library/MediaPickerDialog';
import { brandingAssetPreviewUrl } from '../../branding-media/api';
import { Button } from '../../components/ui/button';
import { AdminDialog } from '../../components/ui/dialog';
import { AdminFeedbackState } from '../../components/ui/feedback-state';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import {
  fetchMessageCardOptions,
  fetchMessageArticlePlacements,
  saveMessageArticlePlacements,
  type MessageCardOptions,
} from './api';
import {
  draftsEqual,
  moveDraftArticle,
  removeDraftArticle,
  type MessageArticleDraft,
} from './draft';
import './messages-articles.css';

const emptyCard = (options: MessageCardOptions): MessageArticleDraft => ({
  id: crypto.randomUUID(),
  title: '',
  backgroundMediaId: null,
  targetKind: 'article',
  targetRef: options.articles[0]?.id ?? '',
  targetLabel: options.articles[0]?.title ?? '',
  sectionId: null,
  conversionGroupId: null,
  sortOrder: 0,
});

function targetLabel(card: MessageArticleDraft) {
  return card.targetKind === 'article'
    ? '文章'
    : card.targetKind === 'page'
      ? 'H5 页面'
      : '外部链接';
}

function CardEditor({
  options,
  card,
  onChange,
  onClose,
  onSessionExpired,
}: {
  options: MessageCardOptions;
  card: MessageArticleDraft;
  onChange: (card: MessageArticleDraft) => void;
  onClose: () => void;
  onSessionExpired: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const targets =
    card.targetKind === 'article'
      ? options.articles
      : card.targetKind === 'page'
        ? options.pages
        : [];
  return (
    <>
      <AdminDialog
        open
        title="配置 Message CTA"
        eyebrow="会话列表卡片"
        description="卡片标题独立于文章标题，本质上是一个 CTA。"
        size="large"
        onClose={onClose}
        footer={<Button onClick={onClose}>完成</Button>}
      >
        <div className="messages-card-editor">
          <label className="messages-card-field">
            <span>卡片标题（行动号召）</span>
            <Input
              value={card.title}
              maxLength={300}
              placeholder="例如：立即了解活动详情"
              onChange={(event) => onChange({ ...card, title: event.target.value })}
            />
          </label>
          <div className="messages-card-editor-grid">
            <label className="messages-card-field">
              <span>跳转类型</span>
              <Select
                value={card.targetKind}
                onChange={(event) =>
                  onChange({
                    ...card,
                    targetKind: event.target.value as MessageArticleDraft['targetKind'],
                    targetRef: '',
                    targetLabel: '',
                    sectionId: null,
                    conversionGroupId: null,
                  })
                }
              >
                <option value="article">文章</option>
                <option value="page" disabled={!options.h5OriginConfigured}>
                  H5 页面{options.h5OriginConfigured ? '' : '（请先配置域名）'}
                </option>
                <option value="link">外部链接</option>
              </Select>
            </label>
            <label className="messages-card-field">
              <span>{card.targetKind === 'link' ? '链接地址' : '目标内容'}</span>
              {card.targetKind === 'link' ? (
                <Input
                  type="url"
                  value={card.targetRef}
                  placeholder="https://example.com"
                  onChange={(event) =>
                    onChange({
                      ...card,
                      targetRef: event.target.value,
                      targetLabel: event.target.value,
                    })
                  }
                />
              ) : (
                <Select
                  value={card.targetRef}
                  onChange={(event) => {
                    const option = targets.find(
                      (item) =>
                        ('slug' in item ? item.url : item.id) === event.target.value,
                    );
                    onChange({
                      ...card,
                      targetRef: event.target.value,
                      targetLabel: option
                        ? 'title' in option
                          ? option.title
                          : option.name
                        : '',
                    });
                  }}
                >
                  <option value="">请选择{targetLabel(card)}</option>
                  {targets.map((item) => (
                    <option key={item.id} value={'slug' in item ? item.url : item.id}>
                      {'title' in item ? item.title : item.name}
                    </option>
                  ))}
                </Select>
              )}
            </label>
          </div>
          <div className="messages-card-editor-grid">
            <label className="messages-card-field">
              <span>转化池（可选）</span>
              <Select
                value={card.conversionGroupId ?? ''}
                onChange={(event) => {
                  const group = options.conversionGroups.find(
                    (item) => item.id === event.target.value,
                  );
                  onChange({
                    ...card,
                    conversionGroupId: group?.id ?? null,
                    sectionId: group?.section_id ?? null,
                  });
                }}
              >
                <option value="">不绑定转化池</option>
                {options.conversionGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.section_name} / {group.name}
                  </option>
                ))}
              </Select>
            </label>
            <div className="messages-card-field">
              <span>卡片背景图</span>
              <div className="messages-card-background-control">
                <div className="messages-card-background-thumb">
                  {card.backgroundMediaId ? (
                    <img src={brandingAssetPreviewUrl(card.backgroundMediaId)} alt="" />
                  ) : (
                    <ImageIcon aria-hidden="true" size={18} />
                  )}
                </div>
                <Button
                  variant="secondary"
                  size="compact"
                  onClick={() => setPickerOpen(true)}
                >
                  {card.backgroundMediaId ? '更换背景图' : '从素材库选择'}
                </Button>
                {card.backgroundMediaId ? (
                  <Button
                    variant="ghost"
                    size="compact"
                    onClick={() => onChange({ ...card, backgroundMediaId: null })}
                  >
                    清除
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </AdminDialog>
      {pickerOpen ? (
        <MediaPickerDialog
          title="选择卡片背景图"
          selectionMode="reference-only"
          allowedKinds={['image']}
          currentAssetId={card.backgroundMediaId}
          onClose={() => setPickerOpen(false)}
          onSessionExpired={onSessionExpired}
          onSelect={(asset) => {
            onChange({ ...card, backgroundMediaId: asset.id });
            setPickerOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

export function MessagesArticlesSection({
  onNavigate,
  onActionsChange,
  onSessionExpired,
}: {
  onNavigate: (view: AdminView) => void;
  onActionsChange: (actions: ReactNode | null) => void;
  onSessionExpired: () => void;
}) {
  const [options, setOptions] = useState<MessageCardOptions | null>(null);
  const [serverDraft, setServerDraft] = useState<MessageArticleDraft[]>([]);
  const [draft, setDraft] = useState<MessageArticleDraft[]>([]);
  const [editing, setEditing] = useState<MessageArticleDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dirty = !draftsEqual(draft, serverDraft);
  useAdminDirtySource('messages-articles', 'Messages CTA 卡片', dirty);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [nextOptions, cards] = await Promise.all([
        fetchMessageCardOptions(),
        fetchMessageArticlePlacements(),
      ]);
      setOptions(nextOptions);
      setServerDraft(cards);
      setDraft(cards);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Message 卡片配置加载失败。');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const canAdd = Boolean(options);
  const updateCard = (card: MessageArticleDraft) =>
    setDraft((current) => current.map((item) => (item.id === card.id ? card : item)));
  const save = useCallback(async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      const cards = await saveMessageArticlePlacements(draft);
      setServerDraft(cards);
      setDraft(cards);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '保存失败。');
    } finally {
      setSaving(false);
    }
  }, [dirty, draft, saving]);
  useEffect(() => {
    onActionsChange(
      <div className="messages-articles-global-actions">
        <Button variant="secondary" size="compact" onClick={() => onNavigate('faq')}>
          打开文章中心
        </Button>
        <Button
          size="compact"
          onClick={() =>
            options && setDraft((current) => [...current, emptyCard(options)])
          }
          disabled={!canAdd}
        >
          {' '}
          <Plus size={15} /> 添加 CTA 卡片
        </Button>
        <Button
          size="compact"
          loading={saving}
          disabled={!dirty}
          onClick={() => void save()}
        >
          {saving ? '保存中' : '保存配置'}
        </Button>
      </div>,
    );
    return () => onActionsChange(null);
  }, [canAdd, dirty, onActionsChange, onNavigate, options, save, saving]);
  const sorted = useMemo(() => draft, [draft]);
  return (
    <section
      className="settings-workspace-section messages-articles-workspace"
      aria-labelledby="messages-article-title"
    >
      <div className="settings-workspace-heading messages-articles-heading">
        <div>
          <h2 id="messages-article-title">会话列表 CTA 卡片</h2>
        </div>
      </div>
      {error ? (
        <AdminFeedbackState
          kind="error"
          title="加载失败"
          description={error}
          action={<Button onClick={() => void load()}>重试</Button>}
        />
      ) : loading ? (
        <AdminFeedbackState kind="loading" title="正在读取 Message 卡片" />
      ) : sorted.length === 0 ? (
        <AdminFeedbackState kind="empty" title="尚未配置 CTA 卡片" />
      ) : (
        <div className="messages-articles-list">
          {sorted.map((card, index) => (
            <div className="messages-articles-row" key={card.id}>
              <div className="messages-articles-article">
                <strong>{card.title || '未命名 CTA'}</strong>
                <small>
                  {targetLabel(card)}：{card.targetLabel || card.targetRef}
                </small>
              </div>
              <div className="messages-articles-background">
                <div className="messages-articles-thumb">
                  {card.backgroundMediaId ? (
                    <img src={brandingAssetPreviewUrl(card.backgroundMediaId)} alt="" />
                  ) : (
                    <ImageIcon size={18} />
                  )}
                </div>
              </div>
              <div className="messages-articles-order">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="上移"
                  disabled={index === 0}
                  onClick={() => setDraft(moveDraftArticle(draft, card.id, -1))}
                >
                  <ArrowUp size={16} />
                </Button>
                <span>{index + 1}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="下移"
                  disabled={index === sorted.length - 1}
                  onClick={() => setDraft(moveDraftArticle(draft, card.id, 1))}
                >
                  <ArrowDown size={16} />
                </Button>
              </div>
              <div className="messages-articles-actions">
                <Button
                  variant="secondary"
                  size="compact"
                  onClick={() => setEditing(card)}
                >
                  设置
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="删除卡片"
                  onClick={() => setDraft(removeDraftArticle(draft, card.id))}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {editing && options ? (
        <CardEditor
          options={options}
          card={editing}
          onChange={(card) => {
            updateCard(card);
            setEditing(card);
          }}
          onClose={() => setEditing(null)}
          onSessionExpired={onSessionExpired}
        />
      ) : null}
    </section>
  );
}
