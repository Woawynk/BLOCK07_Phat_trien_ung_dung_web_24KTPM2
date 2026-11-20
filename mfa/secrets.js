'use strict';
const crypto = require('node:crypto');
function encryptionKey() {
  const value = process.env.MFA_ENCRYPTION_KEY || '';
  if (!/^[a-f0-9]{64}$/i.test(value)) {
    throw new Error('MFA_ENCRYPTION_KEY must be a random 64-character hex string (32 bytes).');
  }
  return Buffer.from(value, 'hex');
}
function encryptSecret(secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return `v1:${iv.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${ciphertext.toString('base64url')}`;
}
function decryptSecret(value) {
  const [version, iv, tag, ciphertext] = String(value || '').split(':');
  if (version !== 'v1' || !iv || !tag || !ciphertext) throw new Error('Invalid MFA ciphertext');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8');
}
function makeRecoveryCodes() {
  return Array.from({ length: 8 }, () => crypto.randomBytes(10).toString('hex').toUpperCase().match(/.{1,5}/g).join('-'));
}
function recoveryHash(code) {
  return crypto.createHash('sha256').update(code.toUpperCase().replace(/-/g, '')).digest('hex');
}
function findRecoveryCode(hashes, supplied) {
  const normalized = String(supplied || '').trim().toUpperCase().replace(/-/g, '');
  if (!/^[A-F0-9]{20}$/.test(normalized)) return -1;
  const digest = Buffer.from(recoveryHash(normalized), 'hex');
  const list = Array.isArray(hashes) ? hashes : [];
  // Evaluate every entry, rather than early-returning on matches.
  let found = -1;
  for (let i = 0; i < list.length; i++) {
    if (/^[a-f0-9]{64}$/i.test(list[i]) && crypto.timingSafeEqual(Buffer.from(list[i], 'hex'), digest)) {
      found = i;
    }
  }
  return found;
}
module.exports = { assertMfaEncryptionKey: encryptionKey, encryptSecret, decryptSecret, makeRecoveryCodes, recoveryHash, findRecoveryCode };
