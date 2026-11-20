'use strict';
const crypto = require('node:crypto');
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;
const CHALLENGE_TTL = 5 * 60 * 1000;

function checkSessionSecret() {
  const key = process.env.SESSION_SECRET || '';
  if (key.length < 32 || key === 'super-secret-restaurant-key') {
    throw new Error('SESSION_SECRET must be a strong random string of at least 32 characters.');
  }
  return key;
}
function cookieOptions(maxAge) {
  return { signed: true, httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge };
}
function clearOptions() {
  return { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' };
}
function safeRedirect(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') || /[\r\n]/.test(value)) return '/dishes';
  return value;
}
function parseCookie(raw) {
  if (typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch { return null; }
}
function setUserSession(res, profile, mfaVerified) {
  const payload = {
    id: profile.id,
    version: profile.sessionVersion || 0,
    mfaVerified: Boolean(mfaVerified),
    issuedAt: Date.now(),
    csrf: crypto.randomBytes(32).toString('hex')
  };
  res.cookie('user_session', JSON.stringify(payload), cookieOptions(SESSION_TTL));
  return payload;
}
function setMfaChallenge(res, profile, redirectUrl) {
  const payload = {
    id: profile.id,
    expiresAt: Date.now() + CHALLENGE_TTL,
    redirectUrl: safeRedirect(redirectUrl),
    csrf: crypto.randomBytes(32).toString('hex')
  };
  res.cookie('mfa_challenge', JSON.stringify(payload), cookieOptions(CHALLENGE_TTL));
}
function getMfaChallenge(req) {
  const challenge = parseCookie(req.signedCookies?.mfa_challenge);
  if (!challenge || typeof challenge.id !== 'string' || typeof challenge.csrf !== 'string' ||
      !Number.isFinite(challenge.expiresAt) || Date.now() > challenge.expiresAt) return null;
  return challenge;
}
function clearUserSession(res) { res.clearCookie('user_session', clearOptions()); }
function clearMfaChallenge(res) { res.clearCookie('mfa_challenge', clearOptions()); }
function validCsrf(expected, supplied) {
  if (typeof expected !== 'string' || !/^[a-f0-9]{64}$/.test(expected) ||
      typeof supplied !== 'string' || !/^[a-f0-9]{64}$/.test(supplied)) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(supplied, 'hex'));
}
module.exports = {
  checkSessionSecret, cookieOptions, clearOptions, safeRedirect, parseCookie,
  setUserSession, setMfaChallenge, getMfaChallenge, clearUserSession, clearMfaChallenge, validCsrf,
  SESSION_TTL
};
