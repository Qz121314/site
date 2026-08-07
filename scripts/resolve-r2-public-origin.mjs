const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();
const bucket = process.env.R2_BUCKET_NAME?.trim();
const preferredOrigin = process.env.PREFERRED_R2_PUBLIC_ORIGIN?.trim() || null;

if (!accountId || !apiToken || !bucket) {
  throw new Error('CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN and R2_BUCKET_NAME are required.');
}

function normalizeHostname(value) {
  if (!value) return null;
  try {
    const url = new URL(value.includes('://') ? value : `https://${value}`);
    return url.hostname.toLowerCase();
  } catch {
    return null;
  }
}

const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/r2/buckets/${encodeURIComponent(bucket)}/domains/custom`;
const response = await fetch(endpoint, {
  headers: {
    Authorization: `Bearer ${apiToken}`,
    Accept: 'application/json',
  },
});

const bodyText = await response.text();
if (!response.ok) {
  throw new Error(`Unable to list R2 custom domains for ${bucket}: HTTP ${response.status}: ${bodyText.slice(0, 800)}`);
}

let payload;
try {
  payload = JSON.parse(bodyText);
} catch {
  throw new Error('Cloudflare returned invalid JSON while listing R2 custom domains.');
}

const domains = Array.isArray(payload?.result?.domains)
  ? payload.result.domains
  : Array.isArray(payload?.result)
    ? payload.result
    : [];

const activeDomains = domains.filter((entry) =>
  entry &&
  typeof entry.domain === 'string' &&
  entry.enabled === true &&
  entry.status?.ownership === 'active' &&
  entry.status?.ssl === 'active'
);

if (activeDomains.length === 0) {
  const summary = domains.map((entry) => ({
    domain: entry?.domain ?? null,
    enabled: entry?.enabled === true,
    ownership: entry?.status?.ownership ?? null,
    ssl: entry?.status?.ssl ?? null,
  }));
  throw new Error(`R2 bucket ${bucket} has no enabled custom domain with active ownership and SSL. Found: ${JSON.stringify(summary)}`);
}

const preferredHostname = normalizeHostname(preferredOrigin);
let selected = preferredHostname
  ? activeDomains.find((entry) => entry.domain.toLowerCase() === preferredHostname)
  : null;

if (!selected && activeDomains.length === 1) {
  [selected] = activeDomains;
}

if (!selected) {
  throw new Error(
    `R2 bucket ${bucket} has multiple active custom domains (${activeDomains.map((entry) => entry.domain).join(', ')}). ` +
    'Set the admin media domain to one of those domains to disambiguate; deployment only reads the actual R2 binding.',
  );
}

process.stdout.write(`https://${selected.domain.toLowerCase()}`);
