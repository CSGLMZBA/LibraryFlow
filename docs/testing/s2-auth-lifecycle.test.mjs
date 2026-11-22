import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import { createCloudAuthService } from '../../apps/frontend/src/services/auth-cloud-adapter.ts';
import { logoutCloud, verifiedFirebaseAccount } from '../../apps/backend/src/services/firebase-auth-service.ts';
import { createAuthGuard } from '../../apps/backend/src/middleware/auth-guard.ts';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const session = {user: {id: 'reader-1', email: 'reader@example.com', role: 'reader', displayName: 'reader1234', createdAt: '2026-11-21'}, authenticatedAt: '2026-11-21'};
function fixture() {
  const state = {token: 'persisted-token', signedOut: 0, forced: [], requests: [], failure: null, network: false};
  const client = {
    async signIn() { state.token = 'signed-in-token'; },
    async getToken(force = false) { state.forced.push(force); if (force) state.token = 'fresh-token'; return state.token; },
    async signOut() { state.token = null; state.signedOut++; },
  };
  globalThis.fetch = async (url, init) => {
    state.requests.push({url, ...init});
    if (state.network) throw new TypeError('offline');
    return new Response(JSON.stringify(state.failure
      ? {success: false, error: state.failure}
      : {success: true, data: url.endsWith('/logout') ? {loggedOut: true} : {...session, token: 'response-secret'}}),
      {status: state.failure ? 401 : 200});
  };
  return {state, client, create: () => createCloudAuthService('https://api.example.com/', async () => client)};
}

test('S2-T01: a new adapter restores the persisted Firebase identity and verifies its role', async () => {
  const {state, create} = fixture();
  const restored = await create().getCurrentSession();
  assert.deepEqual(restored, session);
  assert.equal('token' in restored, false);
  assert.equal(state.requests[0].headers.Authorization, 'Bearer persisted-token');
  assert.ok(state.requests[0].url.endsWith('/api/v1/auth/session'));
});

test('S2-T01: refresh forces an SDK renewal then verifies the renewed bearer', async () => {
  const {state, create} = fixture();
  assert.deepEqual(await create().refreshSession(), session);
  assert.deepEqual(state.forced, [true]);
  assert.equal(state.requests[0].method, 'POST');
  assert.ok(state.requests[0].url.endsWith('/auth/refresh'));
  assert.equal(state.requests[0].headers.Authorization, 'Bearer fresh-token');
});

test('S2-T01: access-token retrieval obtains the current token for application requests', async () => {
  const {state, create} = fixture();
  const service = create();
  await service.getCurrentSession();
  assert.equal(service.getAccessToken(), 'persisted-token');
  state.token = 'automatically-renewed';
  await service.getCurrentSession();
  assert.equal(service.getAccessToken(), 'automatically-renewed');
});

test('S2-T01: login provisions SDK persistence and exposes only a verified safe session', async () => {
  const {state, create} = fixture();
  assert.deepEqual(await create().login(session.user.email, 'Test1234!'), session);
  assert.equal(state.requests[0].url, 'https://api.example.com/api/v1/auth/login');
  assert.equal(state.requests[0].headers.Authorization, undefined);
  assert.equal(state.requests[1].headers.Authorization, 'Bearer signed-in-token');
});

test('S2-T01: revoked credentials clear SDK state and cannot provide an access token', async () => {
  const {state, create} = fixture();
  state.failure = {code: 'AUTH_INVALID', message: 'Invalid session.'};
  const service = create();
  assert.equal(await service.getCurrentSession(), null);
  assert.equal(state.signedOut, 1);
  assert.equal(await service.getAccessToken(), null);
});

test('S2-T01: a network error remains visible and does not erase persisted credentials', async () => {
  const {state, create} = fixture();
  const service = create();
  state.network = true;
  await assert.rejects(service.getCurrentSession(), {code: 'AUTH_UNAVAILABLE'});
  assert.equal(state.signedOut, 0);
  state.network = false;
  assert.deepEqual(await service.getCurrentSession(), session);
});

test('S2-T01: logout revokes server credentials and clears persisted identity', async () => {
  const {state, create} = fixture();
  const service = create();
  await service.logout();
  assert.ok(state.requests[0].url.endsWith('/auth/logout'));
  assert.equal(state.requests[0].headers.Authorization, 'Bearer persisted-token');
  assert.equal(state.signedOut, 1);
  assert.equal(await service.getCurrentSession(), null);
  assert.equal(await service.getAccessToken(), null);
});

