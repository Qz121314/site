const STORAGE_KEY = 'site-support-visitor-v1';
const VISITOR_TTL_MS = 24 * 60 * 60 * 1000;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';

export type SupportVisitorIdentity = {
  visitorId: string;
  expiresAt: number;
};

let volatileIdentity: SupportVisitorIdentity | null = null;

function randomIndex(length: number): number {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return (values[0] ?? 0) % length;
}

function randomCharacter(source: string): string {
  return source[randomIndex(source.length)] ?? source[0] ?? '';
}

/**
 * Exactly six characters: three A-Z letters and three digits, shuffled.
 * Example shape: A7C2D9. This is the user's short-lived display/session ID,
 * not an account or login identity.
 */
export function generateSupportVisitorId(): string {
  const characters = [
    randomCharacter(LETTERS),
    randomCharacter(LETTERS),
    randomCharacter(LETTERS),
    randomCharacter(DIGITS),
    randomCharacter(DIGITS),
    randomCharacter(DIGITS),
  ];
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1);
    const current = characters[index] ?? '';
    const swap = characters[swapIndex] ?? '';
    characters[index] = swap;
    characters[swapIndex] = current;
  }
  return characters.join('');
}

function isValidIdentity(value: unknown, now: number): value is SupportVisitorIdentity {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const candidate = value as Partial<SupportVisitorIdentity>;
  if (
    typeof candidate.visitorId !== 'string' ||
    typeof candidate.expiresAt !== 'number' ||
    !Number.isFinite(candidate.expiresAt) ||
    candidate.expiresAt <= now ||
    candidate.expiresAt - now > VISITOR_TTL_MS
  ) {
    return false;
  }
  if (!/^[A-Z0-9]{6}$/u.test(candidate.visitorId)) return false;
  const letters = [...candidate.visitorId].filter((character) => /[A-Z]/u.test(character)).length;
  const digits = [...candidate.visitorId].filter((character) => /[0-9]/u.test(character)).length;
  return letters === 3 && digits === 3;
}

function readStoredIdentity(now: number): SupportVisitorIdentity | null {
  if (typeof window === 'undefined') return volatileIdentity && isValidIdentity(volatileIdentity, now)
    ? volatileIdentity
    : null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isValidIdentity(parsed, now)) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return volatileIdentity && isValidIdentity(volatileIdentity, now) ? volatileIdentity : null;
  }
}

function persistIdentity(identity: SupportVisitorIdentity) {
  volatileIdentity = identity;
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  } catch {
    // Private browsing/storage restrictions should not block Messages.
  }
}

export function getSupportVisitorIdentity(now = Date.now()): SupportVisitorIdentity {
  const existing = readStoredIdentity(now);
  if (existing) return existing;
  const created: SupportVisitorIdentity = {
    visitorId: generateSupportVisitorId(),
    expiresAt: now + VISITOR_TTL_MS,
  };
  persistIdentity(created);
  return created;
}

export const SUPPORT_VISITOR_TTL_MS = VISITOR_TTL_MS;
