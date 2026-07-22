function normalize(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("en");
}

function scoreValue(value: string, query: string): number {
  const candidate = normalize(value);
  if (!candidate) return 5;
  if (candidate === query) return 0;
  if (candidate.startsWith(query)) return 1;
  if (candidate.split(/[^\p{L}\p{N}]+/u).some((part) => part.startsWith(query))) return 2;
  if (candidate.includes(query)) return 3;
  return 5;
}

export function rankSearchResults<T>(
  items: readonly T[],
  query: string,
  values: (item: T) => readonly string[],
): T[] {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return [...items];

  return items
    .map((item, index) => ({
      item,
      index,
      score: Math.min(
        ...values(item).map((value, valueIndex) => scoreValue(value, normalizedQuery) + valueIndex * 4),
      ),
    }))
    .sort((left, right) => left.score - right.score || left.index - right.index)
    .map(({ item }) => item);
}
