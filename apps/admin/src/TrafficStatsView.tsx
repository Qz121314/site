import { useEffect, useMemo, useState } from 'react';
import { AdminApiError } from './api';
import {
  fetchTrafficReport,
  type TrafficDailyRow,
  type TrafficReport,
} from './traffic-stats-api';

type Props = { onSessionExpired: () => void };
type DetailView = 'recipients' | 'products' | 'daily';

const REPORT_TIME_ZONE = 'America/Los_Angeles';

function currentBusinessMonth(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: REPORT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${read('year')}-${read('month')}`;
}

function errorMessage(error: unknown): string {
  return error instanceof AdminApiError ? error.message : '无法读取流量统计。';
}

function modeLabel(mode: 'customer_service' | 'link' | null): string {
  if (mode === 'customer_service') return '客服入口';
  if (mode === 'link') return '链接分发';
  return '未识别';
}

function zeroDay(date: string): TrafficDailyRow {
  return {
    date,
    attempts: 0,
    delivered: 0,
    customerService: 0,
    link: 0,
    failed: 0,
  };
}

export function TrafficStatsView({ onSessionExpired }: Props) {
  const [month, setMonth] = useState(currentBusinessMonth);
  const [report, setReport] = useState<TrafficReport | null>(null);
  const [detailView, setDetailView] = useState<DetailView>('recipients');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    fetchTrafficReport(month, controller.signal)
      .then(setReport)
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        if (
          reason instanceof AdminApiError &&
          (reason.status === 401 || reason.code === 'SESSION_INVALID')
        ) {
          onSessionExpired();
          return;
        }
        setError(errorMessage(reason));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [month, onSessionExpired, reloadKey]);

  const daily = useMemo(() => {
    if (!report) return [];
    const byDate = new Map(report.daily.map((row) => [row.date, row]));
    return Array.from({ length: report.daysInMonth }, (_, index) => {
      const date = `${report.month}-${String(index + 1).padStart(2, '0')}`;
      return byDate.get(date) ?? zeroDay(date);
    });
  }, [report]);

  const totals = report?.totals;

  return (
    <section className="traffic-stats" aria-labelledby="traffic-stats-title">
      <div className="traffic-command-bar">
        <div>
          <h2 id="traffic-stats-title">流量统计</h2>
          <p>只统计经过正式分发入口的流量，普通浏览量不参与结算。</p>
        </div>
        <label>
          <span>自然月</span>
          <input
            type="month"
            value={month}
            max="9999-12"
            onChange={(event) => setMonth(event.target.value)}
          />
        </label>
      </div>

      {error ? (
        <div className="notice notice-error" role="alert">
          {error}
          <button type="button" onClick={() => setReloadKey((value) => value + 1)}>
            重新读取
          </button>
        </div>
      ) : null}

      <div className="traffic-summary" aria-busy={loading}>
        <article className="is-primary">
          <span>有效流量</span>
          <strong>{loading ? '—' : (totals?.delivered ?? 0)}</strong>
          <small>总尝试 {loading ? '—' : (totals?.attempts ?? 0)}</small>
        </article>
        <article>
          <span>客服入口分发</span>
          <strong>{loading ? '—' : (totals?.customerService ?? 0)}</strong>
          <small>成功进入客服接待页</small>
        </article>
        <article>
          <span>链接分发</span>
          <strong>{loading ? '—' : (totals?.link ?? 0)}</strong>
          <small>成功分配到外部入口</small>
        </article>
        <article className={totals?.failed ? 'has-failures' : undefined}>
          <span>未送达</span>
          <strong>{loading ? '—' : (totals?.failed ?? 0)}</strong>
          <small>不计入有效流量</small>
        </article>
      </div>

      <div className="traffic-ledger">
        <div className="traffic-ledger-head">
          <div className="traffic-tabs" role="tablist" aria-label="流量统计维度">
            {(
              [
                ['recipients', '按接收方'],
                ['products', '按产品'],
                ['daily', '每日明细'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={detailView === value}
                className={detailView === value ? 'is-active' : undefined}
                onClick={() => setDetailView(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <small>
            {report ? `${report.month} · ${report.daysInMonth} 天` : month} · 太平洋时间
          </small>
        </div>

        <div className="traffic-table-wrap">
          {loading ? (
            <div className="traffic-empty">正在核对流量账本…</div>
          ) : detailView === 'recipients' ? (
            <table className="traffic-table">
              <thead>
                <tr>
                  <th>接收方</th>
                  <th>方式</th>
                  <th>分区 / 分组</th>
                  <th>有效流量</th>
                  <th>未送达</th>
                </tr>
              </thead>
              <tbody>
                {report?.recipients.length ? (
                  report.recipients.map((row) => (
                    <tr
                      key={`${row.mode}:${row.recipientId}:${row.sectionName}:${row.groupName}`}
                    >
                      <td>
                        <strong>{row.recipientName}</strong>
                      </td>
                      <td>{modeLabel(row.mode)}</td>
                      <td>
                        <span>{row.sectionName}</span>
                        <small>{row.groupName}</small>
                      </td>
                      <td>
                        <b>{row.delivered}</b>
                      </td>
                      <td className={row.failed ? 'traffic-failed' : undefined}>
                        {row.failed}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5}>
                      <div className="traffic-empty">本月暂无流量</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : detailView === 'products' ? (
            <table className="traffic-table">
              <thead>
                <tr>
                  <th>产品</th>
                  <th>分区</th>
                  <th>客服入口</th>
                  <th>链接分发</th>
                  <th>有效流量</th>
                  <th>未送达</th>
                </tr>
              </thead>
              <tbody>
                {report?.products.length ? (
                  report.products.map((row) => (
                    <tr key={row.productId}>
                      <td>
                        <strong>{row.productTitle}</strong>
                      </td>
                      <td>{row.sectionName}</td>
                      <td>{row.customerService}</td>
                      <td>{row.link}</td>
                      <td>
                        <b>{row.delivered}</b>
                      </td>
                      <td className={row.failed ? 'traffic-failed' : undefined}>
                        {row.failed}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}>
                      <div className="traffic-empty">本月暂无流量</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="traffic-table traffic-daily-table">
              <thead>
                <tr>
                  <th>日期</th>
                  <th>总尝试</th>
                  <th>客服入口</th>
                  <th>链接分发</th>
                  <th>有效流量</th>
                  <th>未送达</th>
                </tr>
              </thead>
              <tbody>
                {daily.map((row) => (
                  <tr key={row.date}>
                    <td>
                      <strong>{Number(row.date.slice(-2))} 日</strong>
                    </td>
                    <td>{row.attempts}</td>
                    <td>{row.customerService}</td>
                    <td>{row.link}</td>
                    <td>
                      <b>{row.delivered}</b>
                    </td>
                    <td className={row.failed ? 'traffic-failed' : undefined}>
                      {row.failed}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <p className="traffic-footnote">
        有效流量以成功进入客服接待页或成功跳转到外部入口为准；失败尝试单独保留，便于核对，但不进入结算数量。
      </p>
    </section>
  );
}
