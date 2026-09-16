import { Download, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminApiError } from './api';
import {
  downloadCustomerServicePhoneCollection,
  fetchCustomerServiceConnections,
  fetchCustomerServicePhoneCollection,
  type CustomerServiceConnection,
  type CustomerServicePhoneDownloadLog,
} from './customer-service/api';
import { Button } from './components/ui/button';

type PhoneCollectionViewProps = {
  onSessionExpired: () => void;
};

function isSessionError(error: unknown): boolean {
  return (
    error instanceof AdminApiError &&
    (error.status === 401 || error.code === 'SESSION_INVALID')
  );
}

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN');
}

function usableConnection(connection: CustomerServiceConnection): boolean {
  return (
    connection.isEnabled && connection.hasVerifyToken && Boolean(connection.verifiedAt)
  );
}

export function PhoneCollectionView({ onSessionExpired }: PhoneCollectionViewProps) {
  const [connections, setConnections] = useState<CustomerServiceConnection[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [count, setCount] = useState(0);
  const [logs, setLogs] = useState<CustomerServicePhoneDownloadLog[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const usableConnections = useMemo(
    () => connections.filter(usableConnection),
    [connections],
  );

  const handleError = useCallback(
    (error: unknown) => {
      if (isSessionError(error)) {
        onSessionExpired();
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : '号码采集数据加载失败。');
    },
    [onSessionExpired],
  );

  const loadConnections = useCallback(async () => {
    setLoadingConnections(true);
    setErrorMessage('');
    try {
      const items = await fetchCustomerServiceConnections('active');
      setConnections(items);
      const available = items.filter(usableConnection);
      setSelectedId((current) =>
        available.some((connection) => connection.id === current)
          ? current
          : (available[0]?.id ?? ''),
      );
    } catch (error) {
      handleError(error);
    } finally {
      setLoadingConnections(false);
    }
  }, [handleError]);

  const loadData = useCallback(
    async (connectionId: string) => {
      setLoadingData(true);
      setErrorMessage('');
      try {
        const result = await fetchCustomerServicePhoneCollection(connectionId);
        setCount(result.count);
        setLogs(result.logs);
      } catch (error) {
        handleError(error);
      } finally {
        setLoadingData(false);
      }
    },
    [handleError],
  );

  useEffect(() => {
    void loadConnections();
  }, [loadConnections]);

  useEffect(() => {
    if (selectedId) void loadData(selectedId);
  }, [loadData, selectedId]);

  async function handleDownload() {
    if (!selectedId || downloading) return;
    setDownloading(true);
    setErrorMessage('');
    try {
      const blob = await downloadCustomerServicePhoneCollection(selectedId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'visitor-phone-numbers.csv';
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      await loadData(selectedId);
    } catch (error) {
      handleError(error);
    } finally {
      setDownloading(false);
    }
  }

  if (loadingConnections) {
    return (
      <div className="notice" role="status">
        正在加载号码采集…
      </div>
    );
  }

  if (usableConnections.length === 0) {
    return (
      <section
        className="phone-collection-empty"
        aria-labelledby="phone-collection-title"
      >
        <h2 id="phone-collection-title">号码采集</h2>
        <p>请先在“客服接入”中配置并验证一个启用中的客服系统。</p>
      </section>
    );
  }

  return (
    <section
      className="phone-collection-workspace"
      aria-labelledby="phone-collection-title"
    >
      <div className="phone-collection-toolbar">
        <div>
          <p className="phone-collection-eyebrow">访客消息</p>
          <h2 id="phone-collection-title">号码采集</h2>
          <p>仅收集访客消息中的手机号，数据在客服系统中独立保存。</p>
        </div>
        <div className="phone-collection-actions">
          {usableConnections.length > 1 ? (
            <label>
              <span>客服系统</span>
              <select
                value={selectedId}
                onChange={(event) => setSelectedId(event.target.value)}
              >
                {usableConnections.map((connection) => (
                  <option key={connection.id} value={connection.id}>
                    {connection.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <span className="phone-collection-connection">
              {usableConnections[0]?.name ?? ''}
            </span>
          )}
          <Button
            variant="secondary"
            type="button"
            onClick={() => selectedId && void loadData(selectedId)}
            loading={loadingData}
            aria-label="刷新号码采集数据"
          >
            <RefreshCw size={15} aria-hidden="true" />
            刷新
          </Button>
          <Button
            type="button"
            onClick={() => void handleDownload()}
            loading={downloading}
          >
            <Download size={15} aria-hidden="true" />
            下载 Excel
          </Button>
        </div>
      </div>

      {errorMessage ? (
        <div className="notice notice-error" role="alert">
          {errorMessage}
        </div>
      ) : null}

      <div className="phone-collection-count" aria-live="polite">
        <span>已采集手机号</span>
        <strong>{loadingData ? '…' : count.toLocaleString('zh-CN')}</strong>
        <small>Excel 文件包含：时间、号码</small>
      </div>

      <div className="phone-collection-logs">
        <div className="phone-collection-section-heading">
          <h3>下载日志</h3>
          <span>最近 20 次</span>
        </div>
        {logs.length === 0 ? (
          <p className="phone-collection-no-logs">暂无下载记录。</p>
        ) : (
          <div className="phone-collection-log-table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">下载时间</th>
                  <th scope="col">文件行数</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={`${log.downloadedAt}-${log.rowCount}`}>
                    <td>{formatTime(log.downloadedAt)}</td>
                    <td>{log.rowCount.toLocaleString('zh-CN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
