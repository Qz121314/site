export const MAX_PUBLIC_SEARCH_QUERY_BYTES = 48;

export function normalizePublicSearchQuery(value: string): string {
  const input = value.trim();
  const encoder = new TextEncoder();
  let output = "";
  let bytes = 0;

  for (const character of input) {
    const length = encoder.encode(character).byteLength;
    if (bytes + length > MAX_PUBLIC_SEARCH_QUERY_BYTES) break;
    output += character;
    bytes += length;
  }

  return output;
}
