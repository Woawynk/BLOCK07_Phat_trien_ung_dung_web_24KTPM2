'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { canDish, hasCategory, requireDishPolicy } = require('../middleware/abac');

const dish = (category = 'Món nước', available = true) => ({ id: 5, category, available });
const user = (role, categories = ['Món nước']) => ({ role, email: role + '@test.invalid', allowedCategories: categories });

test('manager can edit/delete any dish regardless of category or status', () => {
  for (const a of ['edit','delete']) assert.equal(canDish(user('manager', []), a, dish('Unknown', true)), true);
});
test('editor can edit assigned category, not unassigned or uncategorized', () => {
  assert.equal(canDish(user('editor'), 'edit', dish()), true);
  assert.equal(canDish(user('editor'), 'edit', dish('Món chính')), false);
  assert.equal(canDish(user('editor'), 'edit', dish(null)), false);
  assert.equal(canDish(user('editor', []), 'edit', dish()), false);
});
test('editor cannot move dish to unassigned category', () => {
  assert.equal(canDish(user('editor'), 'edit', dish(), 'Món chính'), false);
  assert.equal(canDish(user('editor', ['Món nước', 'Món chính']), 'edit', dish(), 'Món chính'), true);
  assert.equal(canDish(user('editor'), 'edit', dish(), ''), false);
  assert.equal(canDish(user('editor'), 'edit', dish(), null), false);
});
test('deleter can delete only unavailable dishes in assigned categories', () => {
  assert.equal(canDish(user('deleter'), 'delete', dish('Món nước', false)), true);
  assert.equal(canDish(user('deleter'), 'delete', dish('Món nước', true)), false);
  assert.equal(canDish(user('deleter'), 'delete', dish('Món chính', false)), false);
});
test('roles stay separated, normal users cannot edit/delete', () => {
  for (const a of ['edit','delete']) {
    assert.equal(canDish(user('user'), a, dish('Món nước', false)), false);
    assert.equal(canDish(null, a, dish()), false);
  }
  assert.equal(canDish(user('deleter'), 'edit', dish()), false);
  assert.equal(canDish(user('editor'), 'delete', dish('Món nước', false)), false);
  assert.equal(canDish(user('manager'), 'create', dish()), false);
});
test('only trusted arrays with exact normalized category names match', () => {
  assert.equal(hasCategory({allowedCategories: 'Món nước'}, 'Món nước'), false);
  assert.equal(hasCategory(user('editor', [' Món nước ']), 'Món nước'), true);
  assert.equal(hasCategory(user('editor'), 'món nước'), false);
  assert.equal(hasCategory(user('editor'), ''), false);
});

function response() {
  return {
    statusCode: 200, rendered: null, redirected: null,
    status(code) { this.statusCode = code; return this; },
    render(page, data) { this.rendered = { page, data }; return this; },
    redirect(path) { this.redirected = path; return this; }
  };
}
const request = (role, method='GET', category='Món nước') => ({
  user: user(role), params: { id: '5' }, method, originalUrl: '/admin/dishes/5', body: { category }
});

test('middleware allows assigned edit and calls next', async () => {
  let calls = 0;
  const fn = requireDishPolicy('edit', {loadDish: async id => { assert.equal(id, 5); return dish(); }});
  const res = response();
  await fn(request('editor'), res, err => { assert.equal(err, undefined); calls++; });
  assert.equal(calls,1); assert.equal(res.rendered,null);
});
test('middleware denies forged PATCH changing category', async () => {
  let calls = 0;
  const fn = requireDishPolicy('edit', {loadDish: async () => dish()});
  const res = response();
  await fn(request('editor','PATCH','Món chính'), res, () => calls++);
  assert.equal(res.statusCode,403); assert.equal(res.rendered.page,'403'); assert.equal(calls,0);
});
test('middleware fails closed for missing PATCH category', async () => {
  const req = request('editor','PATCH'); req.body={};
  const res = response();
  await requireDishPolicy('edit', {loadDish:async () => dish()})(req,res,()=>{});
  assert.equal(res.statusCode,403);
});
test('middleware denies deleter when dish available', async () => {
  const res = response();
  await requireDishPolicy('delete', {loadDish:async () => dish('Món nước',true)})(request('deleter','DELETE'),res,()=>{});
  assert.equal(res.statusCode,403);
});
test('middleware allows unavailable assigned dish to deleter', async () => {
  const res = response(); let next=0;
  await requireDishPolicy('delete', {loadDish:async () => dish('Món nước',false)})(request('deleter','DELETE'),res,()=>next++);
  assert.equal(next,1); assert.equal(res.statusCode,200);
});
test('middleware keeps original 404 handling for invalid/missing dish', async () => {
  const res = response(); let next=0;
  await requireDishPolicy('edit', {loadDish:async () => { throw Error('should not load'); }})({...request('editor'),params:{id:'abc'}},res,()=>next++);
  await requireDishPolicy('edit', {loadDish:async () => null})(request('editor'),res,()=>next++);
  assert.equal(next,2);
});
test('middleware forwards DB errors without authorizing', async () => {
  const res = response(); let caught;
  await requireDishPolicy('edit', {loadDish:async () => { throw Error('DB down'); }})(request('editor'),res,e=>{caught=e});
  assert.equal(caught.message,'DB down'); assert.equal(res.rendered,null);
});