test('S2-T01: failed remote logout still clears local credentials and reports failure', async () => {
  const {state, create} = fixture();
  const service = create();
  state.network = true;
  await assert.rejects(service.logout(), {code: 'AUTH_UNAVAILABLE'});
  assert.equal(state.signedOut, 1);
  assert.equal(await service.getCurrentSession(), null);
});

test('S2-T01: a pending restore cannot resurrect a session after logout', async () => {
  const {create} = fixture();
  let resolveRestore;
  const delegate = globalThis.fetch;
  globalThis.fetch = (url, init) => url.endsWith('/session')
    ? new Promise(resolve => { resolveRestore = () => resolve(new Response(JSON.stringify({success: true, data: session}))); })
    : delegate(url, init);
  const service = create();
  const pending = service.getCurrentSession();
  while (!resolveRestore) await new Promise(resolve => setImmediate(resolve));
  await service.logout();
  resolveRestore();
  assert.equal(await pending, null);
});

test('S2-T01: backend verification always checks Firebase revocation before loading the UID', async () => {
  const calls = [];
  const account = {uid: 'verified-uid', disabled: false, customClaims: {role: 'reader'}};
  const admin = {
    async verifyIdToken(token, checkRevoked) { calls.push([token, checkRevoked]); return {uid: 'verified-uid'}; },
    async getUser(uid) { assert.equal(uid, 'verified-uid'); return account; },
  };
  assert.equal(await verifiedFirebaseAccount('signed-token', admin), account);
  assert.deepEqual(calls, [['signed-token', true]]);
  account.disabled = true;
  await assert.rejects(verifiedFirebaseAccount('signed-token', admin), {code: 'AUTH_INVALID', httpStatus: 401});
});

test('S2-T01: revoked and expired Firebase tokens never load an account', async () => {
  for (const code of ['auth/id-token-revoked', 'auth/id-token-expired']) {
    const admin = {
      async verifyIdToken() { throw Object.assign(new Error('provider details'), {code}); },
      async getUser() { assert.fail('Invalid token reached account lookup'); },
    };
    await assert.rejects(verifiedFirebaseAccount('old-token', admin), {code: 'AUTH_INVALID', httpStatus: 401});
  }
});

test('S2-T01: provider outages are reported separately from invalid credentials', async () => {
  await assert.rejects(verifiedFirebaseAccount('token', {
    async verifyIdToken() { throw new Error('private provider details'); },
    async getUser() { assert.fail(); },
  }), {code: 'AUTH_UNAVAILABLE', httpStatus: 503});
});

test('S2-T01: backend logout revokes only the verified Firebase UID', async () => {
  const revoked = [];
  await logoutCloud('signed-token', {
    async verifyIdToken(token, checkRevoked) {
      assert.equal(token, 'signed-token'); assert.equal(checkRevoked, true);
      return {uid: 'verified-uid'};
    },
    async getUser(uid) { return {uid, disabled: false, customClaims: {role: 'reader'}}; },
    async revokeRefreshTokens(uid) { revoked.push(uid); },
  });
  assert.deepEqual(revoked, ['verified-uid']);
});

function response() {
  return {locals: {}, statusCode: 200, status(value) {this.statusCode = value; return this;}, json(value) {this.body = value;return this;}};
}
test('S2-T01: protected routes distinguish missing, invalid and wrong-role credentials', async () => {
  for (const [headers, identity, code, status] of [
    [{}, null, 'AUTH_REQUIRED', 401],
    [{authorization: 'Bearer old'}, null, 'AUTH_INVALID', 401],
    [{authorization: 'Bearer signed'}, {uid: 'u', role: 'reader'}, 'FORBIDDEN', 403],
  ]) {
    const res = response();
    await createAuthGuard(async () => identity, 'publisher')({headers}, res, () => assert.fail());
    assert.equal(res.body.error.code, code);
    assert.equal(res.statusCode, status);
  }
});

