import assert from 'node:assert/strict';
import {test} from 'node:test';
import {AccountSessionPolicy, SESSION_IDLE_MS, DELETION_GRACE_MS, tokenProof} from '../../apps/backend/src/services/account-session-policy.ts';
import {CommentRepository} from '../../apps/backend/src/repositories/comment-repository.ts';
import {BookRepository} from '../../apps/backend/src/repositories/book-repository.ts';

export class MemoryAuthStore {
  data = new Map();
  tail = Promise.resolve();
  async transaction(operation) {
    const previous = this.tail;
    let release;
    this.tail = new Promise(resolve => {release = resolve;});
    await previous;
    const staged = new Map([...this.data].map(([k,v]) => [k,structuredClone(v)]));
    try {
      const result = await operation({
        async get(path) {return structuredClone(staged.get(path) ?? null);},
        async query(collection, field, value) {
          return [...staged].filter(([path, item]) => path.startsWith(collection+'/') && item[field] === value)
            .map(([,item])=>structuredClone(item)).slice(0,100);
        },
        set(path, value) {staged.set(path, structuredClone(value));},
        create(path, value) {assert.equal(staged.has(path), false, 'immutable event was overwritten');staged.set(path, structuredClone(value));},
      });
      this.data = staged;
      return result;
    } finally {release();}
  }
}
function setup() {
  let time = Date.parse('2026-11-21T12:00:00Z');
  const store = new MemoryAuthStore();
  const policy = new AccountSessionPolicy(store, () => time);
  const proof = tokenProof('reader', time/1000, time/1000, 'opaque-signed-token');
  return {store, policy, proof, now: () => time, advance: ms => {time += ms;}};
}

test('TC-S2-044: exactly 30 minutes idle expires and cannot be revived by reads or refresh', async () => {
  const f = setup();
  await f.policy.authorize(f.proof, {bootstrap:true});
  f.advance(SESSION_IDLE_MS-1);
  await f.policy.authorize(f.proof); // passive read does not extend activity
  f.advance(1);
  await assert.rejects(f.policy.authorize(f.proof, {bootstrap:true, touch:true}), {code:'AUTH_INVALID'});
  const freshJwtSameFamily = {...f.proof, issuedAt: f.proof.issuedAt+1800, tokenDigest:'renewed'};
  await assert.rejects(f.policy.authorize(freshJwtSameFamily, {touch:true}), {code:'AUTH_INVALID'});
});

test('TC-S2-045: user activity extends the deadline and a newer token invalidates the old digest', async () => {
  const f = setup();
  await f.policy.authorize(f.proof, {bootstrap:true});
  f.advance(SESSION_IDLE_MS-1000);
  const refreshed = {...f.proof, issuedAt: f.proof.issuedAt+1799, tokenDigest:'new-token-digest'};
  await f.policy.authorize(refreshed, {touch:true});
  await assert.rejects(f.policy.authorize(f.proof), {code:'AUTH_INVALID'});
  f.advance(SESSION_IDLE_MS-1);
  await f.policy.authorize(refreshed);
  f.advance(1);
  await assert.rejects(f.policy.authorize(refreshed), {code:'AUTH_INVALID'});
});

test('TC-S2-046/047: account-wide logout prevents replay and bootstrap of old credentials', async () => {
  const f = setup();
  await f.policy.authorize(f.proof, {bootstrap:true});
  await f.policy.revoke('reader');
  await assert.rejects(f.policy.authorize(f.proof, {bootstrap:true}), {code:'AUTH_INVALID'});
  f.advance(1000);
  const login = tokenProof('reader', f.now()/1000, f.now()/1000, 'fresh-login');
  await f.policy.authorize(login, {bootstrap:true});
});

test('TC-S2-048/049: deletion restricts access and atomically queues a 30-day job, audit and email', async () => {
  const f = setup();
  await f.policy.authorize(f.proof, {bootstrap:true});
  const result = await f.policy.requestDeletion('reader','reader@example.com');
  assert.equal(Date.parse(result.permanentDeletionAt)-Date.parse(result.deletionRequestedAt), DELETION_GRACE_MS);
  assert.equal(result.emailStatus,'queued');
  assert.equal([...f.store.data.keys()].filter(k=>k.startsWith('accountAudit/')).length,1);
  assert.equal([...f.store.data.keys()].filter(k=>k.startsWith('accountEmailOutbox/')).length,1);
  assert.equal([...f.store.data.values()].some(v=>v.kind==='account-data' && v.status==='pending'),true);
  assert.equal(JSON.stringify([...f.store.data]).includes('opaque-signed-token'), false);
  await assert.rejects(f.policy.authorize(f.proof), {code:'ACCOUNT_RESTRICTED',httpStatus:403});
  assert.deepEqual(await f.policy.requestDeletion('reader','reader@example.com'),result);
});

