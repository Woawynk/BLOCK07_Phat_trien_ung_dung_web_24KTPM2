'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { can, requirePermission } = require('../middleware/permissions');

const expected = {
  manager: ['view', 'create', 'edit', 'delete'],
  editor: ['view', 'edit'],
  deleter: ['view', 'delete'],
  user: []
};

test('full non-hierarchical permission matrix', () => {
  for (const [role, allowed] of Object.entries(expected)) {
    for (const action of ['view', 'create', 'edit', 'delete']) {
      assert.equal(can(role, action), allowed.includes(action), `${role}:${action}`);
    }
  }
  assert.equal(can('hacker', 'delete'), false);
  assert.equal(can('__proto__', 'view'), false);
  assert.equal(can(null, 'view'), false);
});

test('middleware rejects anonymous users and unauthorized mutations', () => {
  const mkResponse = () => ({
    redirect(path) { this.redirected = path; return this; },
    status(code) { this.statusCode = code; return this; },
    render(view, props) { this.view = view; this.props = props; return this; }
  });
  let called = 0;
  let res = mkResponse();
  requirePermission('edit')({ user: null, originalUrl: '/admin/dishes/5/edit' }, res, () => called++);
  assert.match(res.redirected, /^\/auth\/login\?redirect=/);
  assert.equal(called, 0);

  res = mkResponse();
  requirePermission('delete')({ user: { role: 'editor', email: 'e@example.com' } }, res, () => called++);
  assert.equal(res.statusCode, 403);
  assert.equal(res.view, '403');
  assert.equal(called, 0);

  res = mkResponse();
  requirePermission('edit')({ user: { role: 'editor' } }, res, () => called++);
  assert.equal(called, 1);
});

test('unknown permissions fail at configuration time', () => {
  assert.throws(() => requirePermission('superadmin'), /Unknown permission/);
});

// Original-repo only: the MFA-patched project has its own signed session implementation.
try {
  const session = require('../security/session');
  test('original-repo sessions validate timestamps and redirects', () => {
    const id = '123e4567-e89b-12d3-a456-426614174000';
    const valid = { signedCookies: { user_session: JSON.stringify({ id, issuedAt: Date.now() }) } };
    assert.equal(session.parseUserSession(valid)?.id, id);
    assert.equal(session.parseUserSession({ cookies: valid.signedCookies }), null);
    assert.equal(session.parseUserSession({ signedCookies: { user_session: 'tampered' } }), null);
    assert.equal(session.parseUserSession({ signedCookies: { user_session: JSON.stringify({ id, issuedAt: Date.now() - session.SESSION_TTL - 1 }) } }), null);
    assert.equal(session.safeRedirect('/admin/dishes'), '/admin/dishes');
    assert.equal(session.safeRedirect('//evil.com'), '/dishes');
    assert.equal(session.safeRedirect('/\\evil.com'), '/dishes');
    assert.equal(session.safeRedirect('https://evil.com'), '/dishes');
  });
  test('weak session secrets rejected', () => {
    const previous = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = 'secret-key';
    assert.throws(() => session.checkSessionSecret(), /SESSION_SECRET/);
    process.env.SESSION_SECRET = 'a'.repeat(64);
    assert.equal(session.checkSessionSecret(), 'a'.repeat(64));
    if (previous === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = previous;
  });
} catch (err) {
  if (err.code !== 'MODULE_NOT_FOUND') throw err;
}
