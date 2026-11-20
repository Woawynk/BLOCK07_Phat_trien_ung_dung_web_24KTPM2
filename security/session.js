'use strict';

// Used ONLY when installing RBAC on the ORIGINAL (non-MFA) repository.
// When MFA is installed first, its signed, DB-backed session module stays in place.
const COOKIE_NAME = 'user_session';
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;

function checkSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || Buffer.byteLength(secret, 'utf8') < 32 ||
      secret === 'super-secret-restaurant-key' || secret === 'secret-key' ||
      secret.startsWith('REPLACE_WITH_')) {
    throw new Error('SESSION_SECRET must be a random secret of at least 32 bytes. See README_RBAC.md.');
  }
  return secret;
}

function parseUserSession(req) {
  const raw = req.signedCookies?.[COOKIE_NAME];
  if (typeof raw !== 'string') return null;
  try {
    const session = JSON.parse(raw);
    if (!session || typeof session.id !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(session.id) ||
        typeof session.issuedAt !== 'number' || !Number.isSafeInteger(session.issuedAt) ||
        session.issuedAt > Date.now() || Date.now() - session.issuedAt > SESSION_TTL) return null;
    return session;
  } catch (_) {
    return null;
  }
}

function setUserSession(res, id) {
  const payload = JSON.stringify({ id, issuedAt: Date.now() });
  res.cookie(COOKIE_NAME, payload, {
    signed: true, httpOnly: true, sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_TTL, path: '/'
  });
}

function safeRedirect(path) {
  return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') &&
    !path.includes('\\') && !/[\x00-\x1f\x7f]/.test(path)
    ? path : '/dishes';
}

module.exports = { COOKIE_NAME, SESSION_TTL, checkSessionSecret, parseUserSession, setUserSession, safeRedirect };
