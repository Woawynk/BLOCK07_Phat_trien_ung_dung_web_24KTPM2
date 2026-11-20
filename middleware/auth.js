const prisma = require('../db');
const { can } = require('./permissions');
const { canDish } = require('./abac');

/**
 * Signed, expiring, DB-backed sessions. An unsigned cookie MUST NOT grant access.
 * sessionVersion is incremented when MFA is enabled/disabled to revoke old cookies.
 */
async function authMiddleware(req, res, next) {
  req.user = null;
  req.authSession = null;
  res.locals.user = null;
  res.locals.isManager = false;
  res.locals.can = can;
  res.locals.canDish = canDish;
  try {
    const { parseCookie, SESSION_TTL } = require('../mfa/session');
    const session = parseCookie(req.signedCookies?.user_session);
    if (!session || typeof session.id !== 'string' || typeof session.csrf !== 'string' ||
        !Number.isFinite(session.issuedAt) || session.issuedAt > Date.now() ||
        Date.now() - session.issuedAt > SESSION_TTL) return next();

    const profile = await prisma.profile.findFirst({ where: { id: session.id } });
    if (!profile || profile.isLocked ||
        (profile.sessionVersion || 0) !== session.version ||
        (profile.mfaEnabled && session.mfaVerified !== true)) return next();

    const user = {
      id: profile.id, email: profile.email, username: profile.username,
      role: profile.role,
      allowedCategories: Array.isArray(profile.allowedCategories) ? profile.allowedCategories : []
    };
    req.user = user;
    req.authSession = session;
    res.locals.user = user;
    res.locals.isManager = profile.role === 'manager';
  } catch (err) {
    console.error('Session verification failed:', err.message);
  }
  next();
}

/**
 * Yêu cầu người dùng phải đăng nhập
 */
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.redirect('/auth/login?redirect=' + encodeURIComponent(req.originalUrl));
  }
  next();
}

// Legacy compatibility. New admin routes use operation-specific permissions.
// A true manager is defined by their trusted database role, never by email/cookie.
function requireManager(req, res, next) {
  if (!req.user) {
    return res.redirect('/auth/login?redirect=' + encodeURIComponent(req.originalUrl));
  }
  if (req.user.role !== 'manager') {
    return res.status(403).render('403', {
      title: '403 - Không có quyền truy cập',
      userEmail: req.user.email,
      message: 'Chỉ quản lý có quyền thực hiện thao tác này.'
    });
  }
  next();
}

module.exports = {
  authMiddleware,
  requireAuth,
  requireManager
};
