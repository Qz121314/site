import { AdminApiError } from './api';
import { adminFetch } from './admin-fetch';

export type TrafficTotals = {
  attempts: number;
  delivered: number;
  customerService: number;
  link: number;
  failed: number;
};

export type TrafficDailyRow = TrafficTotals & { date: string };

export type TrafficRecipientRow = TrafficTotals & {
  recipientId: string;
  recipientName: string;
  mode: 'customer_service' | 'link' | null;
  sectionName: string;
  groupName: string;
};

export type TrafficProductRow = TrafficTotals & {
  productId: string;
  productTitle: string;
  sectionName: string;
};

export type TrafficReport = {
  month: string;
  timeZone: string;
  daysInMonth: number;
  totals: TrafficTotals;
  daily: TrafficDailyRow[];
  recipients: TrafficRecipientRow[];
  products: TrafficProductRow[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isTotals(value: unknown): value is TrafficTotals {
  const row = asRecord(value);
  return Boolean(
    row &&
    isCount(row.attempts) &&
    isCount(row.delivered) &&
    isCount(row.customerService) &&
    isCount(row.link) &&
    isCount(row.failed),
  );
}

function isDailyRow(value: unknown): value is TrafficDailyRow {
  const row = asRecord(value);
  return Boolean(row && typeof row.date === 'string' && isTotals(row));
}

function isRecipientRow(value: unknown): value is TrafficRecipientRow {
  const row = asRecord(value);
  return Boolean(
    row &&
    typeof row.recipientId === 'string' &&
    typeof row.recipientName === 'string' &&
    (row.mode === 'customer_service' || row.mode === 'link' || row.mode === null) &&
    typeof row.sectionName === 'string' &&
    typeof row.groupName === 'string' &&
    isTotals(row),
  );
}

function isProductRow(value: unknown): value is TrafficProductRow {
  const row = asRecord(value);
  return Boolean(
    row &&
    typeof row.productId === 'string' &&
    typeof row.productTitle === 'string' &&
    typeof row.sectionName === 'string' &&
    isTotals(row),
  );
}

function parseReport(value: unknown): TrafficReport {
  const report = asRecord(value);
  if (
    !report ||
    typeof report.month !== 'string' ||
    typeof report.timeZone !== 'string' ||
    !isCount(report.daysInMonth) ||
    !isTotals(report.totals) ||
    !Array.isArray(report.daily) ||
    !report.daily.every(isDailyRow) ||
    !Array.isArray(report.recipients) ||
    !report.recipients.every(isRecipientRow) ||
    !Array.isArray(report.products) ||
    !report.products.every(isProductRow)
  ) {
    throw new AdminApiError(500, 'INVALID_TRAFFIC_REPORT', '流量统计返回数据无效。');
  }
  return report as TrafficReport;
}

export async function fetchTrafficReport(
  month: string,
  signal?: AbortSignal,
): Promise<TrafficReport> {
  const query = new URLSearchParams({ month });
  const response = await adminFetch(`/api/admin/traffic?${query.toString()}`, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...(signal ? { signal } : {}),
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = asRecord(asRecord(body)?.error);
    throw new AdminApiError(
      response.status,
      typeof error?.code === 'string' ? error.code : 'TRAFFIC_REPORT_FAILED',
      typeof error?.message === 'string' ? error.message : '无法读取流量统计。',
    );
  }
  return parseReport(body);
}
