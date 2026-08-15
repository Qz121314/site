export const TRAFFIC_TIME_ZONE = 'America/Los_Angeles';

export type ConversionTrafficOutcome = 'redirected' | 'provider_error' | 'not_ready';

export type ConversionTrafficEventInput = {
  sectionId: string;
  productId: string;
  conversionGroupId: string | null;
  conversionTargetId: string | null;
  mode: 'customer_service' | 'link' | null;
  outcome: ConversionTrafficOutcome;
  requestId: string;
  createdAt: string;
};

export type TrafficTotals = {
  attempts: number;
  delivered: number;
  customerService: number;
  link: number;
  failed: number;
};

export type TrafficDailyRow = TrafficTotals & {
  date: string;
};

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

export type ConversionTrafficReport = {
  month: string;
  timeZone: string;
  daysInMonth: number;
  totals: TrafficTotals;
  daily: TrafficDailyRow[];
  recipients: TrafficRecipientRow[];
  products: TrafficProductRow[];
};

type TotalsRow = {
  attempts: number;
  delivered: number;
  customer_service: number;
  link_count: number;
  failed: number;
};

type DailyRow = TotalsRow & {
  business_date: string;
};

type RecipientRow = TotalsRow & {
  recipient_id: string | null;
  recipient_name: string | null;
  mode: 'customer_service' | 'link' | null;
  section_name: string | null;
  group_name: string | null;
};

type ProductRow = TotalsRow & {
  product_id: string;
  product_title: string;
  section_name: string;
};

const totalsSql = `
  COUNT(*) AS attempts,
  COALESCE(SUM(CASE WHEN e.outcome = 'redirected' THEN 1 ELSE 0 END), 0) AS delivered,
  COALESCE(SUM(CASE WHEN e.outcome = 'redirected' AND e.mode = 'customer_service' THEN 1 ELSE 0 END), 0) AS customer_service,
  COALESCE(SUM(CASE WHEN e.outcome = 'redirected' AND e.mode = 'link' THEN 1 ELSE 0 END), 0) AS link_count,
  COALESCE(SUM(CASE WHEN e.outcome <> 'redirected' THEN 1 ELSE 0 END), 0) AS failed`;

function finiteCount(value: number | null | undefined): number {
  const normalized = Number(value ?? 0);
  return Number.isFinite(normalized) ? Math.max(0, Math.trunc(normalized)) : 0;
}

function mapTotals(row: TotalsRow | null | undefined): TrafficTotals {
  return {
    attempts: finiteCount(row?.attempts),
    delivered: finiteCount(row?.delivered),
    customerService: finiteCount(row?.customer_service),
    link: finiteCount(row?.link_count),
    failed: finiteCount(row?.failed),
  };
}

export function trafficBusinessDate(value: Date, timeZone = TRAFFIC_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${read('year')}-${read('month')}-${read('day')}`;
}

export function normalizeTrafficMonth(value: string | undefined): string | null {
  if (!value || !/^\d{4}-(0[1-9]|1[0-2])$/u.test(value)) return null;
  return value;
}

export function trafficMonthDays(month: string): number {
  const [yearText, monthText] = month.split('-');
  const year = Number(yearText);
  const monthIndex = Number(monthText);
  return new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
}

export async function recordConversionTrafficEvent(
  db: D1Database,
  input: ConversionTrafficEventInput,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO conversion_events (
         id, section_id, product_id, conversion_group_id,
         conversion_target_id, legacy_conversion_method_id,
         mode, event_type, outcome, request_id, metadata_json,
         created_at, business_date
       ) VALUES (?, ?, ?, ?, ?, NULL, ?, 'click', ?, ?, NULL, ?, ?)
       ON CONFLICT(request_id) DO NOTHING`,
    )
    .bind(
      crypto.randomUUID(),
      input.sectionId,
      input.productId,
      input.conversionGroupId,
      input.conversionTargetId,
      input.mode,
      input.outcome,
      input.requestId,
      input.createdAt,
      trafficBusinessDate(new Date(input.createdAt)),
    )
    .run();
}

