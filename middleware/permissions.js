'use strict';

// Explicit, non-hierarchical privileges: an editor cannot delete and a deleter cannot edit.
const ROLE_PERMISSIONS = Object.freeze({
  manager: Object.freeze(['view', 'create', 'edit', 'delete']),
  editor: Object.freeze(['view', 'edit']),
  deleter: Object.freeze(['view', 'delete']),
  user: Object.freeze([])
});

function can(role, permission) {
  return Object.prototype.hasOwnProperty.call(ROLE_PERMISSIONS, role) &&
    ROLE_PERMISSIONS[role].includes(permission);
}

function requirePermission(permission) {
  if (!['view', 'create', 'edit', 'delete'].includes(permission)) {
    throw new Error(`Unknown permission: ${permission}`);
  }
  return (req, res, next) => {
    if (!req.user) {
      return res.redirect('/auth/login?redirect=' + encodeURIComponent(req.originalUrl));
    }
    // req.user must be populated from a verified session and a fresh DB profile.
    if (!can(req.user.role, permission)) {
      return res.status(403).render('403', {
        title: '403 - Không có quyền truy cập',
        userEmail: req.user.email,
        message: 'Bạn không có quyền thực hiện thao tác này.'
      });
    }
    next();
  };
}

module.exports = { ROLE_PERMISSIONS, can, requirePermission };
