import { Check, CloudUpload, RotateCcw, TriangleAlert } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Button } from '../components/ui/button';
import type { PublishModuleStatus, PublishStatus, PublishVersion } from '../publish-api';

export type RollbackTarget = {
  moduleKey: string;
  moduleLabel: string;
  version: PublishVersion;
};

type WorkspacePublishMenuProps = {
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

type PublishMenuState =
  'clean' | 'pending' | 'publishing' | 'failed' | 'unsaved' | 'loading';

function stateFor(
  module: PublishModuleStatus | null,
  status: PublishStatus | null,
  publishing: boolean,
  hasUnsavedChanges: boolean,
  statusError: string,
): PublishMenuState {
  if (publishing) return 'publishing';
  if (hasUnsavedChanges) return 'unsaved';
  if (statusError || module?.lastJob?.status === 'failed') return 'failed';
  if (!status || !module) return 'loading';
  if (status.bootstrapRequired || !module.isCurrent) return 'pending';
  return 'clean';
}

function stateLabel(state: PublishMenuState): string {
  switch (state) {
    case 'clean':
      return '当前板块已是最新';
    case 'pending':
      return '有待发布修改';
    case 'publishing':
      return '正在发布当前板块';
    case 'failed':
      return '上次发布失败';
    case 'unsaved':
      return '请先保存当前修改';
    default:
      return '正在读取发布状态';
  }
}

function previousVersion(module: PublishModuleStatus | null): PublishVersion | null {
  return module?.versions.find((version) => !version.isCurrent) ?? null;
}

export function WorkspacePublishMenu({
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
}: WorkspacePublishMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();
  const module = status?.modules.find((item) => item.key === contextKey) ?? null;
  const publishing = publishingKey === contextKey;
  const state = stateFor(module, status, publishing, hasUnsavedChanges, statusError);
  const canPublish = state === 'pending' || state === 'failed';
  const rollbackVersion = previousVersion(module);
  const rollbackDisabled =
    !rollbackVersion || publishingKey !== null || rollingBack || hasUnsavedChanges;

  useEffect(() => {
    if (!open) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Node &&
        !menuRef.current?.contains(target) &&
        !triggerRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [open]);

  function openMenu() {
    setOpen(true);
    onRefresh();
  }

  function closeMenuAndReturnFocus() {
    setOpen(false);
    triggerRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenuAndReturnFocus();
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]:not(:disabled)',
      ) ?? [],
    );
    if (!items.length) return;
    event.preventDefault();
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    items[(currentIndex + direction + items.length) % items.length]?.focus();
  }

  return (
    <div className="workspace-publish-menu" ref={triggerRef}>
      <Button
        className={`workspace-publish-trigger is-${state}`}
        variant="ghost"
        size="icon"
        type="button"
        aria-label="发布当前板块"
        aria-describedby={tooltipId}
        aria-haspopup="menu"
        aria-expanded={open}
        title={stateLabel(state)}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault();
            openMenu();
            window.setTimeout(() =>
              menuRef.current
                ?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')
                ?.focus(),
            );
          }
        }}
      >
        {state === 'publishing' ? (
          <span className="workspace-publish-spinner" aria-hidden="true" />
        ) : state === 'failed' ? (
          <TriangleAlert aria-hidden="true" size={17} />
        ) : state === 'clean' ? (
          <Check aria-hidden="true" size={17} />
        ) : (
          <CloudUpload aria-hidden="true" size={17} />
        )}
        {state === 'pending' || state === 'failed' ? (
          <span className="workspace-publish-indicator" aria-hidden="true" />
        ) : null}
      </Button>
      <span className="workspace-publish-tooltip" id={tooltipId} role="tooltip">
        {stateLabel(state)}
      </span>
      {open ? (
        <div
          ref={menuRef}
          className="workspace-publish-dropdown"
          role="menu"
          aria-label="当前板块发布操作"
          onKeyDown={handleMenuKeyDown}
        >
          <div className="workspace-publish-dropdown-heading">
            <strong>当前板块发布</strong>
            <small>
              {module ? `${module.label} · ${stateLabel(state)}` : stateLabel(state)}
            </small>
          </div>
          {statusError ? (
            <button
              className="workspace-publish-read-error"
              type="button"
              onClick={onRefresh}
            >
              {statusError}，重新读取
            </button>
          ) : null}
          <div className="workspace-publish-dropdown-items">
            <Button
              className="workspace-publish-menu-item is-primary"
              variant="ghost"
              type="button"
              role="menuitem"
              disabled={!canPublish || rollingBack}
              title={hasUnsavedChanges ? unsavedTitle : undefined}
              onClick={() => {
                setOpen(false);
                onPublish(contextKey);
              }}
            >
              <CloudUpload aria-hidden="true" size={16} />
              <span>{publishing ? '正在发布…' : '发布当前板块'}</span>
            </Button>
            {rollbackVersion ? (
              <Button
                className="workspace-publish-menu-item"
                variant="ghost"
                type="button"
                role="menuitem"
                disabled={rollbackDisabled}
                title={hasUnsavedChanges ? unsavedTitle : undefined}
                onClick={() => {
                  if (!module) return;
                  setOpen(false);
                  onRequestRollback({
                    moduleKey: module.key,
                    moduleLabel: module.label,
                    version: rollbackVersion,
                  });
                }}
              >
                <RotateCcw aria-hidden="true" size={15} />
                <span>恢复到上个已发布版本</span>
              </Button>
            ) : null}
          </div>
          {hasUnsavedChanges ? (
            <p className="workspace-publish-hint">请先保存当前修改</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