test('S2-T01: logout during Firebase initialization cancels a pending login', async () => {
  const {state, client} = fixture();
  let initialize;
  const ready = new Promise(resolve => { initialize = resolve; });
  const service = createCloudAuthService('', () => ready);
  const signingIn = service.login(session.user.email, 'Test1234!');
  const signingOut = service.logout();
  const rejection = assert.rejects(signingIn, {code: 'AUTH_INVALID'});
  initialize(client);
  await Promise.all([rejection, signingOut]);
  assert.equal(await service.getCurrentSession(), null);
  assert.equal(state.requests.filter(request => request.url.endsWith('/login')).length, 0);
});

test('S2-T01: a late failed restore cannot sign out a newly authenticated account', async () => {
  const {create} = fixture();
  let failRestore;
  let first = true;
  const delegate = globalThis.fetch;
  globalThis.fetch = (url, init) => {
    if (first && url.endsWith('/session')) {
      first = false;
      return new Promise(resolve => { failRestore = () => resolve(new Response(JSON.stringify({success: false, error: {code: 'AUTH_INVALID'}}), {status: 401})); });
    }
    return delegate(url, init);
  };
  const service = create();
  const restore = service.getCurrentSession();
  while (!failRestore) await new Promise(resolve => setImmediate(resolve));
  await service.login(session.user.email, 'Test1234!');
  failRestore();
  assert.equal(await restore, null);
  assert.deepEqual(await service.getCurrentSession(), session);
});

test('PR #18 compatibility: synchronous access-token reads receive SDK token rotations',async()=>{
  const {client}=fixture();
  let notify;
  client.onTokenChanged=listener=>{notify=listener;return ()=>{};};
  const service=createCloudAuthService('',async()=>client);
  await service.getCurrentSession();
  assert.equal(typeof service.getAccessToken(),'string');
  notify({uid:session.user.id,token:'rotated-by-sdk'});
  assert.equal(service.getAccessToken(),'rotated-by-sdk');
  notify(null);
  assert.equal(service.getAccessToken(),null);
});

test('S2-T06 client: recovery submits credentials without an existing session or bearer and never restores', async () => {
  const {createAccountLifecycleService} = await import('../../apps/frontend/src/services/account-lifecycle-service.ts');
  const calls = [];
  const auth = {getCurrentSession() {throw new Error('must not open a session');}, getAccessToken() {throw new Error('must not use a token');}};
  const service = createAccountLifecycleService(auth, 'https://api.example.com/', async (url, init) => {
    calls.push({url, ...init});
    return new Response(JSON.stringify({success: true, data: {id: 'request-1', status: 'pending'}}), {status: 202});
  });
  assert.equal((await service.requestCancellation('reader@example.com', 'Test1234!')).status, 'pending');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.example.com/api/v1/account/deletion-cancel');
  assert.equal(calls[0].headers.Authorization, undefined);
  assert.deepEqual(JSON.parse(calls[0].body), {email: 'reader@example.com', password: 'Test1234!'});
});

test('S2-T06 client: listing and approval require a session and send the observed revision', async () => {
  const {createAccountLifecycleService} = await import('../../apps/frontend/src/services/account-lifecycle-service.ts');
  const calls = [];
  let token = null;
  const service = createAccountLifecycleService({async getCurrentSession() {}, getAccessToken() {return token;}}, '', async (url, init) => {
    calls.push({url, ...init}); return new Response(JSON.stringify({success: true, data: []}));
  });
  await assert.rejects(service.pendingRecoveries(), {code: 'AUTH_REQUIRED'});
  assert.equal(calls.length, 0);
  token = 'moderator-token';
  await service.pendingRecoveries();
  await service.restoreAccount('uid/with-slash', 7);
  assert.equal(calls[0].method, 'GET');
  assert.equal(calls[0].headers.Authorization, 'Bearer moderator-token');
  assert.equal(calls[1].url, '/api/v1/moderation/accounts/uid%2Fwith-slash/restore');
  assert.deepEqual(JSON.parse(calls[1].body), {revision: 7});
});

test('S2-T01 client: pending deletion exposes recovery without granting a token; bans do not', async () => {
  for (const recoveryAvailable of [true, false]) {
    const {state, create} = fixture();
    state.failure = {code: 'ACCOUNT_RESTRICTED', message: 'Restricted', ...(recoveryAvailable ? {recoveryAvailable: true} : {})};
    const service = create();
    await assert.rejects(service.login('reader@example.com', 'Test1234!'), error => error.code === 'ACCOUNT_RESTRICTED' && error.recoveryAvailable === recoveryAvailable);
    assert.equal(service.getAccessToken(), null);
  }
});
