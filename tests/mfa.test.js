'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { toBase32, fromBase32, generateSecret, hotp, verifyTotp, otpauthUri } = require('../mfa/totp');
const { encryptSecret, decryptSecret, makeRecoveryCodes, recoveryHash, findRecoveryCode } = require('../mfa/secrets');
const { safeRedirect, validCsrf, parseCookie, setUserSession, getMfaChallenge, setMfaChallenge } = require('../mfa/session');

process.env.MFA_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
process.env.SESSION_SECRET = crypto.randomBytes(32).toString('hex');

test('RFC 6238 six-digit TOTP test vector, 59 seconds', () => {
  const key = toBase32(Buffer.from('12345678901234567890'));
  assert.equal(hotp(key, 1), '287082');
  assert.equal(verifyTotp(key, '287082', 59000), 1);
  assert.equal(verifyTotp(key, '000000', 59000), null);
  assert.deepEqual(fromBase32(key), Buffer.from('12345678901234567890'));
});
test('enrollment generates Google Authenticator URI and securely encrypted secret', () => {
  const secret = generateSecret();
  assert.equal(fromBase32(secret).length, 20);
  assert.match(otpauthUri(secret, 'a@example.com'), /^otpauth:\/\/totp\//);
  const encrypted = encryptSecret(secret);
  assert.ok(!encrypted.includes(secret));
  assert.equal(decryptSecret(encrypted), secret);
  const damaged = encrypted.split(':');
  damaged[3] = (damaged[3].startsWith('A') ? 'B' : 'A') + damaged[3].slice(1);
  assert.throws(() => decryptSecret(damaged.join(':')));
});
test('one-time backup recovery codes are hashed and verifiable', () => {
  const codes = makeRecoveryCodes();
  const digests = codes.map(recoveryHash);
  assert.equal(codes.length, 8);
  assert.equal(new Set(codes).size, 8);
  assert.equal(findRecoveryCode(digests, codes[2]), 2);
  assert.equal(findRecoveryCode(digests.filter((_, i) => i !== 2), codes[2]), -1);
});
test('signed session and MFA challenge have no privileged raw cookies', () => {
  const cookies = [];
  const res = { cookie: (name, payload, options) => cookies.push({ name, payload, options }) };
  setUserSession(res, { id: '123', sessionVersion: 3 }, true);
  setMfaChallenge(res, { id: '123' }, '//evil.com');
  assert.equal(cookies[0].options.signed, true);
  assert.equal(cookies[1].options.signed, true);
  assert.equal(JSON.parse(cookies[1].payload).redirectUrl, '/dishes');
  const challenge = getMfaChallenge({ signedCookies: { mfa_challenge: cookies[1].payload } });
  assert.equal(challenge.id, '123');
  assert.equal(parseCookie('{bad'), null);
});
test('CSRF and relative redirect validation', () => {
  const csrf = crypto.randomBytes(32).toString('hex');
  assert.equal(validCsrf(csrf, csrf), true);
  assert.equal(validCsrf(csrf, '00'.repeat(32)), false);
  assert.equal(safeRedirect('//evil.com'), '/dishes');
  assert.equal(safeRedirect('/\\evil'), '/dishes');
  assert.equal(safeRedirect('/admin'), '/admin');
});
