import type { SupportContactCardKind } from './support-contract';

const PHONE_PATTERN = /^\+?[0-9][0-9 ()-]{4,30}$/u;
const TELEGRAM_USERNAME_PATTERN = /^[A-Za-z0-9_]{5,32}$/u;
const PRESET_MESSAGE_LIMIT = 2000;

export function normalizeSupportPhoneValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const input = value.trim();
  if (!PHONE_PATTERN.test(input)) return null;
  const leadingPlus = input.startsWith('+');
  const digits = input.replace(/\D/gu, '');
  if (digits.length < 5 || digits.length > 18) return null;
  return `${leadingPlus ? '+' : ''}${digits}`;
}

export function normalizeSupportTelegramValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const input = value.trim();
  const username = input.startsWith('@') ? input.slice(1) : input;
  return TELEGRAM_USERNAME_PATTERN.test(username) ? username : null;
}

export function normalizeSupportLinkValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const input = value.trim();
  if (!input || input.length > 2048) return null;
  try {
    const url = new URL(input);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (!url.hostname) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function normalizeSupportPresetMessage(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') return null;
  const message = value.trim();
  if (!message || message.length > PRESET_MESSAGE_LIMIT) return null;
  return message;
}

export function normalizeSupportContactCardValue(
  kind: SupportContactCardKind,
  value: unknown,
): string | null {
  switch (kind) {
    case 'sms':
    case 'whatsapp':
      return normalizeSupportPhoneValue(value);
    case 'telegram':
      return normalizeSupportTelegramValue(value);
    case 'website':
      return normalizeSupportLinkValue(value);
  }
}

export function buildSupportContactCardHref(
  kind: SupportContactCardKind,
  value: string,
  presetMessage: string | null,
): string {
  const encodedMessage = presetMessage ? encodeURIComponent(presetMessage) : '';
  switch (kind) {
    case 'sms':
      return `sms:${value}${encodedMessage ? `?body=${encodedMessage}` : ''}`;
    case 'whatsapp': {
      const number = value.replace(/\D/gu, '');
      return `https://wa.me/${number}${encodedMessage ? `?text=${encodedMessage}` : ''}`;
    }
    case 'telegram':
      return `https://t.me/${encodeURIComponent(value)}${encodedMessage ? `?text=${encodedMessage}` : ''}`;
    case 'website':
      return value;
  }
}
