import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldNotifyAdminMutation } from '../src/admin-fetch.ts';

test('successful business mutations are eligible for admin change notification', () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    assert.equal(shouldNotifyAdminMutation(method, '/api/admin/sections/abc/products'), true, method);
  }
});

test('read requests never notify', () => {
  assert.equal(shouldNotifyAdminMutation('GET', '/api/admin/assets/library/page'), false);
  assert.equal(shouldNotifyAdminMutation('HEAD', '/api/admin/settings/'), false);
});

test('auth, publish, probes and preview-only imports stay excluded', () => {
  assert.equal(shouldNotifyAdminMutation('POST', '/api/admin/auth/login'), false);
  assert.equal(shouldNotifyAdminMutation('POST', '/api/admin/auth/logout'), false);
  assert.equal(shouldNotifyAdminMutation('POST', '/api/admin/publish'), false);
  assert.equal(shouldNotifyAdminMutation('POST', '/api/admin/publish/rollback'), false);
  assert.equal(shouldNotifyAdminMutation('POST', '/api/admin/settings/media-domain/test'), false);
  assert.equal(shouldNotifyAdminMutation('POST', '/api/admin/theme/import'), false);
});

test('non-admin mutation paths do not notify', () => {
  assert.equal(shouldNotifyAdminMutation('POST', '/api/public/contact'), false);
  assert.equal(shouldNotifyAdminMutation('DELETE', '/other/path'), false);
});
