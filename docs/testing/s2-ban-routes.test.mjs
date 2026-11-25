import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createBanRouter} from '../../apps/backend/src/routes/ban-routes.ts';
import {AccountSessionPolicy, tokenProof} from '../../apps/backend/src/services/account-session-policy.ts';

class Store {
  data = new Map();
  async transaction(operation) {
    const staged = new Map([...this.data].map(([key, value]) => [key, structuredClone(value)]));
    const result = await operation({
      async get(path) {return structuredClone(staged.get(path) ?? null);},
      set(path, value) {staged.set(path, structuredClone(value));},
      create(path, value) {
        assert.equal(staged.has(path), false);
        staged.set(path, structuredClone(value));
      },
    });
    this.data = staged;
    return result;
  }
}
function dispatch(router, path, body, token) {
  return new Promise((resolve, reject) => {
    const res = {
      locals: {}, headers: {}, statusCode: 200,
      setHeader(key, value) {this.headers[key] = value;},
      status(code) {this.statusCode = code; return this;},
      json(value) {this.body = value; resolve(this); return this;},
    };
    router.handle({method:'POST', url:path, body,
      headers: token ? {authorization:`Bearer ${token}`} : {}}, res,
      error => reject(error ?? new Error('Route not handled')));
  });
}
function setup(enabled = true) {
  const now = Date.parse('2026-11-25T12:00:00Z');
  const store = new Store();
  store.data.set('accounts/target', {uid:'target', revision:1, updatedAt:new Date(now).toISOString()});
  const policy = new AccountSessionPolicy(store, () => now);
  const verify = async token => token === 'mod' ? {uid:'mod', role:'moderator'} :
    token === 'reader' ? {uid:'reader', role:'reader'} : null;
  return {store, policy, now, router:createBanRouter(verify, policy, enabled)};
}

test('ban API is disabled by default until the public-content integration is ready', async () => {
  const f = setup(false);
  const response = await dispatch(f.router, '/accounts/target/ban', {reason:'spam',permanent:true}, 'mod');
  assert.equal(response.statusCode, 503);
  assert.equal(response.body.error.code, 'FEATURE_UNAVAILABLE');
  assert.equal(f.store.data.get('accounts/target').ban, undefined);
});

test('moderator can ban and lift, with durable audit, notification, and session restriction', async () => {
  const f = setup();
  const endsAt = new Date(f.now + 3600000).toISOString();
  const banned = await dispatch(f.router, '/accounts/target/ban',
    {reason:' Spam ', endsAt, actorUid:'forged'}, 'mod');
  assert.equal(banned.statusCode, 200);
  assert.equal(banned.headers['Cache-Control'], 'no-store');
  assert.equal(banned.body.data.ban.actorUid, 'mod');
  assert.equal(banned.body.data.ban.reason, 'Spam');
  assert.equal(banned.body.data.ban.endsAt, endsAt);
  await assert.rejects(f.policy.authorize(tokenProof('target', f.now/1000, f.now/1000, 'token'), {bootstrap:true}), {code:'ACCOUNT_RESTRICTED'});
  const lifted = await dispatch(f.router, '/accounts/target/lift-ban', {reason:'Appeal accepted'}, 'mod');
  assert.equal(lifted.statusCode, 200);
  assert.equal(lifted.body.data.revision, 3);
  const events = [...f.store.data.values()];
  assert.deepEqual(events.filter(e => e.action?.startsWith('account_ban')).map(e => e.action),
    ['account_banned', 'account_ban_lifted']);
  assert.equal(events.filter(e => e.type === 'ban_changed').length, 2);
  await f.policy.authorize(tokenProof('target', f.now/1000, f.now/1000, 'token'), {bootstrap:true});
});

test('permanent bans stay restricted until a moderator lifts them', async () => {
  const f = setup();
  const banned = await dispatch(f.router, '/accounts/target/ban',
    {reason:'Severe violation', permanent:true}, 'mod');
  assert.equal(banned.statusCode, 200);
  assert.equal(banned.body.data.ban.permanent, true);
  assert.equal(banned.body.data.ban.endsAt, undefined);
  const denied = await dispatch(f.router, '/accounts/target/lift-ban', {reason:'Appeal'}, 'reader');
  assert.equal(denied.statusCode, 403);
  assert.equal(f.store.data.get('accounts/target').ban.permanent, true);
  assert.equal((await dispatch(f.router, '/accounts/target/lift-ban', {reason:'Appeal'}, 'mod')).statusCode, 200);
});

test('unauthorized ban attempts are recorded, and audit failures fail closed', async () => {
  const f = setup();
  assert.equal((await dispatch(f.router, '/accounts/target/ban', {reason:'spam',permanent:true})).statusCode, 401);
  const denied = await dispatch(f.router, '/accounts/target/ban', {reason:'spam',permanent:true}, 'reader');
  assert.equal(denied.statusCode, 403);
  assert.equal(f.store.data.get('accounts/target').ban, undefined);
  const audit = [...f.store.data.values()].find(e => e.action === 'unauthorized_ban_attempt');
  assert.equal(audit.actorUid, 'reader');
  assert.equal(audit.targetUid, 'target');
  const failing = createBanRouter(async () => ({uid:'reader',role:'reader'}), {
    ...f.policy,
    async recordUnauthorizedBanAttempt() {throw new Error('private storage failure');},
  }, true);
  const failed = await dispatch(failing, '/accounts/target/ban', {}, 'reader');
  assert.equal(failed.statusCode, 503);
  assert.equal(JSON.stringify(failed.body).includes('private storage failure'), false);
});

test('ban endpoints reject invalid durations, unknown targets, and invalid input', async () => {
  const f = setup();
  for (const body of [
    {reason:'', permanent:true},
    {reason:'spam', endsAt:new Date(f.now).toISOString()},
    {reason:'spam', permanent:true, endsAt:new Date(f.now+1000).toISOString()},
    {reason:12, permanent:true},
  ]) assert.equal((await dispatch(f.router, '/accounts/target/ban', body, 'mod')).statusCode, 400);
  assert.equal((await dispatch(f.router, '/accounts/missing/ban', {reason:'spam',permanent:true}, 'mod')).statusCode, 404);
  assert.equal((await dispatch(f.router, '/accounts/target/lift-ban', {reason:'No ban'}, 'mod')).statusCode, 409);
  assert.equal(f.store.data.get('accounts/target').ban, undefined);
});
