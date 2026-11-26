import assert from 'node:assert/strict';
import {afterEach, test} from 'node:test';
import {identityToolkit} from '../../apps/backend/src/services/firebase-auth-service.ts';
import {createAuthRouter} from '../../apps/backend/src/routes/auth-routes.ts';

const originalFetch = globalThis.fetch;
const originalKey = process.env.FIREBASE_WEB_API_KEY;
const originalEmulator = process.env.FIREBASE_AUTH_EMULATOR_HOST;
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.FIREBASE_WEB_API_KEY;
  else process.env.FIREBASE_WEB_API_KEY = originalKey;
  if (originalEmulator === undefined) delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
  else process.env.FIREBASE_AUTH_EMULATOR_HOST = originalEmulator;
});

function provider(status, body) {
  process.env.FIREBASE_WEB_API_KEY = 'test-key';
  delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
  globalThis.fetch = async () => new Response(JSON.stringify(body), {status});
}

test('known login errors use the same credentials response without exposing provider details', async () => {
  for (const code of ['INVALID_LOGIN_CREDENTIALS', 'INVALID_PASSWORD', 'EMAIL_NOT_FOUND', 'USER_DISABLED']) {
    provider(400, {error:{message:code}});
    await assert.rejects(identityToolkit('signInWithPassword','user@example.com','password'),
      {code:'INVALID_CREDENTIALS', httpStatus:401, message:'Incorrect email or password.'});
  }
});

test('identity provider outages, rate limits, and configuration errors remain distinct', async () => {
  for (const [status, code, expected, httpStatus] of [
    [503,'INVALID_PASSWORD','AUTH_PROVIDER_UNAVAILABLE',503],
    [429,'ANYTHING','AUTH_RATE_LIMITED',429],
    [400,'TOO_MANY_ATTEMPTS_TRY_LATER : private provider detail','AUTH_RATE_LIMITED',429],
    [400,'API_KEY_INVALID : private provider detail','AUTH_PROVIDER_ERROR',502],
  ]) {
    provider(status, {error:{message:code}});
    await assert.rejects(identityToolkit('signInWithPassword','user@example.com','password'), error => {
      assert.equal(error.code,expected);
      assert.equal(error.httpStatus,httpStatus);
      assert.ok(!error.message.includes('private provider detail'));
      return true;
    });
  }
  globalThis.fetch = async () => {throw new Error('private network details');};
  await assert.rejects(identityToolkit('signInWithPassword','user@example.com','password'),
    {code:'AUTH_PROVIDER_UNAVAILABLE',httpStatus:503});
});

test('signup duplicate and malformed successful responses are not mistaken for success', async () => {
  provider(400, {error:{message:'EMAIL_EXISTS'}});
  await assert.rejects(identityToolkit('signUp','user@example.com','password'),
    {code:'EMAIL_ALREADY_EXISTS',httpStatus:409});
  for (const body of [{}, {idToken:''}, {idToken:'  '}]) {
    provider(200,body);
    await assert.rejects(identityToolkit('signInWithPassword','user@example.com','password'),
      {code:'AUTH_PROVIDER_ERROR',httpStatus:502});
  }
  provider(200, {idToken:'signed-token'});
  assert.deepEqual(await identityToolkit('signInWithPassword','user@example.com','password'), {idToken:'signed-token'});
});

test('login HTTP response reports provider outage instead of bad credentials', async () => {
  provider(503, {error:{message:'private provider details'}});
  const router = createAuthRouter({
    async loginCloud(email,password) {return identityToolkit('signInWithPassword',email,password);},
    async currentCloudSession(){throw new Error('unused');},
    async logoutCloud(){},
    async registerCloud(){throw new Error('unused');},
    async verifyFirebaseIdentity(){return null;},
  });
  const response = await new Promise((resolve,reject) => {
    const res={locals:{},statusCode:200,setHeader(){},status(code){this.statusCode=code;return this;},
      json(body){this.body=body;resolve(this);return this;}};
    router.handle({method:'POST',url:'/login',headers:{},body:{email:'user@example.com',password:'Test1234!'}},
      res,error=>reject(error ?? new Error('route not handled')));
  });
  assert.equal(response.statusCode,503);
  assert.equal(response.body.error.code,'AUTH_PROVIDER_UNAVAILABLE');
  assert.equal(JSON.stringify(response.body).includes('private provider details'),false);
});
