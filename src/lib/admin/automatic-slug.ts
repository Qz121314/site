import { env } from "cloudflare:workers";

function stableToken(value: string): string {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function automaticSlug(value: string, prefix: string, maxLength: number): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
  const base = normalized || `${prefix}-${stableToken(value.trim() || prefix)}`;
  return base.slice(0, maxLength).replace(/-+$/gu, "") || `${prefix}-${stableToken(value)}`.slice(0, maxLength);
}

async function uniqueSlug(input: {
  base: string;
  maxLength: number;
  exists: (candidate: string) => Promise<boolean>;
}): Promise<string> {
  for (let index = 1; index <= 1000; index += 1) {
    const suffix = index === 1 ? "" : `-${index}`;
    const candidate = `${input.base.slice(0, Math.max(1, input.maxLength - suffix.length))}${suffix}`;
    if (!(await input.exists(candidate))) return candidate;
  }
  return `${input.base.slice(0, Math.max(1, input.maxLength - 9))}-${crypto.randomUUID().slice(0, 8)}`;
}

export function uniqueChannelSlug(name: string, excludeId: string | null = null): Promise<string> {
  const base = automaticSlug(name, "section", 64);
  return uniqueSlug({
    base,
    maxLength: 64,
    exists: async (candidate) => Boolean(await env.DB.prepare(
      "SELECT id FROM channels WHERE slug = ?1 AND (?2 IS NULL OR id <> ?2)",
    ).bind(candidate, excludeId).first<{ id: string }>()),
  });
}

export function uniqueFilterSlug(channelId: string, name: string, excludeId: string | null = null): Promise<string> {
  const base = automaticSlug(name, "filter", 64);
  return uniqueSlug({
    base,
    maxLength: 64,
    exists: async (candidate) => Boolean(await env.DB.prepare(
      "SELECT id FROM category_filters WHERE channel_id = ?1 AND slug = ?2 AND (?3 IS NULL OR id <> ?3)",
    ).bind(channelId, candidate, excludeId).first<{ id: string }>()),
  });
}

export function uniqueProductSlug(channelId: string, title: string, excludeId: string | null = null): Promise<string> {
  const base = automaticSlug(title, "product", 96);
  return uniqueSlug({
    base,
    maxLength: 96,
    exists: async (candidate) => Boolean(await env.DB.prepare(
      "SELECT id FROM products WHERE channel_id = ?1 AND slug = ?2 AND (?3 IS NULL OR id <> ?3)",
    ).bind(channelId, candidate, excludeId).first<{ id: string }>()),
  });
}
