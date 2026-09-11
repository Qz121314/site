import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { AdminDialog } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import type { AdminConversionGroup } from '../conversion-pool/api';
import {
  deleteH5Page,
  publishH5Page,
  saveH5CtaBindings,
  saveH5Product,
  uploadH5Page,
} from '../page-center/api';
import { parseH5Package, type ParsedH5Package } from '../page-center/h5-package';

type H5ProductCreateDialogProps = {
  sectionId: string;
  sectionName: string;
  groups: AdminConversionGroup[];
  onClose: () => void;
  onSaved: () => Promise<void> | void;
};

export function H5ProductCreateDialog({
  sectionId,
  sectionName,
  groups,
  onClose,
  onSaved,
}: H5ProductCreateDialogProps) {
  const [parsed, setParsed] = useState<ParsedH5Package | null>(null);
  const [conversionGroupId, setConversionGroupId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const availableGroups = useMemo(
    () => groups.filter((group) => group.isEnabled && group.activeTargetCount > 0),
    [groups],
  );

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    setErrorMessage('');
    try {
      setParsed(await parseH5Package(file));
    } catch (error) {
      setParsed(null);
      setErrorMessage(error instanceof Error ? error.message : '无法读取 H5 页面包。');
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!parsed) {
      setErrorMessage('请先选择 H5 页面包。');
      return;
    }
    if (!parsed.ctas.length) {
      setErrorMessage('页面包中没有识别到 CTA，无法建立咨询入口。');
      return;
    }
    if (!conversionGroupId) {
      setErrorMessage('请选择产品转化分组。');
      return;
    }

    setSaving(true);
    setErrorMessage('');
    let pageId: string | null = null;
    let published = false;
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

      const uploaded = await uploadH5Page(formData);
      pageId = uploaded.id;
      await saveH5CtaBindings(
        uploaded.id,
        uploaded.versionId,
        uploaded.ctas.map((cta, index) => ({
          ctaId: cta.id,
          label: parsed.ctas[index]?.label.trim() || cta.label,
          sectionId,
          conversionGroupId,
        })),
      );
      await saveH5Product(uploaded.id, sectionId);
      await publishH5Page(uploaded.id);
      published = true;
      await onSaved();
      onClose();
    } catch (error) {
      if (pageId && !published) {
        try {
          await deleteH5Page(pageId);
        } catch {
          // Keep the original error visible; the page can be cleaned up from recovery tools.
        }
      }
      setErrorMessage(error instanceof Error ? error.message : 'H5 商品创建失败。');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminDialog
      open
      title="新增 H5 商品"
      eyebrow={`${sectionName} · 独立页面展示`}
      description="H5 使用独立 UI，但会作为当前分区的普通产品参与客服分流。发布后不出现在主站商品列表，仅通过产品链接访问。"
      onClose={onClose}
      closeDisabled={saving}
      size="medium"
    >
      <form
        className="product-editor-form"
        onSubmit={(event) => void handleSubmit(event)}
      >
        {errorMessage ? (
          <div className="notice notice-error" role="alert">
            {errorMessage}
          </div>
        ) : null}

        <label className="product-field">
          <span>H5 页面包</span>
          <input
            type="file"
            accept=".html,.htm,.zip,text/html,application/zip"
            disabled={saving}
            onChange={(event) => void handleFile(event)}
          />
          <small>支持单页 HTML 或 ZIP 页面包，页面入口必须是 index.html。</small>
        </label>

        {parsed ? (
          <>
            <div className="product-field">
              <span>页面信息</span>
              <div className="product-h5-package-summary">
                <strong>{parsed.name}</strong>
                <small>
                  /{parsed.slug} · {parsed.files.length} 个文件 · {parsed.ctas.length} 个
                  CTA
                </small>
              </div>
            </div>

            <label className="product-field">
              <span>产品转化分组</span>
              <Select
                value={conversionGroupId}
                disabled={saving}
                onChange={(event) => setConversionGroupId(event.target.value)}
              >
                <option value="">选择在线客服或链接分组</option>
                {availableGroups.map((group) => (
                  <option value={group.id} key={group.id}>
                    {group.name} ·{' '}
                    {group.mode === 'customer_service' ? '在线客服' : '外部链接'}
                  </option>
                ))}
              </Select>
            </label>

            <div className="product-field">
              <span>CTA 行动号召</span>
              <div className="product-h5-cta-list">
                {parsed.ctas.map((cta, index) => (
                  <Input
                    key={`${cta.key}-${index}`}
                    value={cta.label}
                    disabled={saving}
                    aria-label={`${cta.key} 行动号召`}
                    onChange={(event) =>
                      setParsed((current) =>
                        current
                          ? {
                              ...current,
                              ctas: current.ctas.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, label: event.target.value }
                                  : item,
                              ),
                            }
                          : current,
                      )
                    }
                  />
                ))}
              </div>
              <small>
                所有 CTA 进入同一个产品转化分组，客服坐席由该分组内部完成分流。
              </small>
            </div>
          </>
        ) : null}

        <div className="admin-dialog-actions">
          <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>
            取消
          </Button>
          <Button type="submit" loading={saving} disabled={!parsed}>
            发布 H5 商品
          </Button>
        </div>
      </form>
    </AdminDialog>
  );
}
