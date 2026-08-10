import test from 'node:test';
import assert from 'node:assert/strict';
import {
  shouldNotifyAdminMutation,
  shouldNotifyAdminSessionExpired,
} from '../src/admin-fetch.ts';

test('published storefront source mutations notify the dashboard', () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    assert.equal(
      shouldNotifyAdminMutation(method, '/api/admin/sections/abc/products'),
      true,
      method,
    );
  }

  assert.equal(shouldNotifyAdminMutation('PUT', '/api/admin/settings/'), true);
  assert.equal(shouldNotifyAdminMutation('POST', '/api/admin/media/logo'), true);
  assert.equal(shouldNotifyAdminMutation('POST', '/api/admin/faqs'), true);
  assert.equal(
    shouldNotifyAdminMutation('POST', '/api/admin/sections/batch-delete'),
    true,
  );
  assert.equal(
    shouldNotifyAdminMutation('POST', '/api/admin/sections/abc/categories'),
    true,
  );
  assert.equal(shouldNotifyAdminMutation('POST', '/api/admin/sections/abc/tags'), true);
});

test('read requests never notify', () => {
  assert.equal(shouldNotifyAdminMutation('GET', '/api/admin/assets/library/page'), false);
  assert.equal(shouldNotifyAdminMutation('HEAD', '/api/admin/settings/'), false);
});

test('mutations outside immutable publish sources do not trigger a publish-status refresh', () => {
  assert.equal(shouldNotifyAdminMutation('POST', '/api/admin/auth/login'), false);
  assert.equal(shouldNotifyAdminMutation('POST', '/api/admin/auth/logout'), false);
  assert.equal(shouldNotifyAdminMutation('POST', '/api/admin/publish'), false);
  assert.equal(shouldNotifyAdminMutation('POST', '/api/admin/publish/rollback'), false);
  assert.equal(
    shouldNotifyAdminMutation('POST', '/api/admin/settings/media-domain/test'),
    false,
  );
  assert.equal(shouldNotifyAdminMutation('POST', '/api/admin/theme/import'), false);
  assert.equal(shouldNotifyAdminMutation('PUT', '/api/admin/theme/'), false);
  assert.equal(shouldNotifyAdminMutation('POST', '/api/admin/assets/upload'), false);
  assert.equal(shouldNotifyAdminMutation('POST', '/api/admin/assets/folders'), false);
  assert.equal(shouldNotifyAdminMutation('POST', '/api/admin/customer-service'), false);
  assert.equal(
    shouldNotifyAdminMutation('POST', '/api/admin/sections/abc/conversion-groups'),
    false,
  );
  assert.equal(
    shouldNotifyAdminMutation(
      'POST',
      '/api/admin/sections/abc/conversion-groups/group-1/rotate-preview',
    ),
    false,
  );
});

test('non-admin mutation paths do not notify', () => {
  assert.equal(shouldNotifyAdminMutation('POST', '/api/public/contact'), false);
  assert.equal(shouldNotifyAdminMutation('DELETE', '/other/path'), false);
});

test('unauthorized business admin responses expire the active session globally', () => {
  assert.equal(
    shouldNotifyAdminSessionExpired(401, '/api/admin/assets/library/page'),
    true,
  );
  assert.equal(
    shouldNotifyAdminSessionExpired(401, '/api/admin/sections/abc/products'),
    true,
  );
});

test('auth endpoints and non-401 responses do not emit session expiry', () => {
  assert.equal(shouldNotifyAdminSessionExpired(401, '/api/admin/auth/login'), false);
  assert.equal(shouldNotifyAdminSessionExpired(401, '/api/admin/auth/session'), false);
  assert.equal(shouldNotifyAdminSessionExpired(403, '/api/admin/sections'), false);
  assert.equal(shouldNotifyAdminSessionExpired(500, '/api/admin/sections'), false);
  assert.equal(shouldNotifyAdminSessionExpired(401, '/api/public/theme'), false);
});
