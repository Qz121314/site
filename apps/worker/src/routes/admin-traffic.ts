import { Hono } from 'hono';
import {
  getConversionTrafficReport,
  normalizeTrafficMonth,
} from '../conversion-traffic/conversion-traffic';
import { apiError } from '../http/api-response';
import type { AppEnvironment } from '../types';

export const adminTrafficRoutes = new Hono<AppEnvironment>();

adminTrafficRoutes.get('/', async (context) => {
  const month = normalizeTrafficMonth(context.req.query('month'));
  if (!month) {
    return apiError(
      context,
      400,
      'INVALID_TRAFFIC_MONTH',
      '统计月份格式无效，请使用 YYYY-MM。',
    );
  }

  const report = await getConversionTrafficReport(context.env.DB, month);
  context.header('Cache-Control', 'no-store, private');
  return context.json(report);
});
