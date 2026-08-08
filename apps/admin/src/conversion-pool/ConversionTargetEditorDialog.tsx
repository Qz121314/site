import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AdminApiError } from '../api';
import {
  fetchCustomerServiceConnections,
  fetchRemoteCustomerServiceGroups,
  type CustomerServiceConnection,
  type RemoteCustomerServiceGroup,
} from '../customer-service/api';
import type {
  AdminConversionGroup,
  AdminConversionTarget,
  ConversionTargetInput,
} from './api';

type Props = {
  group: AdminConversionGroup;
  editingTarget: AdminConversionTarget | null;
  form: ConversionTargetInput;
  saving: boolean;
  errorMessage: string;
  onFormChange: (form: ConversionTargetInput) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSessionExpired: () => void;
};

function isSessionError(error: unknown): boolean {
  return error instanceof AdminApiError && (error.status === 401 || error.code === 'SESSION_INVALID');
}

export function ConversionTargetEditorDialog({
  group,
  editingTarget,
  form,
  saving,
  errorMessage,
  onFormChange,
  onClose,
  onSubmit,
  onSessionExpired,
}: Props) {
  const isCustomerService = group.mode === 'customer_service';
  const [connections, setConnections] = useState<CustomerServiceConnection[]>([]);
  const [remoteGroups, setRemoteGroups] = useState<RemoteCustomerServiceGroup[]>([]);
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [integrationError, setIntegrationError] = useState('');

  const loadGroups = useCallback(
    async (connectionId: string) => {
      if (!connectionId) {
        setRemoteGroups([]);
        return;
      }
      setGroupsLoading(true);
      setIntegrationError('');
      try {
        setRemoteGroups(await fetchRemoteCustomerServiceGroups(connectionId));
      } catch (error) {
        if (isSessionError(error)) {
          onSessionExpired();
          return;
        }
        setRemoteGroups([]);
        setIntegrationError(error instanceof Error ? error.message : '读取客服分组失败。');
      } finally {
        setGroupsLoading(false);
      }
    },
    [onSessionExpired],
  );

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
        setIntegrationError(error instanceof Error ? error.message : '读取客服系统失败。');
      })
      .finally(() => {
        if (active) setConnectionsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isCustomerService, onSessionExpired]);

  useEffect(() => {
    if (!isCustomerService || !form.customerServiceConnectionId) {
      setRemoteGroups([]);
      return;
    }
    void loadGroups(form.customerServiceConnectionId);
  }, [form.customerServiceConnectionId, isCustomerService, loadGroups]);

  return (
    <div className="admin-dialog-backdrop" role="presentation">
      <section
        className="admin-dialog conversion-editor-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="conversion-target-editor-title"
      >
        <div className="admin-dialog-header">
          <div>
            <p>{group.name}</p>
            <h3 id="conversion-target-editor-title">
              {editingTarget ? '编辑转化入口' : '新增转化入口'}
            </h3>
          </div>
          <button type="button" aria-label="关闭" disabled={saving} onClick={onClose}>
            ×
          </button>
        </div>

        <form className="conversion-editor-form" onSubmit={onSubmit}>
          {errorMessage ? <div className="notice notice-error" role="alert">{errorMessage}</div> : null}

          {isCustomerService ? (
            <>
              {editingTarget?.bindingKind === 'legacy_customer_service' ? (
                <p className="inline-status is-error">旧客服入口已停用，需要重新绑定客服系统分组。</p>
              ) : null}

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
                      name: '',
                      endpointUrl: null,
                      customerServiceConnectionId: connectionId,
                      remoteGroupId: null,
                      remoteGroupName: null,
                    });
                  }}
                >
                  <option value="">{connectionsLoading ? '正在读取…' : '选择客服系统'}</option>
                  {connections.map((connection) => (
                    <option key={connection.id} value={connection.id} disabled={!connection.isEnabled}>
                      {connection.name}{connection.isEnabled ? '' : '（停用）'}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>客服分组</span>
                <div className="conversion-remote-group-row">
                  <select
                    value={form.remoteGroupId ?? ''}
                    required
                    disabled={!form.customerServiceConnectionId || groupsLoading || saving}
                    onChange={(event) => {
                      const remoteGroupId = event.target.value || null;
                      const selected = remoteGroups.find((item) => item.id === remoteGroupId) ?? null;
                      onFormChange({
                        ...form,
                        name: selected?.name ?? '',
                        endpointUrl: null,
                        remoteGroupId,
                        remoteGroupName: selected?.name ?? null,
                      });
                    }}
                  >
                    <option value="">{groupsLoading ? '正在读取…' : '选择客服分组'}</option>
                    {remoteGroups.map((remoteGroup) => (
                      <option key={remoteGroup.id} value={remoteGroup.id} disabled={!remoteGroup.isEnabled}>
                        {remoteGroup.name}{remoteGroup.isEnabled ? '' : '（停用）'}
                      </option>
                    ))}
                  </select>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={!form.customerServiceConnectionId || groupsLoading || saving}
                    onClick={() => {
                      if (form.customerServiceConnectionId) void loadGroups(form.customerServiceConnectionId);
                    }}
                  >
                    刷新
                  </button>
                </div>
              </label>

              {integrationError ? <p className="inline-status is-error">{integrationError}</p> : null}
            </>
          ) : (
            <>
              <label>
                <span>链接名称</span>
                <input
                  type="text"
                  value={form.name}
                  autoFocus
                  required
                  maxLength={100}
                  onChange={(event) => onFormChange({ ...form, name: event.target.value })}
                />
              </label>

              <label>
                <span>跳转链接</span>
                <input
                  type="url"
                  value={form.endpointUrl ?? ''}
                  required
                  maxLength={1000}
                  placeholder="https://"
                  onChange={(event) => onFormChange({ ...form, endpointUrl: event.target.value || null })}
                />
              </label>
            </>
          )}

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
            <span><strong>启用入口</strong></span>
            <input
              type="checkbox"
              checked={form.isEnabled}
              onChange={(event) => onFormChange({ ...form, isEnabled: event.target.checked })}
            />
          </label>

          <div className="admin-dialog-actions">
            <button className="secondary-button" type="button" disabled={saving} onClick={onClose}>
              取消
            </button>
            <button
              className="primary-button"
              type="submit"
              disabled={
                saving ||
                (isCustomerService &&
                  (!form.customerServiceConnectionId || !form.remoteGroupId || !form.remoteGroupName))
              }
            >
              {saving ? '正在保存…' : '保存入口'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
