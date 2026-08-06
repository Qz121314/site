import { Hono } from 'hono';
import { deleteCookie, setCookie } from 'hono/cookie';
import {
  derivePasswordHash,
  randomToken,
  SESSION_TTL_SECONDS,
  sha256Base64Url,
  verifyPassword,
} from '../lib/crypto';
import { errorResponse, getClientIp } from '../lib/http';
import { ADMIN_SESSION_COOKIE, requireAdminSession, requireSameOrigin } from '../middleware/admin-auth';
import {
  clearLoginAttempts,
  consumeLoginAttempt,
  createAdminSession,
  findAdminByEmail,
  revokeAdminSession,
  writeAuditLog,
} from '../repositories/admin-auth';
import type { AppEnvironment } from '../types';

const router = new Hono<AppEnvironment>();
const dummySalt = new TextEncoder().encode('service-catalog-dummy-password-salt-v1');

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

router.post('/login', requireSameOrigin, async (context) => {
  let payload: unknown;
  try {
    payload = await context.req.json();
  } catch {
    return errorResponse(context, 400, 'BAD_REQUEST', 'A valid JSON request body is required.');
  }

  if (!payload || typeof payload !== 'object') {
    return errorResponse(context, 400, 'BAD_REQUEST', 'A valid login payload is required.');
  }

  const emailValue = Reflect.get(payload, 'email');
  const passwordValue = Reflect.get(payload, 'password');
  if (typeof emailValue !== 'string' || typeof passwordValue !== 'string') {
    return errorResponse(context, 400, 'BAD_REQUEST', 'Email and password are required.');
  }

  const email = normalizeEmail(emailValue);
  const passwordBytes = new TextEncoder().encode(passwordValue).byteLength;
  if (email.length < 3 || email.length > 254 || passwordBytes < 1 || passwordBytes > 256) {
    return errorResponse(context, 400, 'BAD_REQUEST', 'The login payload is outside accepted limits.');
  }

  const now = Math.floor(Date.now() / 1000);
  const ip = getClientIp(context);
  const userAgent = context.req.header('user-agent') ?? '';
  const [rateKey, ipHash, userAgentHash] = await Promise.all([
    sha256Base64Url(`${ip}|${email}`),
    ip === 'unknown' ? Promise.resolve(null) : sha256Base64Url(ip),
    userAgent ? sha256Base64Url(userAgent) : Promise.resolve(null),
  ]);
  const rateLimit = await consumeLoginAttempt(context.env.DB, rateKey, now);
  if (!rateLimit.allowed) {
    context.header('retry-after', String(rateLimit.retryAfterSeconds));
    await writeAuditLog(context.env.DB, {
      id: crypto.randomUUID(),
      actorAdminUserId: null,
      action: 'admin.login.rate_limited',
      entityType: 'admin_session',
      entityId: null,
      requestId: context.get('requestId'),
      ipHash,
      userAgentHash,
      metadata: { emailHash: await sha256Base64Url(email) },
      createdAt: now,
    });
    return errorResponse(context, 429, 'RATE_LIMITED', 'Too many login attempts. Try again later.');
  }

  const admin = await findAdminByEmail(context.env.DB, email);
  let passwordValid = false;
  if (admin) {
    passwordValid = await verifyPassword(
      passwordValue,
      admin.password_salt,
      admin.password_hash,
      admin.password_iterations,
    );
  } else {
    await derivePasswordHash(passwordValue, dummySalt);
  }

  if (!admin || admin.status !== 'active' || !passwordValid) {
    await writeAuditLog(context.env.DB, {
      id: crypto.randomUUID(),
      actorAdminUserId: admin?.id ?? null,
      action: 'admin.login.failed',
      entityType: 'admin_session',
      entityId: null,
      requestId: context.get('requestId'),
      ipHash,
      userAgentHash,
      metadata: { reason: 'invalid_credentials', emailHash: await sha256Base64Url(email) },
      createdAt: now,
    });
    return errorResponse(context, 401, 'INVALID_CREDENTIALS', 'The email or password is incorrect.');
  }

  const sessionId = crypto.randomUUID();
  const token = randomToken();
  const tokenHash = await sha256Base64Url(token);
  const expiresAt = now + SESSION_TTL_SECONDS;
  await createAdminSession(context.env.DB, {
    id: sessionId,
    tokenHash,
    adminUserId: admin.id,
    expiresAt,
    userAgentHash,
    createdAt: now,
  });
  await clearLoginAttempts(context.env.DB, rateKey);
  await writeAuditLog(context.env.DB, {
    id: crypto.randomUUID(),
    actorAdminUserId: admin.id,
    action: 'admin.login.succeeded',
    entityType: 'admin_session',
    entityId: sessionId,
    requestId: context.get('requestId'),
    ipHash,
    userAgentHash,
    metadata: {},
    createdAt: now,
  });

  setCookie(context, ADMIN_SESSION_COOKIE, token, {
    path: '/api/admin',
    httpOnly: true,
    secure: context.env.ENVIRONMENT !== 'local',
    sameSite: 'Strict',
    maxAge: SESSION_TTL_SECONDS,
  });
  context.header('cache-control', 'no-store');

  return context.json({
    administrator: {
      id: admin.id,
      email: admin.email,
      displayName: admin.display_name,
      status: admin.status,
    },
    expiresAt,
  });
});

router.get('/session', requireAdminSession, (context) => {
  context.header('cache-control', 'no-store');
  return context.json({ administrator: context.get('adminSession') });
});

router.post('/logout', requireSameOrigin, requireAdminSession, async (context) => {
  const session = context.get('adminSession');
  const now = Math.floor(Date.now() / 1000);
  await revokeAdminSession(context.env.DB, session.sessionId, now);
  await writeAuditLog(context.env.DB, {
    id: crypto.randomUUID(),
    actorAdminUserId: session.id,
    action: 'admin.logout',
    entityType: 'admin_session',
    entityId: session.sessionId,
    requestId: context.get('requestId'),
    ipHash: null,
    userAgentHash: null,
    metadata: {},
    createdAt: now,
  });
  deleteCookie(context, ADMIN_SESSION_COOKIE, {
    path: '/api/admin',
    secure: context.env.ENVIRONMENT !== 'local',
  });
  context.header('cache-control', 'no-store');
  return context.json({ ok: true });
});

export default router;