test('TC-S2-050: only moderator approval of a request restores within the grace period', async () => {
  const f = setup();
  const result = await f.policy.requestDeletion('reader','reader@example.com');
  await f.policy.requestRecovery('reader');
  await assert.rejects(f.policy.restore('reader',{uid:'mod',role:'moderator'}),{code:'INVALID_STATE'});
  await f.policy.markRedacted('reader');
  await f.policy.requestRecovery('reader');
  const restored = await f.policy.restore('reader',{uid:'mod',role:'moderator'});
  assert.equal(restored.revision,result.revision+2);
  assert.equal(f.store.data.get('accounts/reader').deletionRequestedAt, undefined);
  assert.equal([...f.store.data.values()].some(v=>v.kind==='account-data' && v.cancelledAt && v.status==='completed'),true);
  assert.equal([...f.store.data.values()].some(v=>v.type==='account_restored'),true);
  await assert.rejects(f.policy.authorize(f.proof, {bootstrap:true}),{code:'AUTH_INVALID'});
});

test('TC-S2-050: the deadline and a claimed cleanup job both prevent unsafe cancellation', async () => {
  for (const cause of ['deadline','claimed']) {
    const f = setup();
    await f.policy.requestDeletion('reader','reader@example.com');
    await f.policy.markRedacted('reader');
    if (cause==='deadline') f.advance(DELETION_GRACE_MS);
    else {
      const key=[...f.store.data.keys()].find(k=>k.startsWith('deletionJobs/'));
      f.store.data.set(key,{...f.store.data.get(key),status:'processing'});
    }
    await assert.rejects(f.policy.restore('reader',{uid:'mod',role:'moderator'}),{code:'INVALID_STATE'});
    assert.ok(f.store.data.get('accounts/reader').deletionRequestedAt);
  }
});

test('TC-S2-051: only a moderator can restore; stale revisions cannot overwrite state', async () => {
  const f = setup();
  const request=await f.policy.requestDeletion('reader','reader@example.com');
  const redactedRevision=await f.policy.markRedacted('reader');
  await f.policy.requestRecovery('reader');
  await assert.rejects(f.policy.restore('reader',{uid:'other',role:'reader'}),{code:'FORBIDDEN'});
  await assert.rejects(f.policy.restore('reader',{uid:'mod',role:'moderator'},redactedRevision+1),{code:'REVISION_CONFLICT'});
  await f.policy.restore('reader',{uid:'mod',role:'moderator'},redactedRevision);
  const audit=[...f.store.data.values()].find(v=>v.action==='account_restored');
  assert.equal(audit.actorUid,'mod'); assert.equal(audit.targetUid,'reader');
});

test('TC-S2-052: active temporary and permanent bans block otherwise-valid sessions', async () => {
  const f=setup();
  await f.policy.authorize(f.proof,{bootstrap:true});
  for (const ban of [
    {startsAt:new Date(f.now()-1000).toISOString(),endsAt:new Date(f.now()+1000).toISOString()},
    {startsAt:new Date(f.now()-1000).toISOString(),permanent:true},
  ]) {
    f.store.data.set('accounts/reader',{uid:'reader',revision:2,ban});
    await assert.rejects(f.policy.authorize(f.proof),{code:'ACCOUNT_RESTRICTED'});
  }
});

test('moderator ban transaction restricts sessions, creates audit and notification, then expires', async () => {
  const f=setup();
  await f.policy.authorize(f.proof,{bootstrap:true});
  const actor={uid:'mod',role:'moderator'};
  const endsAt=new Date(f.now()+1000).toISOString();
  const result=await f.policy.ban('reader',actor,{reason:'  Repeated spam  ',endsAt});
  assert.equal(result.revision,2);
  assert.deepEqual(result.ban,{actorUid:'mod',targetUid:'reader',reason:'Repeated spam',startsAt:new Date(f.now()).toISOString(),endsAt});
  const events=[...f.store.data.values()];
  assert.ok(events.some(v=>v.action==='account_banned' && v.actorUid==='mod' && v.targetUid==='reader' && v.reason==='Repeated spam'));
  assert.ok(events.some(v=>v.type==='ban_changed' && v.userId==='reader' && v.message.includes(endsAt)));
  await assert.rejects(f.policy.authorize(f.proof),{code:'ACCOUNT_RESTRICTED'});
  f.advance(1000);
  await f.policy.authorize(f.proof);
});

