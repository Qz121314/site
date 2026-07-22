export const PUBLIC_EDGE_CACHE_SECONDS = 31_536_000;
export const PUBLIC_API_EDGE_CACHE_SECONDS = PUBLIC_EDGE_CACHE_SECONDS;

export function publicHtmlEdgeCacheSeconds(_pathname: string): number {
  return PUBLIC_EDGE_CACHE_SECONDS;
}
