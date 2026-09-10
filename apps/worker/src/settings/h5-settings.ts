export type H5PublicSettings = {
  publicOrigin: string | null;
  updatedAt: string;
};

function isIpAddress(hostname: string): boolean {
  if (hostname.includes(':')) return true;
  const parts = hostname.split('.');
  return (
    parts.length === 4 &&
    parts.every(
      (part) => /^\d{1,3}$/u.test(part) && Number(part) >= 0 && Number(part) <= 255,
    )
  );
}

export function normalizeH5PublicOrigin(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') throw new Error('H5 公共域名必须是 HTTPS 地址。');

  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('H5 公共域名格式无效。');
  }
  if (url.protocol !== 'https:') throw new Error('H5 公共域名必须使用 HTTPS。');
  if (url.username || url.password || url.port || url.search || url.hash) {
    throw new Error('H5 公共域名只能填写 HTTPS Origin。');
  }
  if (url.pathname !== '/' && url.pathname !== '') {
    throw new Error('H5 公共域名不能包含路径。');
  }
  const hostname = url.hostname.toLowerCase();
  if (!hostname.includes('.') || hostname === 'localhost' || isIpAddress(hostname)) {
    throw new Error('H5 公共域名必须使用有效的公开域名。');
  }
  return url.origin;
}

export async function getH5PublicSettings(db: D1Database): Promise<H5PublicSettings> {
  const row = await db
    .prepare('SELECT public_origin, updated_at FROM h5_public_settings WHERE id = 1')
    .first<{ public_origin: string | null; updated_at: string }>();
  if (!row) throw new Error('H5_PUBLIC_SETTINGS_MISSING');
  return { publicOrigin: row.public_origin, updatedAt: row.updated_at };
}

export function createUpdateH5PublicSettingsStatement(
  db: D1Database,
  publicOrigin: string | null,
  updatedAt: string,
): D1PreparedStatement {
  return db
    .prepare(
      'UPDATE h5_public_settings SET public_origin = ?, updated_at = ? WHERE id = 1',
    )
    .bind(publicOrigin, updatedAt);
}
