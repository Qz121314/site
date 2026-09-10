import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Copy, ExternalLink, FilePlus2, Globe2, WandSparkles } from 'lucide-react';
import type { AdminSection } from './api';
import { Button } from './components/ui/button';
import { AdminDialog } from './components/ui/dialog';
import { AdminFeedbackState } from './components/ui/feedback-state';
import { Input } from './components/ui/input';
import { Select } from './components/ui/select';
import { AdminStatusBadge } from './components/ui/status-badge';
import { fetchConversionGroups, type AdminConversionGroup } from './conversion-pool/api';
import {
  deleteH5Page,
  fetchH5Pages,
  fetchH5Page,
  publishH5Page,
  saveH5CtaBindings,
  fetchH5PublicSettings,
  saveH5PublicSettings,
  updateH5PageName,
  uploadH5Page,
  type H5Page,
} from './page-center/api';
import { parseH5Package, type ParsedH5Package } from './page-center/h5-package';
import { adminConfirm } from './admin-dialog-service';
import './page-center/page-center.css';

type Props = { sections: AdminSection[]; onSessionExpired: () => void };
type UploadedCta = {
  id: string;
  key: string;
  label: string;
  sectionId: string;
  conversionGroupId: string;
};

function publicSiteOrigin(): string {
  if (
    typeof window !== 'undefined' &&
    window.location.hostname === 'localhost' &&
    window.location.port === '5174'
  ) {
    return `${window.location.protocol}//${window.location.hostname}:5173`;
  }
  return window.location.origin;
}

