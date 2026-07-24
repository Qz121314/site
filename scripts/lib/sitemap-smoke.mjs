function decodeXmlText(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

export function validateSitemapResponse(response, body, expectedOrigin) {
  if (response.status !== 200) {
    return { ok: false, error: `expected 200, received ${response.status}` };
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!/\b(?:application|text)\/xml\b/iu.test(contentType)) {
    return { ok: false, error: `unexpected content type: ${contentType}` };
  }

  if (!/<urlset\b[^>]*xmlns=["']http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9["']/iu.test(body)) {
    return { ok: false, error: "sitemap is missing the standard urlset namespace" };
  }

  let sitemapOrigin = expectedOrigin;
  if (response.url) {
    try {
      sitemapOrigin = new URL(response.url).origin;
    } catch {
      return { ok: false, error: `sitemap response uses an invalid final URL: ${response.url}` };
    }
  }

  const locations = [...body.matchAll(/<loc>([^<]+)<\/loc>/giu)].map((match) => decodeXmlText(match[1] ?? ""));
  for (const location of locations) {
    try {
      const url = new URL(location);
      if (url.origin !== sitemapOrigin) {
        return { ok: false, error: `sitemap URL uses unexpected origin: ${url.origin}` };
      }
    } catch {
      return { ok: false, error: `sitemap contains an invalid URL: ${location}` };
    }
  }

  const lastModifiedValues = [...body.matchAll(/<lastmod>([^<]+)<\/lastmod>/giu)].map((match) => match[1] ?? "");
  for (const value of lastModifiedValues) {
    if (!Number.isFinite(Date.parse(value)) || /[+-]\d{2}:\d{2}Z$/u.test(value)) {
      return { ok: false, error: `sitemap contains an invalid lastmod value: ${value}` };
    }
  }

  return { ok: true, detail: `${locations.length} sitemap URLs` };
}
