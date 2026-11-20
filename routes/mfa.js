'use strict';
const express = require('express');
const QRCode = require('qrcode');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { generateSecret, verifyTotp, otpauthUri } = require('../mfa/totp');
const { encryptSecret, decryptSecret, makeRecoveryCodes, recoveryHash, findRecoveryCode } = require('../mfa/secrets');
const {
  setUserSession, getMfaChallenge,
  clearMfaChallenge, validCsrf, safeRedirect
} = require('../mfa/session');

const router = express.Router();
router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

function profileLocked(profile) {
  return profile.mfaLockedUntil && new Date(profile.mfaLockedUntil).getTime() > Date.now();
}
function classifyCode(profile, code) {
  // A time step cannot be reused for a second sign-in / operation.
  const step = verifyTotp(decryptSecret(profile.mfaSecretEncrypted), String(code || '').trim());
  if (step !== null && step > (profile.mfaLastUsedStep ?? -1)) {
    return { type: 'totp', step };
  }
  const index = findRecoveryCode(profile.mfaRecoveryCodes, code);
  if (index !== -1) return { type: 'recovery', index };
  return null;
}
function resultUpdate(profile, result) {
  const updated = { mfaFailedAttempts: 0, mfaLockedUntil: null };
  if (result.type === 'totp') updated.mfaLastUsedStep = result.step;
  if (result.type === 'recovery') {
    updated.mfaRecoveryCodes = profile.mfaRecoveryCodes.filter((_, i) => i !== result.index);
  }
  return updated;
}
async function recordFailure(profile) {
  const attempts = (profile.mfaFailedAttempts || 0) + 1;
  await db.profile.update({ where: { id: profile.id }, data: {
    mfaFailedAttempts: attempts,
    mfaLockedUntil: attempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCK_MS) : null
  } });
}
function requireCsrf(req, res, next) {
  if (!validCsrf(req.authSession?.csrf, req.body?.csrf)) return res.status(403).send('CSRF token invalid. Refresh the form.');
  next();
}

// Password stage completed; this signed short-lived cookie is NOT an authenticated session.
router.get('/challenge', async (req, res, next) => {
  try {
    const ch = getMfaChallenge(req);
    if (!ch) return res.redirect('/auth/login');
    const profile = await db.profile.findFirst({ where: { id: ch.id } });
    if (!profile || !profile.mfaEnabled || profile.isLocked) return res.redirect('/auth/login');
    return res.render('auth/mfa-challenge', { title: 'Xác thực hai bước', csrf: ch.csrf, errors: [], locked: profileLocked(profile) });
  } catch (err) { next(err); }
});
router.post('/challenge', async (req, res, next) => {
  try {
    const ch = getMfaChallenge(req);
    if (!ch) return res.redirect('/auth/login');
    if (!validCsrf(ch.csrf, req.body?.csrf)) return res.status(403).send('CSRF token invalid.');
    const profile = await db.profile.findFirst({ where: { id: ch.id } });
    if (!profile || !profile.mfaEnabled || profile.isLocked) return res.redirect('/auth/login');
    if (profileLocked(profile)) return res.status(429).render('auth/mfa-challenge', {
      title: 'Xác thực hai bước', csrf: ch.csrf, errors: ['Quá nhiều lần thử. Vui lòng thử lại sau 15 phút.'], locked: true
    });
    const result = classifyCode(profile, req.body.code);
    if (!result) {
      await recordFailure(profile);
      return res.status(400).render('auth/mfa-challenge', {
        title: 'Xác thực hai bước', csrf: ch.csrf, errors: ['Mã xác thực hoặc mã khôi phục không hợp lệ.'], locked: false
      });
    }
    const fresh = await db.profile.update({ where: { id: profile.id }, data: {
      ...resultUpdate(profile, result), failedLoginAttempts: 0
    } });
    setUserSession(res, fresh, true);
    clearMfaChallenge(res);
    return res.redirect(safeRedirect(ch.redirectUrl));
  } catch (err) { next(err); }
});

