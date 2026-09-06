import { X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { PublishModuleStatus, PublishStatus, PublishVersion } from '../publish-api';
import { Button } from '../components/ui/button';

export type RollbackTarget = {
  moduleKey: string;
  moduleLabel: string;
  version: PublishVersion;
};

type AdminPublishingControlsProps = {
  status: PublishStatus | null;
  statusError: string;
  contextKey: string;
  publishingKey: string | null;
  rollingBack: boolean;
  hasUnsavedChanges: boolean;
  unsavedTitle: string;
  onRefresh: () => void;
  onPublish: (moduleKey: string) => void;
  onRequestRollback: (target: RollbackTarget) => void;
};

function publishStatusLabel(
  status: PublishStatus | null,
  publishing: boolean,
  hasUnsavedChanges: boolean,
  hasError: boolean,
): string {
  if (publishing) return '正在发布';
  if (hasUnsavedChanges) return '有未保存修改';
  if (hasError) return '发布状态读取失败';
  if (!status) return '读取发布状态';
  if (status.bootstrapRequired) return '需要首次发布';
  if (status.modules.some((module) => module.lastJob?.status === 'failed'))
    return '部分板块发布失败';
  if (status.dirtyCount > 0) return `${status.dirtyCount} 项待发布`;
  return '前台已是最新';
}

export function formatVersionTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function versionCode(version: PublishVersion): string {
  return version.contentVersion.slice(-8);
}

function modulePublishButtonLabel(module: PublishModuleStatus | null, key: string): string {
  if (key === 'all') return '发布全部';
  if (!module) return '发布当前板块';
  switch (module.kind) {
    case 'site':
      return '发布站点设置';
    case 'sections-index':
      return '发布分区导航';
    case 'faq':
      return '发布 FAQ';
    default:
      return '发布当前分区';
  }
}

function moduleStateLabel(module: PublishModuleStatus): string {
  if (module.lastJob?.status === 'failed') return '上次失败';
  if (!module.currentVersion) return '未发布';
  return module.isCurrent ? '已是最新' : '有修改';
}

export function AdminPublishingControls({
  status,
  statusError,
  contextKey,
  publishingKey,
  rollingBack,
  hasUnsavedChanges,
  unsavedTitle,
  onRefresh,
  onPublish,
  onRequestRollback,
}: AdminPublishingControlsProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [historyModuleKey, setHistoryModuleKey] = useState('site');
  const publishing = publishingKey !== null;
  const contextModule = useMemo(
    () => status?.modules.find((module) => module.key === contextKey) ?? null,
    [contextKey, status?.modules],
  );
  const historyModule = useMemo(
    () => status?.modules.find((module) => module.key === historyModuleKey) ?? null,
    [historyModuleKey, status?.modules],
  );
  const contextIsCurrent =
    contextKey === 'all' ? status?.isCurrent === true : contextModule?.isCurrent === true;

  useEffect(() => {
    if (!status?.modules.length) return;
    if (contextKey !== 'all' && status.modules.some((module) => module.key === contextKey)) {
      setHistoryModuleKey(contextKey);
      return;
    }
    if (!status.modules.some((module) => module.key === historyModuleKey)) {
      setHistoryModuleKey(
        status.modules.find((module) => !module.isCurrent)?.key ??
          status.modules[0]?.key ??
          'site',
      );
    }
  }, [contextKey, historyModuleKey, status]);

  return (
    <>
      {hasUnsavedChanges ? (
        <span className="admin-unsaved-chip" title={unsavedTitle}>
          未保存修改
        </span>
      ) : null}
      <div className="publish-version-control">
        <Button
          className={`publish-status-chip${statusError || status?.modules.some((module) => module.lastJob?.status === 'failed') ? ' is-error' : ''}${(status && !status.isCurrent) || hasUnsavedChanges ? ' is-dirty' : ''}`}
          variant="ghost"
          type="button"
          aria-expanded={panelOpen}
          onClick={() => {
            const next = !panelOpen;
            setPanelOpen(next);
            if (next) onRefresh();
          }}
        >
          {publishStatusLabel(status, publishing, hasUnsavedChanges, Boolean(statusError))}
        </Button>
        {panelOpen ? (
          <div className="publish-version-popover">
            <div className="publish-version-popover-title">
              <div>
                <strong>板块发布</strong>
                <small>每个板块独立保留最近 3 版</small>
              </div>
              <Button
                variant="ghost"
                size="icon"
                type="button"
                onClick={() => setPanelOpen(false)}
                aria-label="关闭发布面板"
              >
                <X aria-hidden="true" size={16} />
              </Button>
            </div>
            {statusError ? (
              <div className="publish-status-error" role="alert">
                <span>{statusError}</span>
                <Button variant="secondary" type="button" onClick={onRefresh}>
                  重新读取
                </Button>
              </div>
            ) : null}
            <div className="publish-module-selector">
              <label>
                <span>查看板块</span>
                <select
                  value={historyModuleKey}
                  onChange={(event) => setHistoryModuleKey(event.target.value)}
                >
                  {status?.modules.map((module) => (
                    <option key={module.key} value={module.key}>
                      {module.label} · {moduleStateLabel(module)}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                variant="secondary"
                type="button"
                disabled={
                  !historyModule ||
                  historyModule.isCurrent ||
                  publishing ||
                  rollingBack ||
                  hasUnsavedChanges
                }
                onClick={() => historyModule && onPublish(historyModule.key)}
              >
                发布此板块
              </Button>
            </div>
            <div className="publish-module-summary">
              <span>{historyModule ? moduleStateLabel(historyModule) : '未选择'}</span>
              <small>
                {historyModule?.publishedAt
                  ? `当前版本 ${formatVersionTime(historyModule.publishedAt)}`
                  : '尚无当前版本'}
              </small>
            </div>
            <div className="publish-version-list">
              {historyModule?.versions.length ? (
                historyModule.versions.map((version) => (
                  <div
                    className={`publish-version-row${version.isCurrent ? ' is-current' : ''}`}
                    key={version.contentVersion}
                  >
                    <div>
                      <strong>{formatVersionTime(version.publishedAt)}</strong>
                      <small>{versionCode(version)}</small>
                    </div>
                    <span>{version.isCurrent ? '当前' : `${version.objectCount} 项`}</span>
                    <Button
                      variant="ghost"
                      type="button"
                      disabled={
                        version.isCurrent ||
                        publishing ||
                        rollingBack ||
                        hasUnsavedChanges
                      }
                      onClick={() =>
                        onRequestRollback({
                          moduleKey: historyModule.key,
                          moduleLabel: historyModule.label,
                          version,
                        })
                      }
                      title={hasUnsavedChanges ? '请先处理未保存修改' : undefined}
                    >
                      {version.isCurrent ? '使用中' : '回退'}
                    </Button>
                  </div>
                ))
              ) : (
                <div className="publish-version-empty">该板块尚无发布版本</div>
              )}
            </div>
            <div className="publish-module-footer">
              <span>{status?.dirtyCount ?? 0} 个板块待发布</span>
              <Button
                type="button"
                disabled={
                  status?.isCurrent === true ||
                  publishing ||
                  rollingBack ||
                  hasUnsavedChanges
                }
                onClick={() => onPublish('all')}
              >
                发布全部待更新
              </Button>
            </div>
          </div>
        ) : null}
      </div>
      <Button
        className="storefront-publish-button"
        type="button"
        onClick={() => onPublish(contextKey)}
        disabled={publishing || rollingBack || hasUnsavedChanges || contextIsCurrent}
        title={hasUnsavedChanges ? unsavedTitle : undefined}
      >
        {publishingKey === contextKey || (contextKey === 'all' && publishingKey === 'all')
          ? '发布中…'
          : hasUnsavedChanges
            ? '请先保存'
            : contextIsCurrent
              ? '当前板块已最新'
              : modulePublishButtonLabel(contextModule, contextKey)}
      </Button>
    </>
  );
}
