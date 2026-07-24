function headerValue(headers: Headers, name: string): string {
  return (headers.get(name) ?? "").split(",", 1)[0]?.trim() ?? "";
}

function forwardedProtocol(headers: Headers): "http:" | "https:" | null {
  const visitor = headers.get("cf-visitor");
  if (visitor) {
    try {
      const scheme = String((JSON.parse(visitor) as { scheme?: unknown }).scheme ?? "").toLowerCase();
      if (scheme === "http" || scheme === "https") return `${scheme}:`;
    } catch {
      // Fall back to X-Forwarded-Proto or the request URL below.
    }
  }

  const forwarded = headerValue(headers, "x-forwarded-proto").toLowerCase();
  return forwarded === "http" || forwarded === "https" ? `${forwarded}:` : null;
}

function isLocalHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === "localhost"
    || normalized === "127.0.0.1"
    || normalized === "[::1]"
    || normalized.endsWith(".localhost");
}

export function resolvePublicOrigin(url: URL, headers: Headers): string {
  const origin = new URL(url.origin);
  if (isLocalHostname(origin.hostname)) {
    const protocol = forwardedProtocol(headers);
    if (protocol) origin.protocol = protocol;
  } else {
    origin.protocol = "https:";
  }
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
