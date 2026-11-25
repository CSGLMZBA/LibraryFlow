import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createAccountRouter} from '../../apps/backend/src/routes/account-routes.ts';
import {AuthCloudError} from '../../apps/backend/src/services/auth-errors.ts';
function dispatch(router, path, body, token, method='POST') {
  return new Promise((resolve,reject)=>{
    const res={locals:{},headers:{},statusCode:200,setHeader(k,v){this.headers[k]=v;},status(code){this.statusCode=code;return this;},json(value){this.body=value;resolve(this);return this;}};
    router.handle({method,url:path,body,headers:token?{authorization:`Bearer ${token}`} : {}},res,error=>reject(error??new Error('Route not handled')));
  });
}
function services(overrides={}) {
  return {
    async verifyFirebaseIdentity(token) {return token==='mod'?{uid:'verified-mod',role:'moderator'}:token==='reader'?{uid:'verified-reader',role:'reader'}:null;},
    async requestAccountDeletion(token) {assert.equal(token,'reader');return {revision:3,emailStatus:'queued'};},
    async requestDeletionCancellation(email,password) {assert.equal(email,'reader@example.com');assert.equal(password,'Test1234!');return {id:'request-1',targetUid:'verified-reader',status:'pending',revision:1};},
    async pendingAccountRecoveryRequests(actor) {assert.equal(actor.uid,'verified-mod');return [];},
    async restoreAccount(uid,actor,revision) {assert.equal(uid,'target');assert.equal(actor.uid,'verified-mod');assert.equal(revision,3);return {restored:true,revision:4};},
    ...overrides,
  };
}
test('S2-T06 HTTP: deletion requires bearer and explicit confirmation before calling the service',async()=>{
  let called=false;
  const router=createAccountRouter(services({async requestAccountDeletion(){called=true;return {};}}));
  assert.equal((await dispatch(router,'/account/deletion-request',{confirm:true})).statusCode,401);
  const unconfirmed=await dispatch(router,'/account/deletion-request',{},'reader');
  assert.equal(unconfirmed.statusCode,400);assert.equal(unconfirmed.body.error.field,'confirm');assert.equal(called,false);
});
test('S2-T06 HTTP: deletion returns queued email status without claiming delivery',async()=>{
  const res=await dispatch(createAccountRouter(services()),'/account/deletion-request',{confirm:true,uid:'attacker'},'reader');
  assert.equal(res.statusCode,200);assert.equal(res.body.data.emailStatus,'queued');assert.equal(res.headers['Cache-Control'],'no-store');
});
test('S2-T06 HTTP: cancellation creates a pending request without restoring or issuing a session',async()=>{
  const router=createAccountRouter(services());
  const invalid=await dispatch(router,'/account/deletion-cancel',{email:'bad',password:''});
  assert.equal(invalid.statusCode,401);
  const res=await dispatch(router,'/account/deletion-cancel',{email:' Reader@Example.com ',password:'Test1234!'});
  assert.equal(res.statusCode,202);assert.equal(res.body.data.status,'pending');assert.equal(res.body.data.restored,undefined);assert.equal(res.body.data.token,undefined);
});
test('S2-T06 HTTP: restoration enforces moderator authorization and observed revision',async()=>{
  const router=createAccountRouter(services());
  assert.equal((await dispatch(router,'/moderation/accounts/target/restore',{revision:3},'reader')).statusCode,403);
  assert.equal((await dispatch(router,'/moderation/accounts/target/restore',{},'mod')).statusCode,400);
  const res=await dispatch(router,'/moderation/accounts/target/restore',{revision:3,actorUid:'attacker'},'mod');
  assert.equal(res.statusCode,200);
});
test('S2-T06 HTTP: failed cleanup and closed recovery windows remain explicit failures',async()=>{
  const failed=await dispatch(createAccountRouter(services({async requestAccountDeletion(){throw new Error('private provider details');}})),
    '/account/deletion-request',{confirm:true},'reader');
  assert.equal(failed.statusCode,503);assert.equal(JSON.stringify(failed.body).includes('private provider details'),false);
  const closed=await dispatch(createAccountRouter(services({async requestDeletionCancellation(){throw new AuthCloudError('INVALID_STATE','Restoration window closed.',undefined,409);}})),
    '/account/deletion-cancel',{email:'reader@example.com',password:'Test1234!'});
  assert.equal(closed.statusCode,409);assert.equal(closed.body.success,false);
});

test('S2-T06 HTTP: pending requests can only be listed by moderators',async()=>{
  const router=createAccountRouter(services());
  assert.equal((await dispatch(router,'/moderation/account-recovery-requests',undefined,undefined,'GET')).statusCode,401);
  assert.equal((await dispatch(router,'/moderation/account-recovery-requests',undefined,'reader','GET')).statusCode,403);
  const listed=await dispatch(router,'/moderation/account-recovery-requests',undefined,'mod','GET');
  assert.equal(listed.statusCode,200);assert.deepEqual(listed.body.data,[]);
});
