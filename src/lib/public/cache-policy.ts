export const PUBLIC_API_EDGE_CACHE_SECONDS = 30;

export function publicHtmlEdgeCacheSeconds(pathname: string): number {
  if (pathname === "/" || pathname === "/privacy" || pathname === "/disclaimer") return 300;

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 1) return 120;
  return 30;
}
