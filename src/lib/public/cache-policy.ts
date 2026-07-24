export const PUBLIC_EDGE_CACHE_SECONDS = 31_536_000;
export const PUBLIC_API_EDGE_CACHE_SECONDS = PUBLIC_EDGE_CACHE_SECONDS;
export const PUBLIC_DISCOVERY_EDGE_CACHE_SECONDS = 3_600;

export function publicHtmlEdgeCacheSeconds(_pathname: string): number {
  return PUBLIC_EDGE_CACHE_SECONDS;
}
