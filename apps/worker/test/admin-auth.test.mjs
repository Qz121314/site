import assert from 'node:assert/strict';
import test from 'node:test';
import { getAdminAuthBindings } from '../src/auth/config.ts';
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL_SECONDS,
  createAdminSessionToken,
  verifyAdminSessionToken,
} from '../src/auth/session.ts';
import app from '../src/index.ts';

function createAuthDb() {
  const state = {
    failedCount: 0,
    blockedUntil: null,
    expiresAt: null,
    auditActions: [],
  };

  return {
    state,
    prepare(sql) {
      return {
        sql,
        args: [],
        bind(...args) {
          this.args = args;
          return this;
        },
        async first() {
          if (this.sql.includes('SELECT blocked_until')) {
            return state.blockedUntil ? { blocked_until: state.blockedUntil } : null;
          }
          if (this.sql.includes('INSERT INTO admin_login_rate_limits')) {
            state.failedCount += 1;
            state.expiresAt = this.args[2];
            if (state.failedCount >= 5) state.blockedUntil = this.args.at(-1);
            return {
              failed_count: state.failedCount,
              blocked_until: state.blockedUntil,
            };
          }
          throw new Error(`Unexpected first SQL: ${this.sql}`);
        },
        async run() {
          if (this.sql.includes('DELETE FROM admin_login_rate_limits WHERE expires_at')) {
            return { success: true, meta: { changes: 0 } };
          }
          if (this.sql.includes('DELETE FROM admin_login_rate_limits WHERE key_hash')) {
            state.failedCount = 0;
            state.blockedUntil = null;
            return { success: true, meta: { changes: 1 } };
          }
          if (this.sql.includes('INSERT INTO audit_logs')) {
            state.auditActions.push(this.args[1]);
            return { success: true, meta: { changes: 1 } };
          }
          throw new Error(`Unexpected run SQL: ${this.sql}`);
        },
      };
    },
  };
}

function createEnv(db = createAuthDb()) {
  return {
    DB: db,
    ASSETS_BUCKET: {},
    ASSETS: {},
    ENVIRONMENT: 'test',
    APP_VERSION: 'test',
    ADMIN_PASSWORD: 'correct horse battery staple',
    SESSION_SECRET: '0123456789abcdef0123456789abcdef',
  };
}

function loginRequest(password, headers = {}) {
  return new Request('https://example.test/api/admin/auth/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-admin-request': '1',
      'cf-connecting-ip': '203.0.113.8',
      ...headers,
    },
    body: JSON.stringify({ password }),
  });
}

test('auth bindings reject missing, empty, and whitespace-only values', () => {
  assert.equal(getAdminAuthBindings({}), null);
  assert.equal(getAdminAuthBindings({ ADMIN_PASSWORD: '', SESSION_SECRET: 'secret' }), null);
  assert.equal(getAdminAuthBindings({ ADMIN_PASSWORD: 'password', SESSION_SECRET: '   ' }), null);
  assert.deepEqual(
    getAdminAuthBindings({ ADMIN_PASSWORD: ' password ', SESSION_SECRET: ' secret ' }),
    { adminPassword: ' password ', sessionSecret: ' secret ' },
  );
});

test('admin session token accepts the valid window and rejects tampering or expiry', async () => {
  const now = Date.UTC(2026, 7, 8, 12, 0, 0);
  const { token, session } = await createAdminSessionToken('test-secret', now);

  assert.deepEqual(await verifyAdminSessionToken(token, 'test-secret', now), session);
  assert.equal(await verifyAdminSessionToken(`${token}x`, 'test-secret', now), null);
  assert.equal(
    await verifyAdminSessionToken(token, 'test-secret', now + ADMIN_SESSION_TTL_SECONDS * 1000),
    null,
  );
});

test('admin auth routes reject unconfigured and malformed login requests', async () => {
  const db = createAuthDb();
  const unconfigured = createEnv(db);
  unconfigured.ADMIN_PASSWORD = '   ';
  const unavailable = await app.request(loginRequest('anything'), undefined, unconfigured);
  assert.equal(unavailable.status, 503);
  assert.equal((await unavailable.json()).error.code, 'AUTH_NOT_CONFIGURED');

  const env = createEnv(db);
  const missingMarker = await app.request(
    loginRequest(env.ADMIN_PASSWORD, { 'x-admin-request': '0' }),
    undefined,
    env,
  );
  assert.equal(missingMarker.status, 403);

  const invalidContentType = await app.request(
    new Request('https://example.test/api/admin/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'text/plain', 'x-admin-request': '1' },
      body: '{}',
    }),
    undefined,
    env,
  );
  assert.equal(invalidContentType.status, 400);
  assert.equal((await invalidContentType.json()).error.code, 'INVALID_CONTENT_TYPE');
});

test('successful login creates a strict HttpOnly cookie and unlocks protected routes', async () => {
  const db = createAuthDb();
  const env = createEnv(db);
  const response = await app.request(loginRequest(env.ADMIN_PASSWORD), undefined, env);

  assert.equal(response.status, 200);
  assert.equal((await response.json()).authenticated, true);
  const setCookie = response.headers.get('set-cookie') ?? '';
  assert.match(setCookie, new RegExp(`^${ADMIN_SESSION_COOKIE}=`));
  assert.match(setCookie, /HttpOnly/iu);
  assert.match(setCookie, /Secure/iu);
  assert.match(setCookie, /SameSite=Strict/iu);
  assert.equal(db.state.auditActions.includes('auth.login.succeeded'), true);

  const cookie = setCookie.split(';', 1)[0];
  const session = await app.request(
    new Request('https://example.test/api/admin/auth/session', { headers: { cookie } }),
    undefined,
    env,
  );
  assert.equal(session.status, 200);
  assert.equal((await session.json()).authenticated, true);

  const protectedHealth = await app.request(
    new Request('https://example.test/api/admin/health', { headers: { cookie } }),
    undefined,
    env,
  );
  assert.equal(protectedHealth.status, 200);
  assert.equal((await protectedHealth.json()).authenticated, true);
});

test('five failed logins trigger the persisted rate limit', async () => {
  const db = createAuthDb();
  const env = createEnv(db);

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const response = await app.request(loginRequest('wrong password'), undefined, env);
    assert.equal(response.status, 401);
  }

  const blocked = await app.request(loginRequest('wrong password'), undefined, env);
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get('retry-after'), '900');
  assert.equal((await blocked.json()).error.code, 'LOGIN_RATE_LIMITED');

  const stillBlocked = await app.request(loginRequest(env.ADMIN_PASSWORD), undefined, env);
  assert.equal(stillBlocked.status, 429);
  assert.equal(db.state.auditActions.includes('auth.login.blocked'), true);
});

test('global security headers cover API and browser responses', async () => {
  const response = await app.request('https://example.test/api/health', undefined, createEnv());

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.match(response.headers.get('content-security-policy') ?? '', /frame-ancestors 'none'/u);
});