export async function getConversionTrafficReport(
  db: D1Database,
  month: string,
): Promise<ConversionTrafficReport> {
  const monthStart = `${month}-01`;
  const monthEnd = (() => {
    const [yearText, monthText] = month.split('-');
    const next = new Date(Date.UTC(Number(yearText), Number(monthText), 1));
    return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-01`;
  })();

  const range = `e.business_date >= ? AND e.business_date < ? AND e.event_type = 'click'`;
  const [totalsResult, dailyResult, recipientsResult, productsResult] = await Promise.all(
    [
      db
        .prepare(`SELECT ${totalsSql} FROM conversion_events e WHERE ${range}`)
        .bind(monthStart, monthEnd)
        .first<TotalsRow>(),
      db
        .prepare(
          `SELECT e.business_date, ${totalsSql}
           FROM conversion_events e
           WHERE ${range}
           GROUP BY e.business_date
           ORDER BY e.business_date ASC`,
        )
        .bind(monthStart, monthEnd)
        .all<DailyRow>(),
      db
        .prepare(
          `SELECT
             CASE
               WHEN e.mode = 'link' THEN e.conversion_target_id
               ELSE COALESCE(g.customer_service_connection_id, e.conversion_group_id)
             END AS recipient_id,
             CASE
               WHEN e.mode = 'link' THEN COALESCE(t.name, '已删除链接')
               ELSE COALESCE(cs.name, g.name, '客服入口')
             END AS recipient_name,
             e.mode,
             COALESCE(s.name, '未知分区') AS section_name,
             COALESCE(g.name, '未绑定分组') AS group_name,
             ${totalsSql}
           FROM conversion_events e
           LEFT JOIN sections s ON s.id = e.section_id
           LEFT JOIN conversion_groups g ON g.id = e.conversion_group_id
           LEFT JOIN conversion_targets t ON t.id = e.conversion_target_id
           LEFT JOIN customer_service_connections cs
             ON cs.id = g.customer_service_connection_id
           WHERE ${range}
           GROUP BY recipient_id, recipient_name, e.mode, section_name, group_name
           ORDER BY delivered DESC, attempts DESC, recipient_name ASC`,
        )
        .bind(monthStart, monthEnd)
        .all<RecipientRow>(),
      db
        .prepare(
          `SELECT
             e.product_id,
             COALESCE(p.title, '已删除产品') AS product_title,
             COALESCE(s.name, '未知分区') AS section_name,
             ${totalsSql}
           FROM conversion_events e
           LEFT JOIN products p ON p.id = e.product_id
           LEFT JOIN sections s ON s.id = e.section_id
           WHERE ${range}
           GROUP BY e.product_id, product_title, section_name
           ORDER BY delivered DESC, attempts DESC, product_title ASC`,
        )
        .bind(monthStart, monthEnd)
        .all<ProductRow>(),
    ],
  );

  return {
    month,
    timeZone: TRAFFIC_TIME_ZONE,
    daysInMonth: trafficMonthDays(month),
    totals: mapTotals(totalsResult),
    daily: dailyResult.results.map((row) => ({
      date: row.business_date,
      ...mapTotals(row),
    })),
    recipients: recipientsResult.results.map((row) => ({
      recipientId:
        row.recipient_id ??
        `unassigned:${row.mode ?? 'unknown'}:${row.section_name ?? 'unknown'}:${row.group_name ?? 'unknown'}`,
      recipientName: row.recipient_name ?? '未识别接收方',
      mode: row.mode,
      sectionName: row.section_name ?? '未知分区',
      groupName: row.group_name ?? '未绑定分组',
      ...mapTotals(row),
    })),
    products: productsResult.results.map((row) => ({
      productId: row.product_id,
      productTitle: row.product_title,
      sectionName: row.section_name,
      ...mapTotals(row),
    })),
  };
}