test('permanent bans require moderator lift and leave immutable audit and notifications', async () => {
  const f=setup();
  await f.policy.authorize(f.proof,{bootstrap:true});
  const actor={uid:'mod',role:'moderator'};
  await f.policy.ban('reader',actor,{reason:'Serious violation',permanent:true});
  f.advance(60_000);
  await assert.rejects(f.policy.authorize(f.proof),{code:'ACCOUNT_RESTRICTED'});
  await assert.rejects(f.policy.liftBan('reader',{uid:'other',role:'reader'},'Appeal accepted'),{code:'FORBIDDEN'});
  assert.deepEqual(await f.policy.liftBan('reader',actor,'Appeal accepted'),{revision:3});
  await f.policy.authorize(f.proof);
  const audit=[...f.store.data.values()].filter(v=>v.action==='account_banned' || v.action==='account_ban_lifted');
  assert.deepEqual(audit.map(v=>v.action),['account_banned','account_ban_lifted']);
  assert.equal([...f.store.data.values()].filter(v=>v.type==='ban_changed').length,2);
});

test('ban policy rejects invalid inputs and competing bans without partial writes', async () => {
  const f=setup();
  await f.policy.authorize(f.proof,{bootstrap:true});
  const actor={uid:'mod',role:'moderator'};
  const before=structuredClone([...f.store.data]);
  for (const [who,input] of [
    [{uid:'reader',role:'reader'},{reason:'spam',permanent:true}],
    [actor,{reason:' ',permanent:true}],
    [actor,{reason:'spam',endsAt:new Date(f.now()).toISOString()}],
    [actor,{reason:'spam',permanent:true,endsAt:new Date(f.now()+1000).toISOString()}],
  ]) await assert.rejects(f.policy.ban('reader',who,input));
  assert.deepEqual([...f.store.data],before);
  const results=await Promise.allSettled([
    f.policy.ban('reader',actor,{reason:'spam',permanent:true}),
    f.policy.ban('reader',{uid:'mod2',role:'moderator'},{reason:'spam',permanent:true}),
  ]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(results.filter(r=>r.status==='rejected' && r.reason.code==='INVALID_STATE').length,1);
  assert.equal([...f.store.data.values()].filter(v=>v.action==='account_banned').length,1);
  assert.equal([...f.store.data.values()].filter(v=>v.type==='ban_changed').length,1);
});

test('a restricted moderator and transaction failures cannot partially ban a user', async () => {
  const f=setup();
  await f.policy.authorize(f.proof,{bootstrap:true});
  f.store.data.set('accounts/mod',{uid:'mod',revision:1,ban:{
    actorUid:'other',targetUid:'mod',reason:'restricted',
    startsAt:new Date(f.now()-1000).toISOString(),permanent:true,
  }});
  const before=structuredClone([...f.store.data]);
  await assert.rejects(f.policy.ban('reader',{uid:'mod',role:'moderator'},{reason:'spam',permanent:true}),{code:'ACCOUNT_RESTRICTED'});
  assert.deepEqual([...f.store.data],before);

  const failingStore={transaction: operation => f.store.transaction(tx => operation({
    ...tx,
    create(path,value) {
      if (path.startsWith('notifications/')) throw new Error('injected write failure');
      tx.create(path,value);
    },
  }))};
  const policy=new AccountSessionPolicy(failingStore,f.now);
  await assert.rejects(policy.ban('reader',{uid:'other',role:'moderator'},{reason:'spam',permanent:true}),/injected write failure/);
  assert.deepEqual([...f.store.data],before);
});

test('S2-T06: redaction removes public names/content and hides owned books in current repositories', async () => {
  const comments=new CommentRepository();
  const books=new BookRepository();
  await comments.create({id:'c',bookId:'b',authorId:'reader',authorDisplayName:'Private Name',content:'Personal content',createdAt:'2026-11-21'});
  await books.save({id:'b',ownerId:'reader',author:'Private Name',title:'Book',status:'approved',categoryIds:[],genreIds:[]});
  await comments.redactAuthor('reader'); await books.redactOwner('reader');
  assert.deepEqual(await comments.findByBookId('b'),[]);
  const redacted=await comments.findById('c');
  assert.equal(redacted.authorDisplayName,'Deleted user'); assert.equal(redacted.content,'');
  assert.deepEqual(await books.findApproved(),[]); assert.equal(await books.findById('b'),null);
});

test('S2-T01: simultaneous newer/older requests cannot roll the token generation backwards',async()=>{
  const f=setup();
  await f.policy.authorize(f.proof,{bootstrap:true});
  const newer={...f.proof,issuedAt:f.proof.issuedAt+1,tokenDigest:'new'};
  const results=await Promise.allSettled([f.policy.authorize(newer),f.policy.authorize(f.proof)]);
  assert.equal(results[0].status,'fulfilled'); assert.equal(results[1].status,'rejected');
});

test('S2-T01: unavailable authoritative storage fails closed without a local fallback',async()=>{
  const f=setup();
  const unavailable=new AccountSessionPolicy({async transaction(){throw new Error('storage unavailable');}},f.now);
  await assert.rejects(unavailable.authorize(f.proof,{bootstrap:true}),/storage unavailable/);
});

test('S2-T06: credential-proved requests are idempotent and never cancel deletion themselves',async()=>{
  const f=setup();
  await f.policy.requestDeletion('reader','reader@example.com');
  await f.policy.markRedacted('reader');
  const before=structuredClone(f.store.data.get('accounts/reader'));
  const request=await f.policy.requestRecovery('reader');
  assert.equal(request.status,'pending');
  assert.deepEqual(await f.policy.requestRecovery('reader'),request);
  assert.deepEqual(f.store.data.get('accounts/reader'),before);
  assert.equal(f.store.data.get('deletionJobs/'+before.deletionJobId).status,'pending');
  await assert.rejects(f.policy.authorize(f.proof,{bootstrap:true}),{code:'ACCOUNT_RESTRICTED'});
  await assert.rejects(f.policy.restore('reader',{uid:'reader',role:'reader'},before.revision),{code:'FORBIDDEN'});
  assert.equal([...f.store.data.values()].filter(v=>v.action==='deletion_cancellation_requested').length,1);
});

test('S2-T06: moderators cannot restore without a pending user request',async()=>{
  const f=setup();
  await f.policy.requestDeletion('reader','reader@example.com');
  await f.policy.markRedacted('reader');
  await assert.rejects(f.policy.restore('reader',{uid:'mod',role:'moderator'},f.store.data.get('accounts/reader').revision),{code:'INVALID_STATE'});
});

test('S2-T06: only active moderators can list requests; approval closes request and job atomically',async()=>{
  const f=setup();
  await f.policy.requestDeletion('reader','reader@example.com');
  await f.policy.requestRecovery('reader');
  await f.policy.markRedacted('reader');
  await assert.rejects(f.policy.pendingRecoveryRequests({uid:'reader',role:'reader'}),{code:'FORBIDDEN'});
  const [item]=await f.policy.pendingRecoveryRequests({uid:'mod',role:'moderator'});
  assert.equal(item.canRestore,true);
  assert.equal(item.accountRevision,f.store.data.get('accounts/reader').revision);
  await f.policy.restore('reader',{uid:'mod',role:'moderator'},item.accountRevision);
  const approved=f.store.data.get('accountRecoveryRequests/'+item.id);
  assert.equal(approved.status,'approved');assert.equal(approved.reviewerUid,'mod');assert.equal(approved.revision,2);
  assert.equal((await f.policy.pendingRecoveryRequests({uid:'mod',role:'moderator'})).length,0);
  assert.equal(f.store.data.get('accounts/reader').deletionRequestedAt,undefined);
});

test('S2-T06: deadline or claimed worker prevents both requesting and approving recovery',async()=>{
  for(const cause of ['deadline','claimed']) {
    const f=setup();
    await f.policy.requestDeletion('reader','reader@example.com');
    await f.policy.markRedacted('reader');
    await f.policy.requestRecovery('reader');
    if(cause==='deadline') f.advance(DELETION_GRACE_MS);
    else {const account=f.store.data.get('accounts/reader');const path='deletionJobs/'+account.deletionJobId;f.store.data.set(path,{...f.store.data.get(path),status:'processing'});}
    await assert.rejects(f.policy.requestRecovery('reader'),{code:'INVALID_STATE'});
    await assert.rejects(f.policy.restore('reader',{uid:'mod',role:'moderator'}),{code:'INVALID_STATE'});
  }
});