export function PageCenterView({ sections, onSessionExpired }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pages, setPages] = useState<H5Page[]>([]);
  const [groups, setGroups] = useState<AdminConversionGroup[]>([]);
  const [h5PublicOrigin, setH5PublicOrigin] = useState<string | null>(null);
  const [domainDialogOpen, setDomainDialogOpen] = useState(false);
  const [domainDraft, setDomainDraft] = useState('');
  const [parsed, setParsed] = useState<ParsedH5Package | null>(null);
  const [uploaded, setUploaded] = useState<{
    id: string;
    versionId: string;
    name: string;
    ctas: UploadedCta[];
  } | null>(null);
  const [configurationOpen, setConfigurationOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextPages, nextGroups, nextH5Settings] = await Promise.all([
        fetchH5Pages(),
        Promise.all(sections.map((section) => fetchConversionGroups(section.id))).then(
          (items) => items.flat(),
        ),
        fetchH5PublicSettings(),
      ]);
      setPages(nextPages);
      setGroups(nextGroups);
      setH5PublicOrigin(nextH5Settings.publicOrigin);
    } catch (error) {
      if ((error as { status?: number }).status === 401) onSessionExpired();
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : '页面中心加载失败。',
      });
    } finally {
      setLoading(false);
    }
  }, [onSessionExpired, sections]);

  async function handleSaveDomain() {
    setBusy(true);
    setFeedback(null);
    try {
      const settings = await saveH5PublicSettings(domainDraft.trim());
      setH5PublicOrigin(settings.publicOrigin);
      setDomainDialogOpen(false);
      await load();
      setFeedback({ type: 'success', message: 'H5 公共域名已保存。' });
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'H5 公共域名保存失败。',
      });
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, [load]);

  const availableGroups = useMemo(
    () =>
      groups.filter(
        (group) =>
          group.mode === 'link' && group.isEnabled && group.activeTargetCount > 0,
      ),
    [groups],
  );

  async function handleFile(file: File) {
    setFeedback(null);
    setBusy(true);
    try {
      setParsed(await parseH5Package(file));
      setUploaded(null);
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : '无法读取页面包。',
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleConfigure(page: H5Page) {
    setBusy(true);
    setFeedback(null);
    try {
      const detail = await fetchH5Page(page.id);
      setUploaded({
        id: detail.id,
        versionId: detail.versionId,
        name: detail.name,
        ctas: detail.ctas.map((cta) => ({
          id: cta.id,
          key: cta.key,
          label: cta.label,
          sectionId: cta.sectionId ?? '',
          conversionGroupId: cta.conversionGroupId ?? '',
        })),
      });
      setConfigurationOpen(true);
      setParsed(null);
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : '页面配置加载失败。',
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleCopyLink(page: H5Page) {
    const link = new URL(page.publicUrl, publicSiteOrigin()).toString();
    try {
      await navigator.clipboard.writeText(link);
      setFeedback({ type: 'success', message: '页面链接已复制。' });
    } catch {
      setFeedback({ type: 'error', message: '复制失败，请手动复制页面链接。' });
    }
  }

  async function handleDelete(page: H5Page) {
    const confirmed = await adminConfirm({
      eyebrow: '删除页面',
      title: `永久删除“${page.name}”？`,
      message:
        '页面、所有版本、CTA 配置，以及 HTML、CSS、JS、图片等文件都会被永久清理，公开链接也会立即失效。此操作不可恢复。',
      confirmLabel: '永久删除',
      cancelLabel: '取消',
      danger: true,
    });
    if (!confirmed) return;

    setBusy(true);
    setFeedback(null);
    try {
      await deleteH5Page(page.id);
      if (uploaded?.id === page.id) {
        setUploaded(null);
        setParsed(null);
      }
      await load();
      setFeedback({ type: 'success', message: '页面及其全部文件已永久删除。' });
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : '页面删除失败。',
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleUpload() {
    if (!parsed) return;
    setBusy(true);
    setFeedback(null);
    try {
      const formData = new FormData();
      formData.set(
        'manifest',
        JSON.stringify({
          name: parsed.name,
          slug: parsed.slug,
          files: parsed.files.map((file) => ({
            path: file.path,
            mimeType: file.mimeType,
            byteSize: file.byteSize,
          })),
          ctas: parsed.ctas,
        }),
      );
      parsed.files.forEach((file) => formData.append('files', file.file, file.path));
      const result = await uploadH5Page(formData);
      setUploaded({
        id: result.id,
        versionId: result.versionId,
        name: parsed.name,
        ctas: result.ctas.map((cta) => ({
          ...cta,
          sectionId: '',
          conversionGroupId: '',
        })),
      });
      setConfigurationOpen(true);
      setFeedback({
        type: 'success',
        message: '页面已上传，请为识别到的 CTA 绑定转化池。',
      });
      await load();
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : '页面上传失败。',
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveSettings() {
    if (!uploaded) return;
    const name = uploaded.name.trim();
    if (!name) {
      setFeedback({ type: 'error', message: '页面名称不能为空。' });
      return;
    }
    if (uploaded.ctas.some((cta) => !cta.label.trim())) {
      setFeedback({
        type: 'error',
        message: '请填写每个 CTA 的行动号召。',
      });
      return;
    }
    setBusy(true);
    try {
      await updateH5PageName(uploaded.id, name);
      await saveH5CtaBindings(
        uploaded.id,
        uploaded.versionId,
        uploaded.ctas.map(({ id, label, sectionId, conversionGroupId }) => ({
          ctaId: id,
          label: label.trim(),
          sectionId: sectionId || null,
          conversionGroupId: conversionGroupId || null,
        })),
      );
      await publishH5Page(uploaded.id);
      setFeedback({ type: 'success', message: '页面设置已保存。' });
      await load();
      closeConfiguration();
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'CTA 绑定保存失败。',
      });
    } finally {
      setBusy(false);
    }
  }

  function closeConfiguration() {
    setConfigurationOpen(false);
    setUploaded(null);
    setParsed(null);
  }

  return (
    <section className="page-center">
      <div className="page-center__container">
        <input
          ref={inputRef}
          hidden
          type="file"
          accept=".html,.htm,.zip,text/html,application/zip"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
            event.currentTarget.value = '';
          }}
        />
        <div className="page-center__content-toolbar">
          <Button
            variant="secondary"
            size="compact"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            <FilePlus2 size={15} />
            上传 H5 页面
          </Button>
          <Button
            variant="ghost"
            size="compact"
            onClick={() => {
              setDomainDraft(h5PublicOrigin ?? '');
              setDomainDialogOpen(true);
            }}
            disabled={busy}
          >
            <Globe2 size={15} />
            {h5PublicOrigin ? '修改域名' : '添加域名'}
          </Button>
          <span>数量：{pages.length}</span>
        </div>
        {feedback && !uploaded ? (
          <AdminFeedbackState
            kind={feedback.type === 'success' ? 'empty' : 'error'}
            title={feedback.message}
            compact
          />
        ) : null}
        {parsed && !uploaded ? (
          <section className="page-center__panel">
            <div className="page-center__panel-title">
              <WandSparkles size={18} />
              <strong>页面包检查结果</strong>
              <span>
                {parsed.files.length} 个文件 · {parsed.ctas.length} 个 CTA
              </span>
            </div>
            <div className="page-center__upload-meta">
              <label className="page-center__header-name">
                页面名称
                <Input
                  value={parsed.name}
                  onChange={(event) => setParsed({ ...parsed, name: event.target.value })}
                />
              </label>
              <label>
                页面标识
                <Input
                  value={parsed.slug}
                  onChange={(event) => setParsed({ ...parsed, slug: event.target.value })}
                />
              </label>
            </div>
            <div className="page-center__actions">
              <Button variant="secondary" onClick={() => setParsed(null)}>
                取消
              </Button>
              <Button onClick={() => void handleUpload()} loading={busy}>
                确认上传
              </Button>
            </div>
          </section>
        ) : null}
        <AdminDialog
          open={domainDialogOpen}
          title="添加 H5 域名"
          description="保存后，页面中心会使用这个域名生成公开 H5 链接。"
          onClose={() => setDomainDialogOpen(false)}
          closeDisabled={busy}
          size="small"
          footer={
            <>
              <Button variant="secondary" onClick={() => setDomainDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={() => void handleSaveDomain()} loading={busy}>
                保存域名
              </Button>
            </>
          }
        >
          <label className="page-center__domain-field">
            H5 公共域名
            <Input
              value={domainDraft}
              onChange={(event) => setDomainDraft(event.target.value)}
              placeholder="https://pages.example.com"
              autoFocus
            />
          </label>
        </AdminDialog>
        <AdminDialog
          open={Boolean(uploaded && configurationOpen)}
          title=""
          ariaLabel="页面配置"
          showHeading={false}
          onClose={closeConfiguration}
          closeDisabled={busy}
          size="medium"
          className="page-center__config-dialog"
          headerLeading={
            <label className="page-center__header-name">
              页面名称
              <Input
                value={uploaded?.name ?? ''}
                onChange={(event) =>
                  uploaded
                    ? setUploaded({ ...uploaded, name: event.target.value })
                    : undefined
                }
                maxLength={120}
              />
            </label>
          }
          headerActions={
            <Button
              variant="secondary"
              size="compact"
              onClick={() => void handleSaveSettings()}
              loading={busy}
            >
              保存设置
            </Button>
          }
        >
          {feedback ? (
            <AdminFeedbackState
              kind={feedback.type === 'success' ? 'empty' : 'error'}
              title={feedback.message}
              compact
            />
          ) : null}
          {uploaded ? (
            <div className="page-center__config-content">
              {uploaded.ctas.length ? (
                uploaded.ctas.map((cta, index) => (
                  <div className="page-center__cta" key={cta.id}>
                    <span className="page-center__cta-key">CTA：{cta.key}</span>
                    <Input
                      value={cta.label}
                      onChange={(event) =>
                        setUploaded({
                          ...uploaded,
                          ctas: uploaded.ctas.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, label: event.target.value }
                              : item,
                          ),
                        })
                      }
                      aria-label={`${cta.key} 行动号召`}
                    />
                    <Select
                      value={cta.conversionGroupId}
                      onChange={(event) => {
                        const group = availableGroups.find(
                          (item) => item.id === event.target.value,
                        );
                        setUploaded({
                          ...uploaded,
                          ctas: uploaded.ctas.map((item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  sectionId: group?.sectionId ?? '',
                                  conversionGroupId: group?.id ?? '',
                                }
                              : item,
                          ),
                        });
                      }}
                    >
                      <option value="">选择转化池</option>
                      {sections.map((section) => {
                        const sectionGroups = availableGroups.filter(
                          (group) => group.sectionId === section.id,
                        );
                        if (!sectionGroups.length) return null;
                        return (
                          <optgroup label={section.name} key={section.id}>
                            {sectionGroups.map((group) => (
                              <option value={group.id} key={group.id}>
                                {group.name}
                              </option>
                            ))}
                          </optgroup>
                        );
                      })}
                    </Select>
                  </div>
                ))
              ) : (
                <p>未识别到 CTA，可以直接发布页面。</p>
              )}
            </div>
          ) : null}
        </AdminDialog>
        <section className="page-center__list-panel">
          {loading ? (
            <p>正在加载…</p>
          ) : pages.length ? (
            <div className="page-center__list">
              {pages.map((page) => (
                <div className="page-center__row" key={page.id}>
                  <div>
                    <strong>{page.name}</strong>
                    <small className="page-center__public-link">
                      {new URL(page.publicUrl, publicSiteOrigin()).toString()}
                    </small>
                    <small>{page.ctaCount} 个 CTA</small>
                  </div>
                  <AdminStatusBadge
                    tone={page.status === 'published' ? 'success' : 'default'}
                  >
                    {page.status === 'published'
                      ? '已发布'
                      : page.status === 'archived'
                        ? '已归档'
                        : '草稿'}
                  </AdminStatusBadge>
                  {page.status === 'published' ? (
                    <Button
                      variant="ghost"
                      size="compact"
                      onClick={() =>
                        window.open(
                          new URL(page.publicUrl, publicSiteOrigin()).toString(),
                          '_blank',
                          'noopener,noreferrer',
                        )
                      }
                    >
                      <ExternalLink size={15} />
                      预览
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="compact"
                    onClick={() => void handleCopyLink(page)}
                  >
                    <Copy size={15} />
                    复制链接
                  </Button>
                  <Button
                    variant="secondary"
                    size="compact"
                    onClick={() => void handleConfigure(page)}
                    disabled={busy}
                  >
                    设置
                  </Button>
                  <Button
                    variant="danger"
                    size="compact"
                    onClick={() => void handleDelete(page)}
                    disabled={busy}
                  >
                    删除
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p>还没有 H5 页面，上传一个外部制作的 .zip 页面包开始使用。</p>
          )}
        </section>
      </div>
    </section>
  );
}
