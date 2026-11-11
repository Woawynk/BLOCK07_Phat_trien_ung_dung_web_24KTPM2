const prisma = require('../db');

/**
 * Middleware trích xuất thông tin người dùng từ Cookie
 */
async function authMiddleware(req, res, next) {
  try {
    const rawUser = req.cookies?.user_session;
    if (rawUser) {
      const parsedUser = JSON.parse(rawUser);
      req.user = parsedUser;
      res.locals.user = parsedUser;
      res.locals.isManager = parsedUser.email?.toLowerCase() === (process.env.MANAGER_EMAIL || '').toLowerCase();
    } else {
      req.user = null;
      res.locals.user = null;
      res.locals.isManager = false;
    }
  } catch (err) {
    req.user = null;
    res.locals.user = null;
    res.locals.isManager = false;
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

/**
 * Yêu cầu quyền Quản trị viên (Chỉ DUY NHẤT 1 email Manager được cấu hình mới có quyền)
 */
function requireManager(req, res, next) {
  const managerEmail = (process.env.MANAGER_EMAIL || '').trim().toLowerCase();

  // Kiểm tra đã đăng nhập chưa
  if (!req.user) {
    return res.redirect('/auth/login?redirect=' + encodeURIComponent(req.originalUrl));
  }

  // So khớp email với MANAGER_EMAIL duy nhất
  const userEmail = (req.user.email || '').trim().toLowerCase();
  if (userEmail !== managerEmail) {
    return res.status(403).render('403', {
      title: '403 - Quyền Quản Trị Bị Từ Chối',
      userEmail,
      managerEmail,
      message: 'Chỉ email duy nhất của Manager mới có quyền truy cập vào khu vực quản trị này.'
    });
  }

  next();
}

module.exports = {
  authMiddleware,
  requireAuth,
  requireManager
};
