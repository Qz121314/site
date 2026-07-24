export const PUBLIC_SEARCH_QUERY_MAX_BYTES = 48;

export function normalizePublicSearchQuery(value: string): string {
  const encoder = new TextEncoder();
  let output = "";
  let bytes = 0;

  for (const character of value.trim()) {
    const length = encoder.encode(character).byteLength;
    if (bytes + length > PUBLIC_SEARCH_QUERY_MAX_BYTES) break;
    output += character;
    bytes += length;
  }

  return output;
}
