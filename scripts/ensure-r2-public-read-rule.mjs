import { pathToFileURL } from 'node:url';

const API_BASE = 'https://api.cloudflare.com/client/v4';
const RULE_DESCRIPTION = 'service-catalog-site: allow public R2 GET/HEAD without web challenges';

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function api(path, init = {}) {
  const token = requiredEnv('CLOUDFLARE_API_TOKEN');
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  let payload = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text.slice(0, 1600) };
    }
  }

  if (!response.ok || payload?.success === false) {
    const error = new Error(`Cloudflare API ${response.status} for ${path}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

async function findZoneId(hostname) {
  const accountId = requiredEnv('CLOUDFLARE_ACCOUNT_ID');
  const labels = hostname.split('.').filter(Boolean);

  for (let index = 0; index <= labels.length - 2; index += 1) {
    const candidate = labels.slice(index).join('.');
    const query = new URLSearchParams({
      name: candidate,
      'account.id': accountId,
      status: 'active',
      per_page: '50',
    });
    const payload = await api(`/zones?${query.toString()}`, { method: 'GET' });
    const rows = Array.isArray(payload?.result) ? payload.result : [];
    if (rows.length === 1 && typeof rows[0]?.id === 'string') {
      return { id: rows[0].id, name: rows[0].name };
    }
  }

  throw new Error(`No active Cloudflare zone found for R2 custom domain ${hostname}`);
}

function desiredRule(hostname) {
  return {
    action: 'skip',
    action_parameters: {
      ruleset: 'current',
      phases: ['http_ratelimit', 'http_request_sbfm', 'http_request_firewall_managed'],
      products: ['zoneLockdown', 'uaBlock', 'bic', 'hot', 'securityLevel', 'rateLimit', 'waf'],
    },
    expression: `(http.host eq ${JSON.stringify(hostname)} and http.request.method in {"GET" "HEAD"})`,
    description: RULE_DESCRIPTION,
    enabled: true,
    logging: { enabled: true },
  };
}

async function getEntryPoint(zoneId) {
  try {
    return await api(
      `/zones/${zoneId}/rulesets/phases/http_request_firewall_custom/entrypoint`,
      { method: 'GET' },
    );
  } catch (error) {
    if (error?.status === 404) return null;
    throw error;
  }
}

export function printR2PublicReadRuleFailure(error) {
  console.error(error instanceof Error ? error.message : String(error));
  if (error?.payload) console.error(JSON.stringify(error.payload, null, 2));
  if (error?.status === 403) {
    console.error(
      'The deployment token must include Zone WAF Write (or an equivalent Rulesets/WAF write permission) for the R2 custom-domain zone.',
    );
  }
}

export async function ensureR2PublicReadRule(publicOrigin, bucketName) {
  if (!publicOrigin?.trim()) throw new Error('PUBLIC_CONTENT_ORIGIN is required');
  if (!bucketName?.trim()) throw new Error('R2_BUCKET_NAME is required');

  const url = new URL(publicOrigin);
  if (url.protocol !== 'https:') throw new Error('PUBLIC_CONTENT_ORIGIN must use HTTPS');
  const hostname = url.hostname.toLowerCase();
  const zone = await findZoneId(hostname);
  const rule = desiredRule(hostname);

  console.error(`R2 bucket: ${bucketName}`);
  console.error(`R2 public hostname: ${hostname}`);
  console.error(`Cloudflare zone: ${zone.name} (${zone.id})`);

  const entryPoint = await getEntryPoint(zone.id);
  if (!entryPoint) {
    const created = await api(`/zones/${zone.id}/rulesets`, {
      method: 'POST',
      body: JSON.stringify({
        name: 'default',
        description: 'Zone-level custom firewall rules',
        kind: 'zone',
        phase: 'http_request_firewall_custom',
        rules: [rule],
      }),
    });
    console.error(`Created R2 public-read skip rule in ruleset ${created?.result?.id ?? 'unknown'}.`);
    return;
  }

  const ruleset = entryPoint?.result;
  if (!ruleset || typeof ruleset.id !== 'string') {
    throw new Error('Cloudflare returned an invalid custom firewall entry point ruleset');
  }

  const rules = Array.isArray(ruleset.rules) ? ruleset.rules : [];
  const existing = rules.find((item) => item?.description === RULE_DESCRIPTION);

  if (existing?.id) {
    await api(`/zones/${zone.id}/rulesets/${ruleset.id}/rules/${existing.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ ...rule, position: { index: 1 } }),
    });
    console.error(`Updated R2 public-read skip rule ${existing.id} and moved it to priority 1.`);
    return;
  }

  const created = await api(`/zones/${zone.id}/rulesets/${ruleset.id}/rules`, {
    method: 'POST',
    body: JSON.stringify({ ...rule, position: { index: 1 } }),
  });
  console.error(`Created R2 public-read skip rule ${created?.result?.id ?? 'unknown'} at priority 1.`);
}

const invokedAsScript = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedAsScript) {
  ensureR2PublicReadRule(
    requiredEnv('PUBLIC_CONTENT_ORIGIN'),
    requiredEnv('R2_BUCKET_NAME'),
  ).catch((error) => {
    printR2PublicReadRuleFailure(error);
    process.exitCode = 1;
  });
}
