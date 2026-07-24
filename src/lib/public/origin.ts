function headerValue(headers: Headers, name: string): string {
  return (headers.get(name) ?? "").split(",", 1)[0]?.trim() ?? "";
}

function forwardedProtocol(headers: Headers): "http:" | "https:" | null {
  const forwarded = headerValue(headers, "x-forwarded-proto").toLowerCase();
  if (forwarded === "http" || forwarded === "https") return `${forwarded}:`;

  const visitor = headers.get("cf-visitor");
  if (!visitor) return null;
  try {
    const scheme = String((JSON.parse(visitor) as { scheme?: unknown }).scheme ?? "").toLowerCase();
    return scheme === "http" || scheme === "https" ? `${scheme}:` : null;
  } catch {
    return null;
  }
}

export function resolvePublicOrigin(url: URL, headers: Headers): string {
  const origin = new URL(url.origin);
  const protocol = forwardedProtocol(headers);
  if (protocol) origin.protocol = protocol;
  return origin.origin;
}

export function normalizePublicAbsoluteUrl(value: string, requestUrl: URL, headers: Headers): string {
  try {
    const candidate = new URL(value);
    if (candidate.origin !== requestUrl.origin) return value;

    const normalized = new URL(`${candidate.pathname}${candidate.search}${candidate.hash}`, resolvePublicOrigin(requestUrl, headers));
    return normalized.href;
  } catch {
    return value;
  }
}
