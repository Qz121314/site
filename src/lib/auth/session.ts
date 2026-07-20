const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const SESSION_COOKIE = "site_admin_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 12;

type SessionPayload = {
  issuedAt: number;
  expiresAt: number;
  nonce: string;
};

function bytesToBase64Url(bytes: Uint8Array<ArrayBufferLike>): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function safeCompareText(candidate: string, expected: string): Promise<boolean> {
  const [candidateHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(candidate)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const candidateBytes = new Uint8Array(candidateHash);
  const expectedBytes = new Uint8Array(expectedHash);
  let difference = candidateBytes.length ^ expectedBytes.length;
  const length = Math.max(candidateBytes.length, expectedBytes.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (candidateBytes[index] ?? 0) ^ (expectedBytes[index] ?? 0);
  }
  return difference === 0;
}

export async function createSessionToken(secret: string, now = Date.now()): Promise<string> {
  const payload: SessionPayload = {
    issuedAt: now,
    expiresAt: now + SESSION_TTL_SECONDS * 1000,
    nonce: crypto.randomUUID(),
  };
  const payloadPart = bytesToBase64Url(encoder.encode(JSON.stringify(payload)));
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadPart));
  return `${payloadPart}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

export async function verifySessionToken(token: string, secret: string, now = Date.now()): Promise<boolean> {
  const [payloadPart, signaturePart, extra] = token.split(".");
  if (!payloadPart || !signaturePart || extra) return false;

  try {
    const key = await importHmacKey(secret);
    const validSignature = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlToBytes(signaturePart),
      encoder.encode(payloadPart),
    );
    if (!validSignature) return false;

    const payload = JSON.parse(decoder.decode(base64UrlToBytes(payloadPart))) as Partial<SessionPayload>;
    return (
      typeof payload.issuedAt === "number" &&
      typeof payload.expiresAt === "number" &&
      typeof payload.nonce === "string" &&
      payload.issuedAt <= now &&
      payload.expiresAt > now
    );
  } catch {
    return false;
  }
}

export function readCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const pair of cookieHeader.split(";")) {
    const separator = pair.indexOf("=");
    if (separator < 0) continue;
    const key = pair.slice(0, separator).trim();
    if (key === name) return decodeURIComponent(pair.slice(separator + 1).trim());
  }
  return null;
}

export function sessionCookie(token: string, secure: boolean): string {
  const attributes = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ];
  if (secure) attributes.push("Secure");
  return attributes.join("; ");
}

export function clearSessionCookie(secure: boolean): string {
  const attributes = [`${SESSION_COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Strict", "Max-Age=0"];
  if (secure) attributes.push("Secure");
  return attributes.join("; ");
}

export function isSameOriginPost(request: Request): boolean {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("Origin");
  if (origin) return origin === requestUrl.origin;
  const referer = request.headers.get("Referer");
  return referer ? new URL(referer).origin === requestUrl.origin : false;
}