// Account settings: authenticated users can opt into MFA.
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const profile = await db.profile.findFirst({ where: { id: req.user.id } });
    res.render('auth/mfa-settings', {
      title: 'Bảo mật tài khoản', enabled: profile.mfaEnabled,
      remainingCodes: (profile.mfaRecoveryCodes || []).length,
      csrf: req.authSession.csrf, errors: []
    });
  } catch (err) { next(err); }
});
router.post('/setup', requireAuth, requireCsrf, async (req, res, next) => {
  try {
    const profile = await db.profile.findFirst({ where: { id: req.user.id } });
    if (profile.mfaEnabled) return res.redirect('/auth/mfa');
    await db.profile.update({ where: { id: profile.id }, data: { mfaPendingSecretEncrypted: encryptSecret(generateSecret()) } });
    return res.redirect(303, '/auth/mfa/setup');
  } catch (err) { next(err); }
});
router.get('/setup', requireAuth, async (req, res, next) => {
  try {
    const profile = await db.profile.findFirst({ where: { id: req.user.id } });
    if (profile.mfaEnabled) return res.redirect('/auth/mfa');
    if (!profile.mfaPendingSecretEncrypted) return res.redirect('/auth/mfa');
    const secret = decryptSecret(profile.mfaPendingSecretEncrypted);
    const qr = await QRCode.toDataURL(otpauthUri(secret, profile.email), { errorCorrectionLevel: 'M', margin: 2, width: 230 });
    res.render('auth/mfa-setup', { title: 'Bật Google Authenticator', csrf: req.authSession.csrf, qr, secret, errors: [] });
  } catch (err) { next(err); }
});
router.post('/setup/confirm', requireAuth, requireCsrf, async (req, res, next) => {
  try {
    const profile = await db.profile.findFirst({ where: { id: req.user.id } });
    if (profile.mfaEnabled || !profile.mfaPendingSecretEncrypted) return res.redirect('/auth/mfa');
    const secret = decryptSecret(profile.mfaPendingSecretEncrypted);
    const step = verifyTotp(secret, String(req.body.code || '').trim());
    if (step === null) {
      const qr = await QRCode.toDataURL(otpauthUri(secret, profile.email), { margin: 2, width: 230 });
      return res.status(400).render('auth/mfa-setup', {
        title: 'Bật Google Authenticator', csrf: req.authSession.csrf, qr, secret,
        errors: ['Mã xác thực không đúng. Hãy đồng bộ thời gian điện thoại và thử lại.']
      });
    }
    const recoveryCodes = makeRecoveryCodes();
    const fresh = await db.profile.update({ where: { id: profile.id }, data: {
      mfaSecretEncrypted: profile.mfaPendingSecretEncrypted,
      mfaPendingSecretEncrypted: null,
      mfaEnabled: true,
      mfaRecoveryCodes: recoveryCodes.map(recoveryHash),
      mfaLastUsedStep: step,
      mfaFailedAttempts: 0,
      mfaLockedUntil: null,
      sessionVersion: (profile.sessionVersion || 0) + 1
    } });
    // Invalidate all sessions issued before enrollment.
    setUserSession(res, fresh, true);
    res.render('auth/mfa-recovery', { title: 'Mã khôi phục MFA', recoveryCodes });
  } catch (err) { next(err); }
});
router.post('/disable', requireAuth, requireCsrf, async (req, res, next) => {
  try {
    const profile = await db.profile.findFirst({ where: { id: req.user.id } });
    if (!profile.mfaEnabled) return res.redirect('/auth/mfa');
    if (profileLocked(profile)) return res.status(429).render('auth/mfa-settings', {
      title: 'Bảo mật tài khoản', enabled: true, remainingCodes: (profile.mfaRecoveryCodes || []).length,
      csrf: req.authSession.csrf, errors: ['Đã tạm khóa xác minh MFA, hãy thử lại sau 15 phút.']
    });
    const result = classifyCode(profile, req.body.code);
    if (!result) {
      await recordFailure(profile);
      return res.status(400).render('auth/mfa-settings', {
        title: 'Bảo mật tài khoản', enabled: true, remainingCodes: (profile.mfaRecoveryCodes || []).length,
        csrf: req.authSession.csrf, errors: ['Mã xác thực không hợp lệ.']
      });
    }
    const fresh = await db.profile.update({ where: { id: profile.id }, data: {
      mfaEnabled: false, mfaSecretEncrypted: null, mfaPendingSecretEncrypted: null,
      mfaRecoveryCodes: [], mfaLastUsedStep: null, mfaFailedAttempts: 0,
      mfaLockedUntil: null, sessionVersion: (profile.sessionVersion || 0) + 1
    } });
    setUserSession(res, fresh, false);
    return res.redirect(303, '/auth/mfa');
  } catch (err) { next(err); }
});

module.exports = router;
