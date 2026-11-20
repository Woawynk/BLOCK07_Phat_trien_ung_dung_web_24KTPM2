'use strict';
// RFC 4226 / RFC 6238, SHA-1, 6-digit TOTP, 30-second period.
const crypto = require('node:crypto');
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function toBase32(bytes) {
  let bits = 0;
  let value = 0;
  let result = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      result += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) result += BASE32[(value << (5 - bits)) & 31];
  return result;
}

function fromBase32(input) {
  const secret = String(input).toUpperCase().replace(/=+$/g, '');
  if (!secret || /[^A-Z2-7]/.test(secret)) throw new Error('Invalid base32 secret');
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const char of secret) {
    value = (value << 5) | BASE32.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function generateSecret() {
  return toBase32(crypto.randomBytes(20));
}

function hotp(secret, step) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const mac = crypto.createHmac('sha1', fromBase32(secret)).update(counter).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const value = (mac.readUInt32BE(offset) & 0x7fffffff) % 1000000;
  return String(value).padStart(6, '0');
}

/** Returns matching time-step or null. A null result must not be accepted. */
function verifyTotp(secret, userCode, now = Date.now()) {
  if (typeof userCode !== 'string' || !/^\d{6}$/.test(userCode)) return null;
  const timeStep = Math.floor(now / 30000);
  for (const step of [timeStep - 1, timeStep, timeStep + 1]) {
    if (step >= 0) {
      const a = Buffer.from(hotp(secret, step));
      const b = Buffer.from(userCode);
      if (crypto.timingSafeEqual(a, b)) return step;
    }
  }
  return null;
}

function otpauthUri(secret, email) {
  const issuer = 'Bep Viet Restaurant';
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}` +
    `?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

module.exports = { toBase32, fromBase32, generateSecret, hotp, verifyTotp, otpauthUri };
