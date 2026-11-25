import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAuthRouter } from '../../apps/backend/src/routes/auth-routes.ts';
import { AuthCloudError } from '../../apps/backend/src/services/firebase-auth-service.ts';
import { AccountSessionPolicy, tokenProof } from '../../apps/backend/src/services/account-session-policy.ts';

const cloudSession = {user: {id: 'uid-from-token', role: 'reader'}, token: 'verified-token', authenticatedAt: '2026-11-21T00:00:00Z'};
function services(overrides = {}) {
  return {
    async verifyFirebaseIdentity(token) { return token === 'verified-token' ? {uid: 'uid-from-token', role: 'reader'} : null; },
    async currentCloudSession(token) {
      if (!token) throw new AuthCloudError('AUTH_REQUIRED', 'Sign-in is required.', undefined, 401);
      if (token !== 'verified-token') throw new AuthCloudError('AUTH_INVALID', 'Invalid session.', undefined, 401);
      return cloudSession;
    },
    async loginCloud() { return cloudSession; },
    async registerCloud() { return cloudSession; },
    async logoutCloud() {},
    ...overrides,
  };
}
function dispatch(router, method, path, {token, body} = {}) {
  return new Promise((resolve, reject) => {
    const res = {
      locals: {}, headers: {}, statusCode: 200,
      setHeader(name, value) { this.headers[name] = value; },
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; resolve(this); return this; },
    };
    router.handle({method, url: path, headers: token ? {authorization: `Bearer ${token}`} : {}, body}, res,
      error => error ? reject(error) : reject(new Error('No route handled the request')));
  });
}

test('S2-T01 HTTP: refresh uses the verified bearer and never a body-supplied UID', async () => {
  let verified;
  const res = await dispatch(createAuthRouter(services({async currentCloudSession(token) { verified = token; return cloudSession; }})),
    'POST', '/refresh', {token: 'verified-token', body: {uid: 'attacker', role: 'moderator'}});
  assert.equal(res.statusCode, 200);
  assert.equal(verified, 'verified-token');
  assert.equal(res.body.data.user.id, 'uid-from-token');
  assert.equal(res.headers['Cache-Control'], 'no-store');
});

test('S2-T01 HTTP: refresh rejects missing and revoked tokens before resolving a session', async () => {
  const router = createAuthRouter(services());
  assert.equal((await dispatch(router, 'POST', '/refresh')).body.error.code, 'AUTH_REQUIRED');
  const invalid = await dispatch(router, 'POST', '/refresh', {token: 'revoked-token'});
  assert.equal(invalid.statusCode, 401);
  assert.equal(invalid.body.error.code, 'AUTH_INVALID');
});

test('S2-T01 HTTP: logout invalidates subsequent protected access', async () => {
  let revoked = false;
  const router = createAuthRouter(services({
    async verifyFirebaseIdentity() { return revoked ? null : {uid: 'uid-from-token', role: 'reader'}; },
    async logoutCloud(token) { assert.equal(token, 'verified-token'); revoked = true; },
    async currentCloudSession() { if (revoked) throw new AuthCloudError('AUTH_INVALID', 'Invalid session.', undefined, 401); return cloudSession; },
  }));
  const logout = await dispatch(router, 'POST', '/logout', {token: 'verified-token'});
  assert.equal(logout.statusCode, 200);
  assert.deepEqual(logout.body, {success: true, data: {loggedOut: true}});
  const after = await dispatch(router, 'GET', '/session', {token: 'verified-token'});
  assert.equal(after.statusCode, 401);
  assert.equal(after.body.error.code, 'AUTH_INVALID');
});

test('S2-T01 HTTP: restricted accounts receive the contracted error at login', async () => {
  const res = await dispatch(createAuthRouter(services({
    async loginCloud() { throw new AuthCloudError('ACCOUNT_RESTRICTED', 'Account is pending deletion.', undefined, 403); },
  })), 'POST', '/login', {body: {email: 'reader@example.com', password: 'Test1234!'}});
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error.code, 'ACCOUNT_RESTRICTED');
});

test('a verified banned account receives the reason and duration without a session', async () => {
  const now=Date.parse('2026-11-25T12:00:00Z');
  const account={uid:'reader',revision:2,ban:{actorUid:'mod',targetUid:'reader',reason:'Repeated spam',
    startsAt:new Date(now-1000).toISOString(),endsAt:new Date(now+3600000).toISOString()}};
  const store={async transaction(fn){return fn({async get(path){return path==='accounts/reader'?account:null;}});}};
  const policy=new AccountSessionPolicy(store,()=>now);
  const router=createAuthRouter(services({
    async loginCloud(email,password) {
      assert.equal(email,'reader@example.com'); assert.equal(password,'Test1234!');
      await policy.authorize(tokenProof('reader',now/1000,now/1000,'verified-token'),{bootstrap:true});
      assert.fail('Restricted account must not receive a session');
    },
  }));
  const res=await dispatch(router,'POST','/login',{body:{email:'reader@example.com',password:'Test1234!'}});
  assert.equal(res.statusCode,403);
  assert.match(res.body.error.message,/Repeated spam/);
  assert.ok(res.body.error.message.includes(account.ban.endsAt));
  assert.equal(res.body.data,undefined);
  assert.equal(res.headers['Cache-Control'],'no-store');
});

test('S2-T01 HTTP: provider failure does not pretend credentials were revoked', async () => {
  const res = await dispatch(createAuthRouter(services({async currentCloudSession() { throw new Error('provider failure'); }})),
    'GET', '/session', {token: 'verified-token'});
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.error.code, 'AUTH_UNAVAILABLE');
  assert.equal(JSON.stringify(res.body).includes('provider failure'), false);
});

test('S2-T01 HTTP: recovery is advertised only for the verified deletion restriction', async () => {
  for (const [code, available] of [['ACCOUNT_RESTRICTED', true], ['ACCOUNT_RESTRICTED', false], ['INVALID_CREDENTIALS', false]]) {
    const res = await dispatch(createAuthRouter(services({
      async loginCloud() {throw new AuthCloudError(code, 'Restricted', undefined, 403, available);},
    })), 'POST', '/login', {body: {email: 'reader@example.com', password: 'Test1234!'}});
    assert.equal(res.body.error.recoveryAvailable, available ? true : undefined);
    assert.equal(res.body.data, undefined);
  }
});
