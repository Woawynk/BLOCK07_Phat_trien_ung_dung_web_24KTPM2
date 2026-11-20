'use strict';

// Simple ABAC on dishes, applied AFTER the existing RBAC guard.
// - Manager: edit/delete any dish.
// - Editor: edit a dish only when its CURRENT and REQUESTED category are assigned.
// - Deleter: delete only UNAVAILABLE dishes in assigned categories.
// - Others: denied. No category assignment grants a role by itself.
// Chef and ingredient routes keep their existing RBAC permissions.

function normalizeCategory(value) {
  return typeof value === 'string' ? value.normalize('NFC').trim() : '';
}

function hasCategory(user, category) {
  const target = normalizeCategory(category);
  return Boolean(target) && Array.isArray(user?.allowedCategories) &&
    user.allowedCategories.some(item => normalizeCategory(item) === target);
}

function canDish(user, action, dish, requestedCategory) {
  if (!user || !dish || !['edit', 'delete'].includes(action)) return false;
  if (user.role === 'manager') return true;
  if (!hasCategory(user, dish.category)) return false;

  if (action === 'edit' && user.role === 'editor') {
    // A normal GET/edit-form check has no proposed category. For a PATCH,
    // enforce the new category as well, so editors cannot move a dish out
    // of their assigned categories by submitting a forged form.
    return requestedCategory === undefined || hasCategory(user, requestedCategory);
  }
  if (action === 'delete' && user.role === 'deleter') {
    return dish.available === false;
  }
  return false;
}

function deny(req, res) {
  return res.status(403).render('403', {
    title: '403 - Không có quyền truy cập',
    userEmail: req.user?.email,
    message: 'Bạn không được phép sửa hoặc xóa món ăn thuộc danh mục/trạng thái này.'
  });
}

// Optional loadDish injection is used by unit tests; production uses the
// existing Supabase-backed db wrapper and never trusts client-supplied dish data.
function requireDishPolicy(action, { loadDish } = {}) {
  if (!['edit', 'delete'].includes(action)) throw new Error('Unknown dish action');
  return async function dishPolicy(req, res, next) {
    try {
      if (!req.user) return res.redirect('/auth/login?redirect=' + encodeURIComponent(req.originalUrl));
      const id = Number(req.params?.id);
      // Let the original route return its existing 404 for bad/missing IDs.
      if (!Number.isSafeInteger(id) || id <= 0) return next();
      const dish = await (loadDish || (id => require('../db').dish.findUnique({ where: { id } })))(id);
      if (!dish) return next();

      // The normal edit form sends category; invalid or missing category
      // is denied for non-manager editors instead of bypassing a rule.
      const isPatch = req.method?.toUpperCase() === 'PATCH';
      const proposed = action === 'edit' && isPatch
        ? (typeof req.body?.category === 'string' ? req.body.category : null)
        : undefined;
      if (!canDish(req.user, action, dish, proposed)) return deny(req, res);
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = { normalizeCategory, hasCategory, canDish, requireDishPolicy };
