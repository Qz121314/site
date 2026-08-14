import { useEffect, useState, type FormEvent } from 'react';
import { AdminApiError } from '../api';
import {
  fetchCustomerServiceConnections,
  type CustomerServiceConnection,
} from '../customer-service/api';
import type { AdminConversionGroup, ConversionGroupInput, ConversionMode } from './api';

type Props = {
  sectionName: string;
  editingGroup: AdminConversionGroup | null;
  form: ConversionGroupInput;
  saving: boolean;
  errorMessage: string;
  onFormChange: (form: ConversionGroupInput) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSessionExpired: () => void;
};

const CUSTOMER_SERVICE_AUTO_ROUTE_ID = 'auto';
const CUSTOMER_SERVICE_AUTO_ROUTE_NAME = '客服系统自动分流';

const modeOptions: Array<{ value: ConversionMode; title: string; description: string }> =
  [
    {
      value: 'customer_service',
      title: '在线客服分组',
      description: '产品绑定本分组后，前端直接连接客服系统并由客服系统分流。',
    },
    {
      value: 'link',
      title: '链接分组',
      description: '线上服务 CTA 从多个外部链接中轮换。',
    },
  ];

function isSessionError(error: unknown): boolean {
  return (
    error instanceof AdminApiError &&
    (error.status === 401 || error.code === 'SESSION_INVALID')
  );
}

export function ConversionGroupEditorDialog({
  sectionName,
  editingGroup,
  form,
  saving,
  errorMessage,
  onFormChange,
  onClose,
  onSubmit,
  onSessionExpired,
}: Props) {
  const modeLocked = Boolean(
    editingGroup && editingGroup.mode === 'link' && editingGroup.targetCount > 0,
  );
  const isCustomerService = form.mode === 'customer_service';
  const [connections, setConnections] = useState<CustomerServiceConnection[]>([]);
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [integrationError, setIntegrationError] = useState('');

  useEffect(() => {
    if (!isCustomerService) return;
    let active = true;
    setConnectionsLoading(true);
    setIntegrationError('');
    void fetchCustomerServiceConnections('active')
      .then((items) => {
        if (!active) return;
        setConnections(items);
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (isSessionError(error)) {
          onSessionExpired();
          return;
        }
        setIntegrationError(
          error instanceof Error ? error.message : '读取客服系统失败。',
        );
      })
      .finally(() => {
        if (active) setConnectionsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isCustomerService, onSessionExpired]);

  return (
    <div className="admin-dialog-backdrop" role="presentation">
      <section
        className="admin-dialog conversion-editor-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="conversion-group-editor-title"
      >
        <div className="admin-dialog-header">
          <div>
            <p>{sectionName} · 转化池</p>
            <h3 id="conversion-group-editor-title">
              {editingGroup ? '编辑转化分组' : '新增转化分组'}
            </h3>
          </div>
          <button type="button" aria-label="关闭" disabled={saving} onClick={onClose}>
            ×
          </button>
        </div>

        <form className="conversion-editor-form" onSubmit={onSubmit}>
          {errorMessage ? (
            <div className="notice notice-error" role="alert">
              {errorMessage}
            </div>
          ) : null}

          <label>
            <span>分组名称</span>
            <input
              type="text"
              value={form.name}
              autoFocus
              required
              maxLength={100}
              placeholder="例如：售前客服"
              onChange={(event) => onFormChange({ ...form, name: event.target.value })}
            />
            <small>产品录入时直接选择这个分组。</small>
          </label>

          <fieldset>
            <legend>分组类型</legend>
            <div className="conversion-mode-options">
              {modeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={form.mode === option.value ? 'is-selected' : undefined}
                  aria-pressed={form.mode === option.value}
                  disabled={saving || modeLocked}
                  onClick={() =>
                    onFormChange({
                      ...form,
                      mode: option.value,
                      customerServiceConnectionId: null,
                      remoteGroupId: null,
                      remoteGroupName: null,
                    })
                  }
                >
                  <strong>{option.title}</strong>
                  <span>{option.description}</span>
                </button>
              ))}
            </div>
            {modeLocked ? <small>链接分组已有入口时不能修改类型。</small> : null}
          </fieldset>

          {isCustomerService ? (
            <>
              <label>
                <span>客服系统</span>
                <select
                  value={form.customerServiceConnectionId ?? ''}
                  required
                  disabled={connectionsLoading || saving}
                  onChange={(event) => {
                    const connectionId = event.target.value || null;
                    onFormChange({
                      ...form,
                      customerServiceConnectionId: connectionId,
                      remoteGroupId: connectionId ? CUSTOMER_SERVICE_AUTO_ROUTE_ID : null,
                      remoteGroupName: connectionId
                        ? CUSTOMER_SERVICE_AUTO_ROUTE_NAME
                        : null,
                    });
                  }}
                >
                  <option value="">
                    {connectionsLoading ? '正在读取…' : '选择客服系统'}
                  </option>
                  {connections.map((connection) => {
                    const available = Boolean(
                      connection.isEnabled &&
                      connection.verifiedAt &&
                      connection.clientApiUrl &&
                      connection.realtimeUrl,
                    );
                    return (
                      <option
                        key={connection.id}
                        value={connection.id}
                        disabled={!available}
                      >
                        {connection.name}
                        {available ? '' : '（未验证）'}
                      </option>
                    );
                  })}
                </select>
                <small>
                  客服分组不在 Site
                  里指定。访客发起会话后，客服系统会根据产品所属分区和分类自动分流。
                </small>
              </label>

              {integrationError ? (
                <p className="inline-status is-error">{integrationError}</p>
              ) : null}
            </>
          ) : null}

          <label>
            <span>CTA 按钮文字</span>
            <input
              type="text"
              value={form.buttonLabel}
              required
              maxLength={80}
              placeholder={form.mode === 'link' ? '例如：Book Now' : '例如：Contact Us'}
              onChange={(event) =>
                onFormChange({ ...form, buttonLabel: event.target.value })
              }
            />
          </label>

          <label>
            <span>排序</span>
            <input
              type="number"
              min={0}
              max={1_000_000}
              step={1}
              required
              value={form.sortOrder}
              onChange={(event) =>
                onFormChange({ ...form, sortOrder: Number(event.target.value) })
              }
            />
          </label>

          <label className="switch-row">
            <span>
              <strong>启用分组</strong>
              <small>
                {isCustomerService
                  ? '客服系统已验证后，前端会直接连接；具体客服分组由客服系统按产品分区和分类决定。'
                  : '至少需要一个启用的链接入口。'}
              </small>
            </span>
            <input
              type="checkbox"
              checked={form.isEnabled}
              onChange={(event) =>
                onFormChange({ ...form, isEnabled: event.target.checked })
              }
            />
          </label>

          <div className="admin-dialog-actions">
            <button
              className="secondary-button"
              type="button"
              disabled={saving}
              onClick={onClose}
            >
              取消
            </button>
            <button
              className="primary-button"
              type="submit"
              disabled={
                saving || (isCustomerService && !form.customerServiceConnectionId)
              }
            >
              {saving ? '正在保存…' : '保存分组'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
